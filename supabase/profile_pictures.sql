-- Run once in the Supabase SQL Editor to enable profile-picture uploads.

insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', false, 5242880)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists "authenticated users read avatars" on storage.objects;
create policy "authenticated users read avatars" on storage.objects
for select to authenticated
using (bucket_id = 'avatars');

drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar" on storage.objects
for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users delete own avatar" on storage.objects;
create policy "users delete own avatar" on storage.objects
for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
