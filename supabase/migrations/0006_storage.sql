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
