-- Bento · 0004 · booking file storage
--
-- Uploaded confirmations can contain live barcodes, reference numbers and
-- passport-adjacent detail. The bucket is private and every object is
-- scoped to the uploading user by path: {user_id}/{trip_id}/{filename}.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'booking-files',
  'booking-files',
  false,
  10485760,                                  -- 10 MB
  array['application/pdf', 'image/png', 'image/jpeg', 'image/heic', 'text/plain']
)
on conflict (id) do nothing;

-- The first path segment must be the caller's own user id. A user cannot
-- read, write or delete anything outside their own subtree.
create policy "read own booking files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'booking-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "upload own booking files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'booking-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "update own booking files" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'booking-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "delete own booking files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'booking-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
