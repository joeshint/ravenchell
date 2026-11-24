-- =============================================================================
-- setup_all.sql — GENERATED FILE, do not edit. Source: supabase/migrations/*.sql
-- Regenerate with: npm run build:sql
--
-- Paste this whole file into Supabase → SQL Editor → New query → Run, on a NEW,
-- EMPTY project. It is not meant to be run twice on the same database.
-- Contains: 0001_extensions_enums.sql, 0002_tables.sql, 0003_functions_triggers.sql, 0004_rls_policies.sql, 0005_rpc.sql, 0006_storage.sql, 0007_reference_data.sql
-- =============================================================================


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0001_extensions_enums.sql

-- =============================================================================
-- 0001_extensions_enums.sql
-- CvSU Lost and Found System — extensions, enum types and sequences
-- =============================================================================

-- Trigram search for fast `ilike '%term%'` on item names.
create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Enum types
-- -----------------------------------------------------------------------------
create type public.user_type as enum ('student', 'faculty', 'personnel');

create type public.app_role as enum ('user', 'admin', 'super_admin');

create type public.lost_status as enum (
  'pending',    -- awaiting admin approval
  'approved',   -- publicly listed
  'rejected',   -- rejected by admin (reason in status history)
  'resolved',   -- owner got the item back
  'archived'    -- hidden by admin
);

create type public.found_status as enum (
  'pending_verification', -- awaiting admin verification
  'verified',             -- publicly listed and claimable
  'claimed',              -- a claim was approved, awaiting release
  'released',             -- handed over to the owner
  'rejected',             -- rejected by admin
  'archived'              -- hidden by admin
);

create type public.claim_status as enum (
  'pending',
  'under_review',
  'approved',
  'rejected',
  'released',
  'cancelled'   -- withdrawn by the claimant (addition to the original spec)
);

create type public.notification_type as enum (
  'report_submitted',
  'report_approved',
  'report_rejected',
  'claim_submitted',
  'claim_update',
  'claim_approved',
  'claim_rejected',
  'item_released',
  'match_suggestion',
  'system'
);

-- -----------------------------------------------------------------------------
-- Sequences for human-readable reference numbers (LST-2026-000001, ...)
-- -----------------------------------------------------------------------------
create sequence public.lost_ref_seq;
create sequence public.found_ref_seq;
create sequence public.claim_ref_seq;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0002_tables.sql

-- =============================================================================
-- 0002_tables.sql
-- CvSU Lost and Found System — tables, constraints and indexes
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles: 1:1 with auth.users. Created by trigger (see 0003), never by clients.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  full_name           text not null,
  institutional_email text not null,
  student_employee_id text,
  department          text,
  user_type           public.user_type not null default 'student',
  role                public.app_role not null default 'user',
  avatar_url          text,
  phone               text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint profiles_full_name_len   check (char_length(btrim(full_name)) between 2 and 120),
  constraint profiles_email_lower     check (institutional_email = lower(institutional_email)),
  constraint profiles_student_id_len  check (student_employee_id is null or char_length(btrim(student_employee_id)) between 3 and 30),
  constraint profiles_department_len  check (department is null or char_length(department) <= 150),
  constraint profiles_phone_len       check (phone is null or char_length(phone) <= 30),
  constraint profiles_avatar_url_len  check (avatar_url is null or char_length(avatar_url) <= 500)
);

create unique index profiles_email_key       on public.profiles (institutional_email);
create unique index profiles_student_id_key  on public.profiles (lower(student_employee_id)) where student_employee_id is not null;
create index        profiles_role_idx        on public.profiles (role);
create index        profiles_full_name_trgm  on public.profiles using gin (full_name extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Lookup tables
-- -----------------------------------------------------------------------------
create table public.item_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null,
  description text,
  icon        text,                      -- lucide-react icon name, e.g. 'Smartphone'
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint item_categories_name_len    check (char_length(btrim(name)) between 2 and 60),
  constraint item_categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint item_categories_desc_len    check (description is null or char_length(description) <= 300),
  constraint item_categories_icon_len    check (icon is null or char_length(icon) <= 40)
);
create unique index item_categories_name_key on public.item_categories (lower(name));
create unique index item_categories_slug_key on public.item_categories (slug);

create table public.campuses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null,
  address     text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint campuses_name_len    check (char_length(btrim(name)) between 2 and 120),
  constraint campuses_code_format check (code ~ '^[A-Z0-9]{2,12}$'),
  constraint campuses_address_len check (address is null or char_length(address) <= 300)
);
create unique index campuses_name_key on public.campuses (lower(name));
create unique index campuses_code_key on public.campuses (code);

create table public.campus_locations (
  id               uuid primary key default gen_random_uuid(),
  campus_id        uuid not null references public.campuses (id) on delete cascade,
  name             text not null,
  description      text,
  is_custody_point boolean not null default false,  -- where found items are kept (OSAS, guard house)
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint campus_locations_name_len check (char_length(btrim(name)) between 2 and 120),
  constraint campus_locations_desc_len check (description is null or char_length(description) <= 300)
);
create unique index campus_locations_campus_name_key on public.campus_locations (campus_id, lower(name));
create index        campus_locations_campus_idx      on public.campus_locations (campus_id);

-- -----------------------------------------------------------------------------
-- Lost items (public-safe columns only — sensitive data lives in lost_item_private)
-- -----------------------------------------------------------------------------
create table public.lost_items (
  id               uuid primary key default gen_random_uuid(),
  reference_no     text not null,
  reporter_id      uuid not null references public.profiles (id) on delete cascade,
  item_name        text not null,
  category_id      uuid not null references public.item_categories (id) on delete restrict,
  description      text not null,
  date_lost        date not null,
  time_lost        time,
  campus_id        uuid not null references public.campuses (id) on delete restrict,
  location_id      uuid references public.campus_locations (id) on delete set null,
  location_details text,
  image_path       text,                 -- path inside the `item-images` bucket
  status           public.lost_status not null default 'pending',
  resolved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint lost_items_reference_no_key  unique (reference_no),
  constraint lost_items_item_name_len     check (char_length(btrim(item_name)) between 2 and 120),
  constraint lost_items_description_len  check (char_length(btrim(description)) between 10 and 2000),
  constraint lost_items_location_det_len  check (location_details is null or char_length(location_details) <= 300),
  constraint lost_items_image_path_len    check (image_path is null or char_length(image_path) <= 500),
  constraint lost_items_resolved_at       check (status <> 'resolved' or resolved_at is not null)
);
create index lost_items_status_created_idx on public.lost_items (status, created_at desc);
create index lost_items_reporter_idx       on public.lost_items (reporter_id);
create index lost_items_category_idx       on public.lost_items (category_id);
create index lost_items_campus_idx         on public.lost_items (campus_id);
create index lost_items_location_idx       on public.lost_items (location_id);
create index lost_items_date_idx           on public.lost_items (date_lost);
create index lost_items_name_trgm          on public.lost_items using gin (item_name extensions.gin_trgm_ops);

create table public.lost_item_private (
  lost_item_id        uuid primary key references public.lost_items (id) on delete cascade,
  identifying_details text,
  contact_name        text,
  contact_phone       text,
  contact_email       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint lost_private_ident_len   check (identifying_details is null or char_length(identifying_details) <= 2000),
  constraint lost_private_name_len    check (contact_name is null or char_length(contact_name) <= 120),
  constraint lost_private_phone_len   check (contact_phone is null or char_length(contact_phone) <= 30),
  constraint lost_private_email_len   check (contact_email is null or char_length(contact_email) <= 254)
);

-- -----------------------------------------------------------------------------
-- Found items (public-safe columns only — sensitive data lives in found_item_private)
-- -----------------------------------------------------------------------------
create table public.found_items (
  id                     uuid primary key default gen_random_uuid(),
  reference_no           text not null,
  reporter_id            uuid not null references public.profiles (id) on delete cascade,
  item_name              text not null,
  category_id            uuid not null references public.item_categories (id) on delete restrict,
  description            text not null,  -- generic; must not reveal identifying marks
  date_found             date not null,
  time_found             time,
  campus_id              uuid not null references public.campuses (id) on delete restrict,
  location_id            uuid references public.campus_locations (id) on delete set null,
  location_details       text,
  image_path             text,
  custody_location_id    uuid references public.campus_locations (id) on delete set null,
  status                 public.found_status not null default 'pending_verification',
  verification_questions text[] not null default '{}',  -- shown to claimants; answers are never stored here
  verified_by            uuid references public.profiles (id) on delete set null,
  verified_at            timestamptz,
  released_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint found_items_reference_no_key unique (reference_no),
  constraint found_items_item_name_len    check (char_length(btrim(item_name)) between 2 and 120),
  constraint found_items_description_len  check (char_length(btrim(description)) between 10 and 2000),
  constraint found_items_location_det_len check (location_details is null or char_length(location_details) <= 300),
  constraint found_items_image_path_len   check (image_path is null or char_length(image_path) <= 500),
  constraint found_items_questions_max    check (cardinality(verification_questions) <= 5),
  constraint found_items_verified_state   check (status not in ('verified', 'claimed', 'released') or verified_at is not null),
  constraint found_items_released_state   check (status <> 'released' or released_at is not null)
);
create index found_items_status_created_idx on public.found_items (status, created_at desc);
create index found_items_reporter_idx       on public.found_items (reporter_id);
create index found_items_category_idx       on public.found_items (category_id);
create index found_items_campus_idx         on public.found_items (campus_id);
create index found_items_location_idx       on public.found_items (location_id);
create index found_items_custody_idx        on public.found_items (custody_location_id);
create index found_items_date_idx           on public.found_items (date_found);
create index found_items_name_trgm          on public.found_items using gin (item_name extensions.gin_trgm_ops);

create table public.found_item_private (
  found_item_id       uuid primary key references public.found_items (id) on delete cascade,
  identifying_details text,   -- serial numbers, contents, distinctive marks
  additional_info     text,
  custody_notes       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint found_private_ident_len   check (identifying_details is null or char_length(identifying_details) <= 2000),
  constraint found_private_info_len    check (additional_info is null or char_length(additional_info) <= 2000),
  constraint found_private_custody_len check (custody_notes is null or char_length(custody_notes) <= 500)
);

-- -----------------------------------------------------------------------------
-- Claim requests
-- -----------------------------------------------------------------------------
create table public.claim_requests (
  id                    uuid primary key default gen_random_uuid(),
  reference_no          text not null,
  found_item_id         uuid not null references public.found_items (id) on delete cascade,
  claimant_id           uuid not null references public.profiles (id) on delete cascade,
  lost_item_id          uuid references public.lost_items (id) on delete set null,  -- claimant's own lost report, optional
  ownership_description text not null,
  verification_answers  jsonb not null default '[]'::jsonb,  -- [{ "question": "...", "answer": "..." }]
  evidence_path         text,                                -- path inside the private `claim-evidence` bucket
  contact_phone         text,
  status                public.claim_status not null default 'pending',
  reviewed_by           uuid references public.profiles (id) on delete set null,
  reviewed_at           timestamptz,
  review_notes          text,
  released_at           timestamptz,
  released_by           uuid references public.profiles (id) on delete set null,
  released_to_name      text,
  release_notes         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint claim_requests_reference_no_key unique (reference_no),
  constraint claim_ownership_len        check (char_length(btrim(ownership_description)) between 20 and 3000),
  constraint claim_answers_is_array     check (jsonb_typeof(verification_answers) = 'array' and jsonb_array_length(verification_answers) <= 10),
  constraint claim_evidence_path_len    check (evidence_path is null or char_length(evidence_path) <= 500),
  constraint claim_contact_phone_len    check (contact_phone is null or char_length(contact_phone) <= 30),
  constraint claim_review_notes_len     check (review_notes is null or char_length(review_notes) <= 2000),
  constraint claim_release_notes_len    check (release_notes is null or char_length(release_notes) <= 2000),
  constraint claim_released_to_len      check (released_to_name is null or char_length(btrim(released_to_name)) between 2 and 120),
  constraint claim_reviewed_state       check (status not in ('approved', 'rejected', 'released') or reviewed_at is not null),
  constraint claim_released_state       check (status <> 'released' or (released_at is not null and released_by is not null and released_to_name is not null))
);
create index claim_requests_item_idx      on public.claim_requests (found_item_id);
create index claim_requests_claimant_idx  on public.claim_requests (claimant_id);
create index claim_requests_status_idx    on public.claim_requests (status, created_at desc);
-- A user can have only one active claim per item.
create unique index claim_requests_one_active_per_user
  on public.claim_requests (found_item_id, claimant_id)
  where status in ('pending', 'under_review', 'approved');
-- An item can have only one approved/released claim.
create unique index claim_requests_one_winner_per_item
  on public.claim_requests (found_item_id)
  where status in ('approved', 'released');

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       public.notification_type not null default 'system',
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_title_len check (char_length(title) between 1 and 150),
  constraint notifications_body_len  check (body is null or char_length(body) <= 1000),
  constraint notifications_link_len  check (link is null or char_length(link) <= 300)
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx  on public.notifications (user_id) where read_at is null;

-- -----------------------------------------------------------------------------
-- Audit trail (append-only; written only by SECURITY DEFINER functions)
-- -----------------------------------------------------------------------------
create table public.activity_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  constraint activity_logs_action_len check (char_length(action) between 1 and 80)
);
create index activity_logs_created_idx on public.activity_logs (created_at desc);
create index activity_logs_actor_idx   on public.activity_logs (actor_id);
create index activity_logs_entity_idx  on public.activity_logs (entity_type, entity_id);
create index activity_logs_action_idx  on public.activity_logs (action);

-- -----------------------------------------------------------------------------
-- Status timeline for items and claims (written by trigger)
-- -----------------------------------------------------------------------------
create table public.item_status_history (
  id          bigint generated always as identity primary key,
  entity_type text not null,
  entity_id   uuid not null,
  from_status text,
  to_status   text not null,
  changed_by  uuid references public.profiles (id) on delete set null,
  note        text,
  created_at  timestamptz not null default now(),
  constraint item_status_history_entity_type check (entity_type in ('lost_item', 'found_item', 'claim'))
);
create index item_status_history_entity_idx on public.item_status_history (entity_type, entity_id, created_at);

-- -----------------------------------------------------------------------------
-- System settings (key/value)
-- -----------------------------------------------------------------------------
create table public.system_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  is_public   boolean not null default false,  -- readable by anonymous visitors
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  constraint system_settings_key_format check (key ~ '^[a-z][a-z0-9_]{1,63}$')
);


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0003_functions_triggers.sql

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


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0004_rls_policies.sql

-- =============================================================================
-- 0004_rls_policies.sql
-- CvSU Lost and Found System — table privileges + Row Level Security
--
-- Two layers:
--  1. Column-level GRANTs decide WHICH COLUMNS a client may write. Columns such
--     as `status`, `role`, `is_active`, `reference_no` are never granted, so they
--     can only change through SECURITY DEFINER RPCs (0005).
--  2. RLS policies decide WHICH ROWS a client may see or touch.
--
-- Supabase grants ALL on new public tables to anon/authenticated by default, so
-- every table first has those privileges revoked.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Reset privileges
-- -----------------------------------------------------------------------------
revoke all on table
  public.profiles,
  public.item_categories,
  public.campuses,
  public.campus_locations,
  public.lost_items,
  public.lost_item_private,
  public.found_items,
  public.found_item_private,
  public.claim_requests,
  public.notifications,
  public.activity_logs,
  public.item_status_history,
  public.system_settings
from anon, authenticated;

revoke all on sequence public.lost_ref_seq, public.found_ref_seq, public.claim_ref_seq
from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.item_categories     enable row level security;
alter table public.campuses            enable row level security;
alter table public.campus_locations    enable row level security;
alter table public.lost_items          enable row level security;
alter table public.lost_item_private   enable row level security;
alter table public.found_items         enable row level security;
alter table public.found_item_private  enable row level security;
alter table public.claim_requests      enable row level security;
alter table public.notifications       enable row level security;
alter table public.activity_logs       enable row level security;
alter table public.item_status_history enable row level security;
alter table public.system_settings     enable row level security;

-- =============================================================================
-- profiles
-- =============================================================================
grant select on public.profiles to authenticated;
grant update (full_name, student_employee_id, department, user_type, avatar_url, phone)
  on public.profiles to authenticated;

create policy "profiles: read own or admin"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "profiles: admin update"
  on public.profiles for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- =============================================================================
-- Lookup tables: readable by everyone (inactive rows are still needed to label
-- old reports); writable by admins.
-- =============================================================================
grant select on public.item_categories, public.campuses, public.campus_locations to anon, authenticated;
grant insert, update, delete on public.item_categories, public.campuses, public.campus_locations to authenticated;

create policy "categories: read all"   on public.item_categories for select to anon, authenticated using (true);
create policy "categories: admin insert" on public.item_categories for insert to authenticated with check ((select public.is_admin()));
create policy "categories: admin update" on public.item_categories for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "categories: admin delete" on public.item_categories for delete to authenticated using ((select public.is_admin()));

create policy "campuses: read all"     on public.campuses for select to anon, authenticated using (true);
create policy "campuses: admin insert" on public.campuses for insert to authenticated with check ((select public.is_admin()));
create policy "campuses: admin update" on public.campuses for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "campuses: admin delete" on public.campuses for delete to authenticated using ((select public.is_admin()));

create policy "locations: read all"     on public.campus_locations for select to anon, authenticated using (true);
create policy "locations: admin insert" on public.campus_locations for insert to authenticated with check ((select public.is_admin()));
create policy "locations: admin update" on public.campus_locations for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "locations: admin delete" on public.campus_locations for delete to authenticated using ((select public.is_admin()));

-- =============================================================================
-- lost_items
-- =============================================================================
grant select on public.lost_items to anon, authenticated;
grant insert (reporter_id, item_name, category_id, description, date_lost, time_lost,
              campus_id, location_id, location_details, image_path)
  on public.lost_items to authenticated;
grant update (item_name, category_id, description, date_lost, time_lost,
              campus_id, location_id, location_details, image_path)
  on public.lost_items to authenticated;
grant delete on public.lost_items to authenticated;

create policy "lost_items: public listed"
  on public.lost_items for select to anon, authenticated
  using (status in ('approved', 'resolved'));

create policy "lost_items: owner or admin read"
  on public.lost_items for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));

create policy "lost_items: owner insert"
  on public.lost_items for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and (select public.is_active_user())
    and (image_path is null or image_path like (select auth.uid())::text || '/%')
  );

create policy "lost_items: owner update while pending"
  on public.lost_items for update to authenticated
  using (reporter_id = (select auth.uid()) and status = 'pending')
  with check (
    reporter_id = (select auth.uid())
    and status = 'pending'
    and (image_path is null or image_path like (select auth.uid())::text || '/%')
  );

create policy "lost_items: admin update"
  on public.lost_items for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "lost_items: owner delete while pending, admin delete"
  on public.lost_items for delete to authenticated
  using ((reporter_id = (select auth.uid()) and status = 'pending') or (select public.is_admin()));

-- lost_item_private --------------------------------------------------------------
grant select on public.lost_item_private to authenticated;
grant insert (lost_item_id, identifying_details, contact_name, contact_phone, contact_email)
  on public.lost_item_private to authenticated;
grant update (identifying_details, contact_name, contact_phone, contact_email)
  on public.lost_item_private to authenticated;

create policy "lost_private: owner or admin read"
  on public.lost_item_private for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.lost_items li
               where li.id = lost_item_private.lost_item_id
                 and li.reporter_id = (select auth.uid()))
  );

create policy "lost_private: owner insert"
  on public.lost_item_private for insert to authenticated
  with check (
    exists (select 1 from public.lost_items li
            where li.id = lost_item_private.lost_item_id
              and li.reporter_id = (select auth.uid()))
  );

create policy "lost_private: owner update while pending, admin update"
  on public.lost_item_private for update to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.lost_items li
               where li.id = lost_item_private.lost_item_id
                 and li.reporter_id = (select auth.uid())
                 and li.status = 'pending')
  )
  with check (
    (select public.is_admin())
    or exists (select 1 from public.lost_items li
               where li.id = lost_item_private.lost_item_id
                 and li.reporter_id = (select auth.uid())
                 and li.status = 'pending')
  );

-- =============================================================================
-- found_items
-- =============================================================================
grant select on public.found_items to anon, authenticated;
grant insert (reporter_id, item_name, category_id, description, date_found, time_found,
              campus_id, location_id, location_details, image_path, custody_location_id)
  on public.found_items to authenticated;
grant update (item_name, category_id, description, date_found, time_found,
              campus_id, location_id, location_details, image_path, custody_location_id)
  on public.found_items to authenticated;
grant delete on public.found_items to authenticated;

create policy "found_items: public listed"
  on public.found_items for select to anon, authenticated
  using (status in ('verified', 'claimed', 'released'));

create policy "found_items: owner or admin read"
  on public.found_items for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));

create policy "found_items: owner insert"
  on public.found_items for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and (select public.is_active_user())
    and (image_path is null or image_path like (select auth.uid())::text || '/%')
  );

create policy "found_items: owner update while pending"
  on public.found_items for update to authenticated
  using (reporter_id = (select auth.uid()) and status = 'pending_verification')
  with check (
    reporter_id = (select auth.uid())
    and status = 'pending_verification'
    and (image_path is null or image_path like (select auth.uid())::text || '/%')
  );

create policy "found_items: admin update"
  on public.found_items for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "found_items: owner delete while pending, admin delete"
  on public.found_items for delete to authenticated
  using ((reporter_id = (select auth.uid()) and status = 'pending_verification') or (select public.is_admin()));

-- found_item_private -------------------------------------------------------------
grant select on public.found_item_private to authenticated;
grant insert (found_item_id, identifying_details, additional_info, custody_notes)
  on public.found_item_private to authenticated;
grant update (identifying_details, additional_info, custody_notes)
  on public.found_item_private to authenticated;

create policy "found_private: owner or admin read"
  on public.found_item_private for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.found_items fi
               where fi.id = found_item_private.found_item_id
                 and fi.reporter_id = (select auth.uid()))
  );

create policy "found_private: owner insert"
  on public.found_item_private for insert to authenticated
  with check (
    exists (select 1 from public.found_items fi
            where fi.id = found_item_private.found_item_id
              and fi.reporter_id = (select auth.uid()))
  );

create policy "found_private: owner update while pending, admin update"
  on public.found_item_private for update to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.found_items fi
               where fi.id = found_item_private.found_item_id
                 and fi.reporter_id = (select auth.uid())
                 and fi.status = 'pending_verification')
  )
  with check (
    (select public.is_admin())
    or exists (select 1 from public.found_items fi
               where fi.id = found_item_private.found_item_id
                 and fi.reporter_id = (select auth.uid())
                 and fi.status = 'pending_verification')
  );

-- =============================================================================
-- claim_requests: claimant + admins only. Never public, never the finder.
-- No client UPDATE/DELETE — status changes go through RPCs.
-- =============================================================================
grant select on public.claim_requests to authenticated;
grant insert (found_item_id, claimant_id, lost_item_id, ownership_description,
              verification_answers, evidence_path, contact_phone)
  on public.claim_requests to authenticated;

create policy "claims: claimant or admin read"
  on public.claim_requests for select to authenticated
  using (claimant_id = (select auth.uid()) or (select public.is_admin()));

create policy "claims: claimant insert"
  on public.claim_requests for insert to authenticated
  with check (
    claimant_id = (select auth.uid())
    and (select public.is_active_user())
    and (evidence_path is null or evidence_path like (select auth.uid())::text || '/%')
  );

-- =============================================================================
-- notifications: own rows; clients may only flip `read_at` or delete.
-- =============================================================================
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "notifications: read own"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "notifications: update own"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "notifications: delete own"
  on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- =============================================================================
-- activity_logs: admins read; nobody writes directly.
-- =============================================================================
grant select on public.activity_logs to authenticated;

create policy "activity_logs: admin read"
  on public.activity_logs for select to authenticated
  using ((select public.is_admin()));

-- =============================================================================
-- item_status_history: admins + the owner of the entity.
-- =============================================================================
grant select on public.item_status_history to authenticated;

create policy "status_history: admin or owner read"
  on public.item_status_history for select to authenticated
  using (
    (select public.is_admin())
    or (entity_type = 'lost_item' and exists (
          select 1 from public.lost_items li
          where li.id = item_status_history.entity_id and li.reporter_id = (select auth.uid())))
    or (entity_type = 'found_item' and exists (
          select 1 from public.found_items fi
          where fi.id = item_status_history.entity_id and fi.reporter_id = (select auth.uid())))
    or (entity_type = 'claim' and exists (
          select 1 from public.claim_requests cr
          where cr.id = item_status_history.entity_id and cr.claimant_id = (select auth.uid())))
  );

-- =============================================================================
-- system_settings: public keys readable by all; admins read all;
-- only super admins write.
-- =============================================================================
grant select on public.system_settings to anon, authenticated;
grant insert (key, value, description, is_public) on public.system_settings to authenticated;
grant update (value, description, is_public) on public.system_settings to authenticated;
grant delete on public.system_settings to authenticated;

create policy "settings: read public"
  on public.system_settings for select to anon, authenticated
  using (is_public);

create policy "settings: admin read all"
  on public.system_settings for select to authenticated
  using ((select public.is_admin()));

create policy "settings: super admin insert"
  on public.system_settings for insert to authenticated
  with check ((select public.is_super_admin()));

create policy "settings: super admin update"
  on public.system_settings for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));

create policy "settings: super admin delete"
  on public.system_settings for delete to authenticated
  using ((select public.is_super_admin()));

-- =============================================================================
-- Realtime: live unread badge. Realtime applies the SELECT policy above.
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0005_rpc.sql

-- =============================================================================
-- 0005_rpc.sql
-- CvSU Lost and Found System — RPC functions called from the frontend
--
--  * User RPCs that write items are SECURITY INVOKER: RLS and column grants
--    still apply; the function only makes the two inserts atomic.
--  * Admin RPCs are SECURITY DEFINER and start with an explicit role check.
--  * The end of this file revokes EXECUTE from everyone and grants it back
--    function by function.
-- =============================================================================

-- =============================================================================
-- Registration helper (anon). Lets the register form say *which* field is
-- taken instead of Supabase's generic "Database error saving new user".
-- =============================================================================
create or replace function public.check_registration_availability(
  p_email      text,
  p_student_id text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'email_taken', exists (
      select 1 from public.profiles where institutional_email = lower(btrim(p_email))),
    'student_id_taken', exists (
      select 1 from public.profiles
      where p_student_id is not null
        and lower(student_employee_id) = lower(btrim(p_student_id)))
  );
$$;

-- =============================================================================
-- Lost reports (SECURITY INVOKER)
-- =============================================================================
create or replace function public.submit_lost_report(
  p_item_name           text,
  p_category_id         uuid,
  p_description         text,
  p_date_lost           date,
  p_campus_id           uuid,
  p_time_lost           time default null,
  p_location_id         uuid default null,
  p_location_details    text default null,
  p_image_path          text default null,
  p_identifying_details text default null,
  p_contact_name        text default null,
  p_contact_phone       text default null,
  p_contact_email       text default null
)
returns public.lost_items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.lost_items;
begin
  if (select auth.uid()) is null then
    raise exception 'You must be signed in to submit a report' using errcode = '42501';
  end if;

  insert into public.lost_items (
    reporter_id, item_name, category_id, description, date_lost, time_lost,
    campus_id, location_id, location_details, image_path
  ) values (
    (select auth.uid()), btrim(p_item_name), p_category_id, btrim(p_description), p_date_lost, p_time_lost,
    p_campus_id, p_location_id, nullif(btrim(p_location_details), ''), nullif(p_image_path, '')
  )
  returning * into v_row;

  insert into public.lost_item_private (lost_item_id, identifying_details, contact_name, contact_phone, contact_email)
  values (
    v_row.id,
    nullif(btrim(p_identifying_details), ''),
    nullif(btrim(p_contact_name), ''),
    nullif(btrim(p_contact_phone), ''),
    nullif(lower(btrim(p_contact_email)), '')
  );

  return v_row;
end;
$$;

create or replace function public.update_lost_report(
  p_id                  uuid,
  p_item_name           text,
  p_category_id         uuid,
  p_description         text,
  p_date_lost           date,
  p_campus_id           uuid,
  p_time_lost           time default null,
  p_location_id         uuid default null,
  p_location_details    text default null,
  p_image_path          text default null,
  p_identifying_details text default null,
  p_contact_name        text default null,
  p_contact_phone       text default null,
  p_contact_email       text default null
)
returns public.lost_items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.lost_items;
begin
  update public.lost_items
     set item_name        = btrim(p_item_name),
         category_id      = p_category_id,
         description      = btrim(p_description),
         date_lost        = p_date_lost,
         time_lost        = p_time_lost,
         campus_id        = p_campus_id,
         location_id      = p_location_id,
         location_details = nullif(btrim(p_location_details), ''),
         image_path       = nullif(p_image_path, '')
   where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'Report not found, or it can no longer be edited' using errcode = 'P0002';
  end if;

  insert into public.lost_item_private (lost_item_id, identifying_details, contact_name, contact_phone, contact_email)
  values (
    v_row.id,
    nullif(btrim(p_identifying_details), ''),
    nullif(btrim(p_contact_name), ''),
    nullif(btrim(p_contact_phone), ''),
    nullif(lower(btrim(p_contact_email)), '')
  )
  on conflict (lost_item_id) do update
     set identifying_details = excluded.identifying_details,
         contact_name        = excluded.contact_name,
         contact_phone       = excluded.contact_phone,
         contact_email       = excluded.contact_email;

  return v_row;
end;
$$;

-- Owner marks their own lost item as recovered.
create or replace function public.mark_my_lost_item_resolved(p_id uuid)
returns public.lost_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.lost_items;
begin
  select * into v_row from public.lost_items
   where id = p_id and reporter_id = (select auth.uid())
   for update;
  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  if v_row.status not in ('pending', 'approved') then
    raise exception 'Only pending or listed reports can be marked as recovered' using errcode = '22023';
  end if;

  perform set_config('app.status_note', 'Marked as recovered by the owner', true);
  update public.lost_items
     set status = 'resolved', resolved_at = now()
   where id = p_id
  returning * into v_row;

  perform public.log_activity('lost_item.self_resolved', 'lost_item', p_id,
    jsonb_build_object('reference_no', v_row.reference_no));
  return v_row;
end;
$$;

-- =============================================================================
-- Found reports (SECURITY INVOKER)
-- =============================================================================
create or replace function public.submit_found_report(
  p_item_name           text,
  p_category_id         uuid,
  p_description         text,
  p_date_found          date,
  p_campus_id           uuid,
  p_time_found          time default null,
  p_location_id         uuid default null,
  p_location_details    text default null,
  p_image_path          text default null,
  p_custody_location_id uuid default null,
  p_identifying_details text default null,
  p_additional_info     text default null,
  p_custody_notes       text default null
)
returns public.found_items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.found_items;
begin
  if (select auth.uid()) is null then
    raise exception 'You must be signed in to submit a report' using errcode = '42501';
  end if;

  insert into public.found_items (
    reporter_id, item_name, category_id, description, date_found, time_found,
    campus_id, location_id, location_details, image_path, custody_location_id
  ) values (
    (select auth.uid()), btrim(p_item_name), p_category_id, btrim(p_description), p_date_found, p_time_found,
    p_campus_id, p_location_id, nullif(btrim(p_location_details), ''), nullif(p_image_path, ''), p_custody_location_id
  )
  returning * into v_row;

  insert into public.found_item_private (found_item_id, identifying_details, additional_info, custody_notes)
  values (
    v_row.id,
    nullif(btrim(p_identifying_details), ''),
    nullif(btrim(p_additional_info), ''),
    nullif(btrim(p_custody_notes), '')
  );

  return v_row;
end;
$$;

create or replace function public.update_found_report(
  p_id                  uuid,
  p_item_name           text,
  p_category_id         uuid,
  p_description         text,
  p_date_found          date,
  p_campus_id           uuid,
  p_time_found          time default null,
  p_location_id         uuid default null,
  p_location_details    text default null,
  p_image_path          text default null,
  p_custody_location_id uuid default null,
  p_identifying_details text default null,
  p_additional_info     text default null,
  p_custody_notes       text default null
)
returns public.found_items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.found_items;
begin
  update public.found_items
     set item_name           = btrim(p_item_name),
         category_id         = p_category_id,
         description         = btrim(p_description),
         date_found          = p_date_found,
         time_found          = p_time_found,
         campus_id           = p_campus_id,
         location_id         = p_location_id,
         location_details    = nullif(btrim(p_location_details), ''),
         image_path          = nullif(p_image_path, ''),
         custody_location_id = p_custody_location_id
   where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'Report not found, or it can no longer be edited' using errcode = 'P0002';
  end if;

  insert into public.found_item_private (found_item_id, identifying_details, additional_info, custody_notes)
  values (
    v_row.id,
    nullif(btrim(p_identifying_details), ''),
    nullif(btrim(p_additional_info), ''),
    nullif(btrim(p_custody_notes), '')
  )
  on conflict (found_item_id) do update
     set identifying_details = excluded.identifying_details,
         additional_info     = excluded.additional_info,
         custody_notes       = excluded.custody_notes;

  return v_row;
end;
$$;

-- =============================================================================
-- Claimant: withdraw own claim
-- =============================================================================
create or replace function public.cancel_my_claim(p_claim_id uuid)
returns public.claim_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claim_requests;
begin
  select * into v_claim from public.claim_requests
   where id = p_claim_id and claimant_id = (select auth.uid())
   for update;
  if not found then
    raise exception 'Claim not found' using errcode = 'P0002';
  end if;
  if v_claim.status not in ('pending', 'under_review') then
    raise exception 'Only pending claims can be withdrawn' using errcode = '22023';
  end if;

  perform set_config('app.status_note', 'Withdrawn by the claimant', true);
  update public.claim_requests set status = 'cancelled' where id = p_claim_id
  returning * into v_claim;

  perform public.log_activity('claim.cancelled', 'claim', p_claim_id,
    jsonb_build_object('reference_no', v_claim.reference_no));
  return v_claim;
end;
$$;

-- =============================================================================
-- ADMIN: moderate lost-item reports
--   approve: pending | rejected | archived → approved
--   reject : pending → rejected (reason required)
--   resolve: approved → resolved
--   archive: any except archived → archived
-- =============================================================================
create or replace function public.admin_review_lost_item(
  p_id     uuid,
  p_action text,
  p_notes  text default null
)
returns public.lost_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item  public.lost_items;
  v_old   public.lost_status;
  v_new   public.lost_status;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  perform public.assert_admin();

  select * into v_item from public.lost_items where id = p_id for update;
  if not found then
    raise exception 'Lost-item report not found' using errcode = 'P0002';
  end if;
  v_old := v_item.status;

  v_new := case
    when p_action = 'approve' and v_old in ('pending', 'rejected', 'archived') then 'approved'::public.lost_status
    when p_action = 'reject'  and v_old = 'pending'                           then 'rejected'::public.lost_status
    when p_action = 'resolve' and v_old = 'approved'                          then 'resolved'::public.lost_status
    when p_action = 'archive' and v_old <> 'archived'                         then 'archived'::public.lost_status
  end;
  if v_new is null then
    raise exception 'Cannot "%" a report whose status is "%"', p_action, v_old using errcode = '22023';
  end if;
  if p_action = 'reject' and v_notes is null then
    raise exception 'Please provide a reason for rejecting this report' using errcode = '22023';
  end if;

  perform set_config('app.status_note', coalesce(v_notes, ''), true);
  update public.lost_items
     set status      = v_new,
         resolved_at = case when v_new = 'resolved' then now() else resolved_at end
   where id = p_id
  returning * into v_item;

  perform public.log_activity('lost_item.' || p_action, 'lost_item', p_id,
    jsonb_build_object('reference_no', v_item.reference_no, 'from', v_old, 'to', v_new, 'notes', v_notes));

  if v_new = 'approved' then
    perform public.notify_user(v_item.reporter_id, 'report_approved', 'Lost-item report approved',
      format('Your report %s (%s) is now listed publicly.', v_item.reference_no, v_item.item_name),
      '/lost/' || v_item.id);
  elsif v_new = 'rejected' then
    perform public.notify_user(v_item.reporter_id, 'report_rejected', 'Lost-item report not approved',
      format('Your report %s was not approved. Reason: %s', v_item.reference_no, v_notes),
      '/my-reports');
  elsif v_new = 'resolved' then
    perform public.notify_user(v_item.reporter_id, 'item_released', 'Lost-item report resolved',
      format('Your report %s has been marked as resolved.', v_item.reference_no),
      '/my-reports');
  end if;

  return v_item;
end;
$$;

-- =============================================================================
-- ADMIN: verify found-item reports
--   verify : pending_verification | rejected | archived → verified
--            (optionally sets verification questions and custody location)
--   reject : pending_verification → rejected (reason required)
--   archive: pending_verification | verified | rejected | released → archived
--            (open claims on the item are rejected)
-- =============================================================================
create or replace function public.admin_review_found_item(
  p_id                  uuid,
  p_action              text,
  p_notes               text default null,
  p_questions           text[] default null,
  p_custody_location_id uuid default null
)
returns public.found_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item      public.found_items;
  v_old       public.found_status;
  v_new       public.found_status;
  v_notes     text := nullif(btrim(coalesce(p_notes, '')), '');
  v_questions text[];
  v_other     record;
begin
  perform public.assert_admin();

  select * into v_item from public.found_items where id = p_id for update;
  if not found then
    raise exception 'Found-item report not found' using errcode = 'P0002';
  end if;
  v_old := v_item.status;

  v_new := case
    when p_action = 'verify'  and v_old in ('pending_verification', 'rejected', 'archived') then 'verified'::public.found_status
    when p_action = 'reject'  and v_old = 'pending_verification'                          then 'rejected'::public.found_status
    when p_action = 'archive' and v_old in ('pending_verification', 'verified', 'rejected', 'released') then 'archived'::public.found_status
  end;
  if v_new is null then
    raise exception 'Cannot "%" a report whose status is "%"', p_action, v_old using errcode = '22023';
  end if;
  if p_action = 'reject' and v_notes is null then
    raise exception 'Please provide a reason for rejecting this report' using errcode = '22023';
  end if;

  if p_questions is not null then
    select coalesce(array_agg(left(btrim(q), 300)), '{}')
      into v_questions
      from unnest(p_questions) as q
     where btrim(q) <> '';
    if cardinality(v_questions) > 5 then
      raise exception 'A maximum of 5 verification questions is allowed' using errcode = '22023';
    end if;
  end if;

  if p_custody_location_id is not null
     and not exists (select 1 from public.campus_locations where id = p_custody_location_id) then
    raise exception 'Custody location not found' using errcode = '23503';
  end if;

  perform set_config('app.status_note', coalesce(v_notes, ''), true);
  update public.found_items
     set status                 = v_new,
         verified_by            = case when v_new = 'verified' then (select auth.uid()) else verified_by end,
         verified_at            = case when v_new = 'verified' then now() else verified_at end,
         verification_questions = coalesce(v_questions, verification_questions),
         custody_location_id    = coalesce(p_custody_location_id, custody_location_id)
   where id = p_id
  returning * into v_item;

  if v_new = 'archived' then
    perform set_config('app.status_note', 'Item was archived by an administrator', true);
    for v_other in
      update public.claim_requests
         set status = 'rejected', reviewed_by = (select auth.uid()), reviewed_at = now(),
             review_notes = 'The item listing was archived by an administrator.'
       where found_item_id = p_id and status in ('pending', 'under_review')
      returning id, claimant_id, reference_no
    loop
      perform public.notify_user(v_other.claimant_id, 'claim_rejected', 'Claim closed',
        format('Your claim %s was closed because the item listing was archived.', v_other.reference_no),
        '/my-claims/' || v_other.id);
    end loop;
  end if;

  perform public.log_activity('found_item.' || p_action, 'found_item', p_id,
    jsonb_build_object('reference_no', v_item.reference_no, 'from', v_old, 'to', v_new, 'notes', v_notes,
                       'questions', to_jsonb(v_item.verification_questions)));

  if v_new = 'verified' then
    perform public.notify_user(v_item.reporter_id, 'report_approved', 'Found-item report verified',
      format('Thank you! Your report %s (%s) has been verified and is now listed.', v_item.reference_no, v_item.item_name),
      '/found/' || v_item.id);
  elsif v_new = 'rejected' then
    perform public.notify_user(v_item.reporter_id, 'report_rejected', 'Found-item report not approved',
      format('Your report %s was not approved. Reason: %s', v_item.reference_no, v_notes),
      '/my-reports');
  end if;

  return v_item;
end;
$$;

-- =============================================================================
-- ADMIN: claim decisions
--   review : pending → under_review
--   approve: pending | under_review → approved   (item → claimed, other open
--            claims on the same item → rejected)
--   reject : pending | under_review | approved → rejected (reason required;
--            if it had been approved, the item becomes claimable again)
-- =============================================================================
create or replace function public.admin_update_claim(
  p_claim_id uuid,
  p_action   text,
  p_notes    text default null
)
returns public.claim_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim   public.claim_requests;
  v_item    public.found_items;
  v_old     public.claim_status;
  v_new     public.claim_status;
  v_notes   text := nullif(btrim(coalesce(p_notes, '')), '');
  v_other   record;
  v_custody text;
begin
  perform public.assert_admin();

  select * into v_claim from public.claim_requests where id = p_claim_id for update;
  if not found then
    raise exception 'Claim request not found' using errcode = 'P0002';
  end if;
  select * into v_item from public.found_items where id = v_claim.found_item_id for update;
  v_old := v_claim.status;

  v_new := case
    when p_action = 'review'  and v_old = 'pending'                               then 'under_review'::public.claim_status
    when p_action = 'approve' and v_old in ('pending', 'under_review')            then 'approved'::public.claim_status
    when p_action = 'reject'  and v_old in ('pending', 'under_review', 'approved') then 'rejected'::public.claim_status
  end;
  if v_new is null then
    raise exception 'Cannot "%" a claim whose status is "%"', p_action, v_old using errcode = '22023';
  end if;
  if p_action = 'reject' and v_notes is null then
    raise exception 'Please provide a reason for rejecting this claim' using errcode = '22023';
  end if;
  if p_action = 'approve' and v_item.status <> 'verified' then
    raise exception 'This item is not available for claiming (status: %)', v_item.status using errcode = '22023';
  end if;

  perform set_config('app.status_note', coalesce(v_notes, ''), true);
  update public.claim_requests
     set status       = v_new,
         reviewed_by  = (select auth.uid()),
         reviewed_at  = now(),
         review_notes = coalesce(v_notes, review_notes)
   where id = p_claim_id
  returning * into v_claim;

  if v_new = 'approved' then
    perform set_config('app.status_note', 'Claim ' || v_claim.reference_no || ' approved', true);
    update public.found_items set status = 'claimed' where id = v_item.id;

    perform set_config('app.status_note', 'Another claim for this item was approved', true);
    for v_other in
      update public.claim_requests
         set status = 'rejected', reviewed_by = (select auth.uid()), reviewed_at = now(),
             review_notes = 'Another ownership claim for this item was verified and approved.'
       where found_item_id = v_item.id and id <> v_claim.id and status in ('pending', 'under_review')
      returning id, claimant_id, reference_no
    loop
      perform public.notify_user(v_other.claimant_id, 'claim_rejected', 'Claim not approved',
        format('Your claim %s was not approved because another ownership claim was verified.', v_other.reference_no),
        '/my-claims/' || v_other.id);
    end loop;

    select cl.name || coalesce(' — ' || c.name, '')
      into v_custody
      from public.campus_locations cl
      left join public.campuses c on c.id = cl.campus_id
     where cl.id = v_item.custody_location_id;

    perform public.notify_user(v_claim.claimant_id, 'claim_approved', 'Claim approved',
      format('Your claim %s for %s was approved. Bring a valid CvSU ID to %s to receive the item.',
             v_claim.reference_no, v_item.item_name, coalesce(v_custody, 'the Office of Student Affairs')),
      '/my-claims/' || v_claim.id);

  elsif v_new = 'rejected' then
    if v_old = 'approved' then
      perform set_config('app.status_note', 'Approved claim was revoked', true);
      update public.found_items set status = 'verified' where id = v_item.id and status = 'claimed';
    end if;
    perform public.notify_user(v_claim.claimant_id, 'claim_rejected', 'Claim not approved',
      format('Your claim %s was not approved. Reason: %s', v_claim.reference_no, v_notes),
      '/my-claims/' || v_claim.id);

  elsif v_new = 'under_review' then
    perform public.notify_user(v_claim.claimant_id, 'claim_update', 'Claim under review',
      format('An administrator is now reviewing your claim %s.', v_claim.reference_no),
      '/my-claims/' || v_claim.id);
  end if;

  perform public.log_activity('claim.' || p_action, 'claim', p_claim_id,
    jsonb_build_object('reference_no', v_claim.reference_no, 'found_item_reference_no', v_item.reference_no,
                       'from', v_old, 'to', v_new, 'notes', v_notes));
  return v_claim;
end;
$$;

-- =============================================================================
-- ADMIN: record the physical release of an item to its owner
-- =============================================================================
create or replace function public.admin_release_claim(
  p_claim_id         uuid,
  p_released_to_name text,
  p_notes            text default null
)
returns public.claim_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claim_requests;
  v_item  public.found_items;
  v_name  text := nullif(btrim(coalesce(p_released_to_name, '')), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  perform public.assert_admin();

  select * into v_claim from public.claim_requests where id = p_claim_id for update;
  if not found then
    raise exception 'Claim request not found' using errcode = 'P0002';
  end if;
  if v_claim.status <> 'approved' then
    raise exception 'Only approved claims can be released (current status: %)', v_claim.status using errcode = '22023';
  end if;
  if v_name is null or char_length(v_name) < 2 then
    raise exception 'Enter the name of the person who received the item' using errcode = '22023';
  end if;

  perform set_config('app.status_note', coalesce(v_notes, 'Released to ' || v_name), true);
  update public.claim_requests
     set status           = 'released',
         released_at      = now(),
         released_by      = (select auth.uid()),
         released_to_name = v_name,
         release_notes    = v_notes
   where id = p_claim_id
  returning * into v_claim;

  update public.found_items
     set status = 'released', released_at = now()
   where id = v_claim.found_item_id
  returning * into v_item;

  if v_claim.lost_item_id is not null then
    perform set_config('app.status_note', 'Recovered through claim ' || v_claim.reference_no, true);
    update public.lost_items
       set status = 'resolved', resolved_at = now()
     where id = v_claim.lost_item_id and status in ('pending', 'approved');
  end if;

  perform public.notify_user(v_claim.claimant_id, 'item_released', 'Item returned',
    format('%s (%s) has been released to you. Thank you for using CvSU Lost and Found.', v_item.item_name, v_claim.reference_no),
    '/my-claims/' || v_claim.id);
  if v_item.reporter_id <> v_claim.claimant_id then
    perform public.notify_user(v_item.reporter_id, 'item_released', 'Item returned to its owner',
      format('The item you found (%s) has been returned to its owner. Thank you for your honesty!', v_item.reference_no),
      '/my-reports');
  end if;

  perform public.log_activity('claim.release', 'claim', p_claim_id,
    jsonb_build_object('reference_no', v_claim.reference_no, 'found_item_reference_no', v_item.reference_no,
                       'released_to', v_name, 'notes', v_notes));
  return v_claim;
end;
$$;

-- =============================================================================
-- User management
-- =============================================================================
create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role    public.app_role
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_old     public.app_role;
begin
  if not public.is_super_admin() then
    raise exception 'Only a super administrator can change user roles' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  v_old := v_profile.role;
  if v_old = p_role then
    return v_profile;
  end if;

  if v_old = 'super_admin'
     and (select count(*) from public.profiles where role = 'super_admin' and is_active) <= 1 then
    raise exception 'The last super administrator cannot be demoted' using errcode = '42501';
  end if;

  update public.profiles set role = p_role where id = p_user_id
  returning * into v_profile;

  perform public.log_activity('user.role_changed', 'profile', p_user_id,
    jsonb_build_object('email', v_profile.institutional_email, 'from', v_old, 'to', p_role));
  perform public.notify_user(p_user_id, 'system', 'Your account role changed',
    format('Your role is now: %s.', replace(p_role::text, '_', ' ')), '/dashboard');
  return v_profile;
end;
$$;

create or replace function public.admin_set_user_active(
  p_user_id uuid,
  p_active  boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  perform public.assert_admin();
  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot deactivate your own account' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  if v_profile.role = 'super_admin' then
    raise exception 'Super administrator accounts cannot be deactivated here' using errcode = '42501';
  end if;
  if v_profile.role = 'admin' and not public.is_super_admin() then
    raise exception 'Only a super administrator can deactivate an administrator' using errcode = '42501';
  end if;

  update public.profiles set is_active = p_active where id = p_user_id
  returning * into v_profile;

  perform public.log_activity(case when p_active then 'user.activated' else 'user.deactivated' end,
    'profile', p_user_id, jsonb_build_object('email', v_profile.institutional_email));
  return v_profile;
end;
$$;

-- =============================================================================
-- Statistics
-- =============================================================================
create or replace function public.get_public_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'lost_open',       (select count(*) from public.lost_items  where status = 'approved'),
    'lost_resolved',   (select count(*) from public.lost_items  where status = 'resolved'),
    'found_available', (select count(*) from public.found_items where status = 'verified'),
    'found_claimed',   (select count(*) from public.found_items where status = 'claimed'),
    'returned',        (select count(*) from public.found_items where status = 'released'),
    'total_lost',      (select count(*) from public.lost_items  where status in ('approved', 'resolved')),
    'total_found',     (select count(*) from public.found_items where status in ('verified', 'claimed', 'released'))
  );
$$;

create or replace function public.get_user_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'my_lost',              (select count(*) from public.lost_items  where reporter_id = v_uid),
    'my_lost_open',         (select count(*) from public.lost_items  where reporter_id = v_uid and status in ('pending', 'approved')),
    'my_found',             (select count(*) from public.found_items where reporter_id = v_uid),
    'my_found_returned',    (select count(*) from public.found_items where reporter_id = v_uid and status = 'released'),
    'my_claims_pending',    (select count(*) from public.claim_requests where claimant_id = v_uid and status in ('pending', 'under_review')),
    'my_claims_approved',   (select count(*) from public.claim_requests where claimant_id = v_uid and status = 'approved'),
    'my_claims_released',   (select count(*) from public.claim_requests where claimant_id = v_uid and status = 'released'),
    'unread_notifications', (select count(*) from public.notifications where user_id = v_uid and read_at is null),
    'global',               public.get_public_stats()
  );
end;
$$;

create or replace function public.get_admin_analytics(
  p_from date default null,
  p_to   date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from        timestamptz := case when p_from is null then '-infinity'::timestamptz else p_from::timestamptz end;
  v_to          timestamptz := case when p_to   is null then 'infinity'::timestamptz  else (p_to + 1)::timestamptz end;
  v_month_start timestamp   := date_trunc('month', coalesce(p_from, (public.manila_today() - interval '11 months')::date)::timestamp);
  v_month_end   timestamp   := date_trunc('month', coalesce(p_to, public.manila_today())::timestamp);
  v_result      jsonb;
begin
  perform public.assert_admin();

  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'The start date must be before the end date' using errcode = '22023';
  end if;

  with
    lf as (select * from public.lost_items     where created_at >= v_from and created_at < v_to),
    ff as (select * from public.found_items    where created_at >= v_from and created_at < v_to),
    cf as (select * from public.claim_requests where created_at >= v_from and created_at < v_to)
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'lost_total',          (select count(*) from lf),
      'lost_pending',        (select count(*) from lf where status = 'pending'),
      'lost_open',           (select count(*) from lf where status = 'approved'),
      'lost_resolved',       (select count(*) from lf where status = 'resolved'),
      'found_total',         (select count(*) from ff),
      'found_pending',       (select count(*) from ff where status = 'pending_verification'),
      'found_available',     (select count(*) from ff where status = 'verified'),
      'found_claimed',       (select count(*) from ff where status = 'claimed'),
      'returned',            (select count(*) from ff where status = 'released'),
      'claims_total',        (select count(*) from cf),
      'claims_pending',      (select count(*) from cf where status = 'pending'),
      'claims_under_review', (select count(*) from cf where status = 'under_review'),
      'claims_approved',     (select count(*) from cf where status = 'approved'),
      'claims_rejected',     (select count(*) from cf where status = 'rejected'),
      'users_total',         (select count(*) from public.profiles),
      'users_active',        (select count(*) from public.profiles where is_active)
    ),
    'return_rate_pct', (
      select case when count(*) = 0 then null
                  else round(100.0 * count(*) filter (where status = 'released') / count(*), 1) end
      from ff where status <> 'rejected'),
    'avg_days_to_return', (
      select round((avg(extract(epoch from (released_at - created_at))) / 86400)::numeric, 1)
      from ff where status = 'released' and released_at is not null),
    'claim_outcomes', (
      select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
      from (select status::text as status, count(*) as n from cf group by status) s),
    'by_category', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name,
               'lost',  (select count(*) from lf where lf.category_id = c.id),
               'found', (select count(*) from ff where ff.category_id = c.id))
             order by c.sort_order, c.name), '[]'::jsonb)
      from public.item_categories c),
    'by_campus', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'code', c.code,
               'lost',     (select count(*) from lf where lf.campus_id = c.id),
               'found',    (select count(*) from ff where ff.campus_id = c.id),
               'returned', (select count(*) from ff where ff.campus_id = c.id and ff.status = 'released'))
             order by c.sort_order, c.name), '[]'::jsonb)
      from public.campuses c),
    'top_locations', (
      select coalesce(jsonb_agg(t order by t.total desc), '[]'::jsonb)
      from (
        select cl.name, c.code as campus_code, count(*) as total
        from (select location_id from lf union all select location_id from ff) x
        join public.campus_locations cl on cl.id = x.location_id
        join public.campuses c on c.id = cl.campus_id
        group by cl.name, c.code
        order by count(*) desc
        limit 10
      ) t),
    'monthly', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'month', to_char(m, 'YYYY-MM'),
               'lost',  (select count(*) from public.lost_items li
                          where date_trunc('month', li.created_at at time zone 'Asia/Manila') = m),
               'found', (select count(*) from public.found_items fi
                          where date_trunc('month', fi.created_at at time zone 'Asia/Manila') = m),
               'returned', (select count(*) from public.found_items fr
                             where fr.released_at is not null
                               and date_trunc('month', fr.released_at at time zone 'Asia/Manila') = m))
             order by m), '[]'::jsonb)
      from generate_series(v_month_start, v_month_end, interval '1 month') as m)
  ) into v_result;

  return v_result;
end;
$$;

-- =============================================================================
-- Function privileges: deny by default, then allow explicitly.
-- (Postgres grants EXECUTE to PUBLIC on new functions, and Supabase also grants
-- it to anon/authenticated.) Trigger functions need no EXECUTE grant to fire.
-- =============================================================================
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Used inside RLS policies, so every client role must be able to call them.
grant execute on function public.current_app_role() to anon, authenticated;
grant execute on function public.is_admin()         to anon, authenticated;
grant execute on function public.is_super_admin()   to anon, authenticated;
grant execute on function public.is_active_user()   to anon, authenticated;

-- Anonymous visitors
grant execute on function public.manila_today()                    to anon, authenticated;
grant execute on function public.get_public_stats()                to anon, authenticated;
grant execute on function public.check_registration_availability(text, text) to anon, authenticated;

-- Signed-in users (admin RPCs re-check the role inside)
grant execute on function public.submit_lost_report          to authenticated;
grant execute on function public.update_lost_report          to authenticated;
grant execute on function public.mark_my_lost_item_resolved  to authenticated;
grant execute on function public.submit_found_report         to authenticated;
grant execute on function public.update_found_report         to authenticated;
grant execute on function public.cancel_my_claim             to authenticated;
grant execute on function public.get_user_dashboard          to authenticated;
grant execute on function public.admin_review_lost_item      to authenticated;
grant execute on function public.admin_review_found_item     to authenticated;
grant execute on function public.admin_update_claim          to authenticated;
grant execute on function public.admin_release_claim         to authenticated;
grant execute on function public.admin_set_user_role         to authenticated;
grant execute on function public.admin_set_user_active       to authenticated;
grant execute on function public.get_admin_analytics         to authenticated;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0006_storage.sql

-- =============================================================================
-- 0006_storage.sql
-- CvSU Lost and Found System — storage buckets and object policies
--
-- Path convention for every bucket:  <auth.uid()>/<random-uuid>.<ext>
-- Size and MIME limits are enforced by the bucket itself (file_size_limit,
-- allowed_mime_types); the frontend checks the same limits for better UX.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('item-images',    'item-images',    true,  5242880,  array['image/jpeg', 'image/png', 'image/webp']),
  ('claim-evidence', 'claim-evidence', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('avatars',        'avatars',        true,  2097152,  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- item-images (public bucket: files are served by public URL; the API-level
-- SELECT below only controls listing/metadata, limited to owner + admins)
-- -----------------------------------------------------------------------------
create policy "lf item-images: owner upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "lf item-images: owner or admin read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'item-images'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

create policy "lf item-images: owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "lf item-images: owner or admin delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'item-images'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

-- -----------------------------------------------------------------------------
-- claim-evidence (PRIVATE: read via short-lived signed URLs only)
-- -----------------------------------------------------------------------------
create policy "lf claim-evidence: owner upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'claim-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "lf claim-evidence: owner or admin read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'claim-evidence'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

create policy "lf claim-evidence: owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'claim-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- -----------------------------------------------------------------------------
-- avatars (public bucket)
-- -----------------------------------------------------------------------------
create policy "lf avatars: owner upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "lf avatars: owner read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "lf avatars: owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "lf avatars: owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 0007_reference_data.sql

-- =============================================================================
-- 0007_reference_data.sql
-- CvSU Lost and Found System — required reference data (safe to re-run)
--
-- This is configuration the app needs in every environment, not demo data.
-- Administrators can edit all of it later from the admin pages.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- System settings
-- -----------------------------------------------------------------------------
insert into public.system_settings (key, value, description, is_public) values
  ('system_name',           '"CvSU Lost and Found"',            'Name shown in the header and emails.', true),
  ('allowed_email_domains', '["cvsu.edu.ph"]',                  'Only these email domains may register. Empty array = any domain.', true),
  ('require_lost_approval', 'true',                             'If true, lost-item reports must be approved by an admin before they are listed.', true),
  ('max_upload_mb',         '5',                                'Maximum image size shown to users (the bucket limit is the real enforcement).', true),
  ('claim_office',          '"Office of Student Affairs and Services (OSAS)"', 'Default office where verified claims are released.', true),
  ('claim_instructions',    '"Bring a valid CvSU ID and any proof of ownership when you pick up your item."', 'Shown to claimants after approval.', true),
  ('support_email',         '""',                               'Contact email shown in the footer (optional).', true)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Item categories (icon = lucide-react component name)
-- -----------------------------------------------------------------------------
insert into public.item_categories (name, slug, description, icon, sort_order) values
  ('Electronics',               'electronics',               'Phones, laptops, tablets, chargers, earphones', 'Smartphone', 1),
  ('Identification Cards',      'identification-cards',      'School IDs, government IDs, licenses',         'IdCard',     2),
  ('Wallets and Bags',          'wallets-and-bags',          'Wallets, purses, backpacks, pouches',          'Wallet',     3),
  ('Clothing',                  'clothing',                  'Uniforms, jackets, PE attire, caps',           'Shirt',      4),
  ('Books and School Supplies', 'books-and-school-supplies', 'Books, notebooks, calculators, art materials', 'BookOpen',   5),
  ('Accessories',               'accessories',               'Watches, eyeglasses, jewelry, umbrellas',      'Watch',      6),
  ('Keys',                      'keys',                      'House keys, car keys, locker keys',            'KeyRound',   7),
  ('Documents',                 'documents',                 'Certificates, forms, envelopes, receipts',     'FileText',   8),
  ('Others',                    'others',                    'Anything that does not fit another category',  'Package',    9)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Campuses (CvSU main campus + satellite campuses). Verify names/codes with
-- the university and adjust from Admin → Campus Locations.
-- -----------------------------------------------------------------------------
insert into public.campuses (name, code, address, sort_order) values
  ('Main Campus (Indang)',     'MAIN',  'Indang, Cavite',          1),
  ('CCAT Campus (Rosario)',    'CCAT',  'Rosario, Cavite',         2),
  ('Bacoor City Campus',       'BACOOR','Bacoor City, Cavite',     3),
  ('Carmona Campus',           'CARMONA','Carmona, Cavite',        4),
  ('Cavite City Campus',       'CAVCITY','Cavite City, Cavite',    5),
  ('General Trias City Campus','GENTRI','General Trias City, Cavite', 6),
  ('Imus Campus',              'IMUS',  'Imus City, Cavite',       7),
  ('Maragondon Campus',        'MARA',  'Maragondon, Cavite',      8),
  ('Naic Campus',              'NAIC',  'Naic, Cavite',            9),
  ('Silang Campus',            'SILANG','Silang, Cavite',          10),
  ('Tanza Campus',             'TANZA', 'Tanza, Cavite',           11),
  ('Trece Martires City Campus','TMC',  'Trece Martires City, Cavite', 12)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Generic locations for every campus. Custody points are where found items
-- are kept until released.
-- -----------------------------------------------------------------------------
insert into public.campus_locations (campus_id, name, is_custody_point)
select c.id, l.name, l.is_custody_point
from public.campuses c
cross join (values
  ('Office of Student Affairs and Services (OSAS)', true),
  ('Security Office / Main Gate',                   true),
  ('Library',                                       false),
  ('Canteen / Cafeteria',                           false),
  ('Classroom / Lecture Hall',                      false),
  ('Laboratory',                                    false),
  ('Gymnasium / Covered Court',                     false),
  ('Administration Building',                       false),
  ('Parking Area',                                  false),
  ('Restroom',                                      false),
  ('Hallway / Corridor',                            false),
  ('Open Grounds / Oval',                           false),
  ('Other (specify in details)',                    false)
) as l (name, is_custody_point)
on conflict do nothing;
