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
