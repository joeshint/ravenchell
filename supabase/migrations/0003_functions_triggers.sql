-- =============================================================================
-- 0003_functions_triggers.sql
-- CvSU Lost and Found System — helper functions and triggers
--
-- Conventions:
--  * Every function sets `search_path = ''` and fully qualifies object names.
--  * SECURITY DEFINER is used only where a function must read/write rows the
--    caller cannot (role checks, audit logs, notifications, reference numbers).
--  * Execute privileges are locked down at the end of 0005_rpc.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- "Today" in the Philippines (Supabase servers run in UTC).
create or replace function public.manila_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Manila')::date;
$$;

create or replace function public.get_setting(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select s.value from public.system_settings s where s.key = p_key;
$$;

-- -----------------------------------------------------------------------------
-- Role helpers (used inside RLS policies). SECURITY DEFINER so that policies on
-- `profiles` do not recurse into themselves.
-- -----------------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid()) and p.is_active;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() in ('admin', 'super_admin'), false);
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'super_admin', false);
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active
  );
$$;

create or replace function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator privileges are required for this action'
      using errcode = '42501';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Internal writers: notifications and audit log
-- -----------------------------------------------------------------------------
create or replace function public.notify_user(
  p_user_id uuid,
  p_type    public.notification_type,
  p_title   text,
  p_body    text default null,
  p_link    text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, left(p_title, 150), left(p_body, 1000), left(p_link, 300));
$$;

create or replace function public.notify_admins(
  p_type  public.notification_type,
  p_title text,
  p_body  text default null,
  p_link  text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, link)
  select p.id, p_type, left(p_title, 150), left(p_body, 1000), left(p_link, 300)
  from public.profiles p
  where p.role in ('admin', 'super_admin') and p.is_active;
$$;

create or replace function public.log_activity(
  p_action      text,
  p_entity_type text default null,
  p_entity_id   uuid default null,
  p_details     jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- -----------------------------------------------------------------------------
-- New user → profile. The role is ALWAYS 'user'; any role in signup metadata is
-- ignored. Emails outside `allowed_email_domains` are rejected.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email     text := lower(btrim(new.email));
  v_meta      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_domains   jsonb := public.get_setting('allowed_email_domains');
  v_user_type text := v_meta ->> 'user_type';
  v_full_name text := nullif(btrim(v_meta ->> 'full_name'), '');
begin
  if v_email is null or v_email = '' then
    raise exception 'An email address is required' using errcode = '23514';
  end if;

  if v_domains is not null
     and jsonb_typeof(v_domains) = 'array'
     and jsonb_array_length(v_domains) > 0
     and not exists (
       select 1 from jsonb_array_elements_text(v_domains) d
       where v_email like '%@' || lower(btrim(d))
     )
  then
    raise exception 'Registration is limited to CvSU institutional email addresses'
      using errcode = '23514';
  end if;

  insert into public.profiles (
    id, full_name, institutional_email, student_employee_id, department, user_type, role
  ) values (
    new.id,
    coalesce(left(v_full_name, 120), split_part(v_email, '@', 1)),
    v_email,
    nullif(btrim(v_meta ->> 'student_employee_id'), ''),
    nullif(left(btrim(v_meta ->> 'department'), 150), ''),
    case when v_user_type in ('student', 'faculty', 'personnel')
         then v_user_type::public.user_type
         else 'student'::public.user_type end,
    'user'
  );

  insert into public.activity_logs (actor_id, action, entity_type, entity_id, details)
  values (new.id, 'user.registered', 'profile', new.id, jsonb_build_object('email', v_email));

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.institutional_email in sync when a user changes their email.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set institutional_email = lower(btrim(new.email))
   where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- profiles: only admins may change an already-set student/employee ID.
-- (role / is_active / email are not updatable by clients at all — see 0004.)
-- -----------------------------------------------------------------------------
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and not public.is_admin()
     and old.student_employee_id is not null
     and new.student_employee_id is distinct from old.student_employee_id
  then
    raise exception 'Your Student/Employee ID can only be changed by an administrator'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- -----------------------------------------------------------------------------
-- Reference numbers: <PREFIX>-<YEAR>-<6 digits>. Always overwritten.
-- -----------------------------------------------------------------------------
create or replace function public.assign_reference_no()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.reference_no := tg_argv[0] || '-'
    || to_char(now() at time zone 'Asia/Manila', 'YYYY') || '-'
    || lpad(nextval(tg_argv[1]::regclass)::text, 6, '0');
  return new;
end;
$$;

create trigger lost_items_assign_reference
  before insert on public.lost_items
  for each row execute function public.assign_reference_no('LST', 'public.lost_ref_seq');

create trigger found_items_assign_reference
  before insert on public.found_items
  for each row execute function public.assign_reference_no('FND', 'public.found_ref_seq');

create trigger claim_requests_assign_reference
  before insert on public.claim_requests
  for each row execute function public.assign_reference_no('CLM', 'public.claim_ref_seq');

-- -----------------------------------------------------------------------------
-- Validation + forced initial state for reports
-- -----------------------------------------------------------------------------
create or replace function public.validate_lost_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Clients can never choose the initial status.
    new.status := case
      when coalesce((public.get_setting('require_lost_approval'))::boolean, true)
        then 'pending'::public.lost_status
      else 'approved'::public.lost_status
    end;
    new.resolved_at := null;
    if (select auth.uid()) is not null then
      new.reporter_id := (select auth.uid());
    end if;
  end if;

  if tg_op = 'INSERT' or new.date_lost is distinct from old.date_lost then
    if new.date_lost > public.manila_today() then
      raise exception 'The date lost cannot be in the future' using errcode = '23514';
    end if;
  end if;

  if new.location_id is not null and not exists (
    select 1 from public.campus_locations cl
    where cl.id = new.location_id and cl.campus_id = new.campus_id
  ) then
    raise exception 'The selected location does not belong to the selected campus'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger lost_items_validate
  before insert or update on public.lost_items
  for each row execute function public.validate_lost_item();

create or replace function public.validate_found_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.status                 := 'pending_verification';
    new.verified_by            := null;
    new.verified_at            := null;
    new.released_at            := null;
    new.verification_questions := '{}';
    if (select auth.uid()) is not null then
      new.reporter_id := (select auth.uid());
    end if;
  end if;

  if tg_op = 'INSERT' or new.date_found is distinct from old.date_found then
    if new.date_found > public.manila_today() then
      raise exception 'The date found cannot be in the future' using errcode = '23514';
    end if;
  end if;

  if new.location_id is not null and not exists (
    select 1 from public.campus_locations cl
    where cl.id = new.location_id and cl.campus_id = new.campus_id
  ) then
    raise exception 'The selected location does not belong to the selected campus'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger found_items_validate
  before insert or update on public.found_items
  for each row execute function public.validate_found_item();

-- -----------------------------------------------------------------------------
-- Claim validation (SECURITY DEFINER: must read the found item regardless of
-- its visibility to the caller).
-- -----------------------------------------------------------------------------
create or replace function public.validate_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.found_items;
  v_elem jsonb;
begin
  if (select auth.uid()) is not null then
    new.claimant_id := (select auth.uid());
  end if;

  select * into v_item from public.found_items where id = new.found_item_id;
  if not found then
    raise exception 'The found item does not exist' using errcode = '23503';
  end if;
  if v_item.status <> 'verified' then
    raise exception 'This item is not available for claiming' using errcode = '23514';
  end if;
  if v_item.reporter_id = new.claimant_id then
    raise exception 'You cannot claim an item that you reported as found' using errcode = '23514';
  end if;
  if new.lost_item_id is not null and not exists (
    select 1 from public.lost_items li
    where li.id = new.lost_item_id and li.reporter_id = new.claimant_id
  ) then
    raise exception 'The linked lost-item report must be your own' using errcode = '23514';
  end if;

  -- Each answer must be {"question": text, "answer": text} with sane lengths.
  for v_elem in select * from jsonb_array_elements(coalesce(new.verification_answers, '[]'::jsonb)) loop
    if jsonb_typeof(v_elem) <> 'object'
       or jsonb_typeof(v_elem -> 'question') <> 'string'
       or jsonb_typeof(v_elem -> 'answer') <> 'string'
       or char_length(v_elem ->> 'question') > 300
       or char_length(v_elem ->> 'answer') > 1000
    then
      raise exception 'Invalid verification answers' using errcode = '23514';
    end if;
  end loop;

  -- Forced initial state.
  new.status           := 'pending';
  new.reviewed_by      := null;
  new.reviewed_at      := null;
  new.review_notes     := null;
  new.released_at      := null;
  new.released_by      := null;
  new.released_to_name := null;
  new.release_notes    := null;
  return new;
end;
$$;

create trigger claim_requests_validate
  before insert on public.claim_requests
  for each row execute function public.validate_claim();

-- -----------------------------------------------------------------------------
-- Status history. An RPC may attach a note via set_config('app.status_note', ...).
-- -----------------------------------------------------------------------------
create or replace function public.log_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(current_setting('app.status_note', true), '');
  v_from text;
begin
  if tg_op = 'UPDATE' then
    if new.status is not distinct from old.status then
      return null;
    end if;
    v_from := old.status::text;
  end if;

  insert into public.item_status_history (entity_type, entity_id, from_status, to_status, changed_by, note)
  values (tg_argv[0], new.id, v_from, new.status::text, (select auth.uid()), v_note);
  return null;
end;
$$;

create trigger lost_items_status_history
  after insert or update of status on public.lost_items
  for each row execute function public.log_status_change('lost_item');

create trigger found_items_status_history
  after insert or update of status on public.found_items
  for each row execute function public.log_status_change('found_item');

create trigger claim_requests_status_history
  after insert or update of status on public.claim_requests
  for each row execute function public.log_status_change('claim');

-- -----------------------------------------------------------------------------
-- After-insert side effects: audit + notifications
-- -----------------------------------------------------------------------------
create or replace function public.on_lost_item_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.log_activity('lost_item.created', 'lost_item', new.id,
    jsonb_build_object('reference_no', new.reference_no, 'item_name', new.item_name));
  if new.status = 'pending' then
    perform public.notify_admins('report_submitted', 'New lost-item report',
      format('%s (%s) is awaiting review.', new.item_name, new.reference_no),
      '/admin/lost-items?ref=' || new.reference_no);
  end if;
  return null;
end;
$$;

create trigger lost_items_after_insert
  after insert on public.lost_items
  for each row execute function public.on_lost_item_created();

create or replace function public.on_found_item_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.log_activity('found_item.created', 'found_item', new.id,
    jsonb_build_object('reference_no', new.reference_no, 'item_name', new.item_name));
  perform public.notify_admins('report_submitted', 'New found-item report',
    format('%s (%s) is awaiting verification.', new.item_name, new.reference_no),
    '/admin/found-items?ref=' || new.reference_no);
  return null;
end;
$$;

create trigger found_items_after_insert
  after insert on public.found_items
  for each row execute function public.on_found_item_created();

create or replace function public.on_claim_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.found_items;
begin
  select * into v_item from public.found_items where id = new.found_item_id;

  perform public.log_activity('claim.created', 'claim', new.id,
    jsonb_build_object('reference_no', new.reference_no, 'found_item_reference_no', v_item.reference_no));

  perform public.notify_admins('claim_submitted', 'New claim request',
    format('%s was submitted for %s (%s).', new.reference_no, v_item.item_name, v_item.reference_no),
    '/admin/claims/' || new.id);

  -- The finder learns that a claim exists, but never who made it or what was answered.
  if v_item.reporter_id <> new.claimant_id then
    perform public.notify_user(v_item.reporter_id, 'claim_submitted', 'A claim was submitted',
      format('Someone submitted an ownership claim for the item you found (%s). An administrator will verify it.',
             v_item.reference_no),
      '/my-reports');
  end if;
  return null;
end;
$$;

create trigger claim_requests_after_insert
  after insert on public.claim_requests
  for each row execute function public.on_claim_created();

-- -----------------------------------------------------------------------------
-- system_settings: stamp editor + audit every change
-- -----------------------------------------------------------------------------
create or replace function public.stamp_system_setting()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

create trigger system_settings_stamp
  before insert or update on public.system_settings
  for each row execute function public.stamp_system_setting();

create or replace function public.audit_system_setting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return null;  -- migrations / service role: not a user action
  end if;
  perform public.log_activity('settings.' || lower(tg_op), 'system_setting', null,
    jsonb_build_object(
      'key',       coalesce(new.key, old.key),
      'old_value', case when tg_op <> 'INSERT' then old.value end,
      'new_value', case when tg_op <> 'DELETE' then new.value end));
  return null;
end;
$$;

create trigger system_settings_audit
  after insert or update or delete on public.system_settings
  for each row execute function public.audit_system_setting();

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------
create trigger profiles_updated_at           before update on public.profiles           for each row execute function public.set_updated_at();
create trigger item_categories_updated_at    before update on public.item_categories    for each row execute function public.set_updated_at();
create trigger campuses_updated_at           before update on public.campuses           for each row execute function public.set_updated_at();
create trigger campus_locations_updated_at   before update on public.campus_locations   for each row execute function public.set_updated_at();
create trigger lost_items_updated_at         before update on public.lost_items         for each row execute function public.set_updated_at();
create trigger lost_item_private_updated_at  before update on public.lost_item_private  for each row execute function public.set_updated_at();
create trigger found_items_updated_at        before update on public.found_items        for each row execute function public.set_updated_at();
create trigger found_item_private_updated_at before update on public.found_item_private for each row execute function public.set_updated_at();
create trigger claim_requests_updated_at     before update on public.claim_requests     for each row execute function public.set_updated_at();
