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
