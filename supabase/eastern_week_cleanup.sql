-- Run once in the Supabase SQL Editor.
-- Keeps current-week proof photos visible through Sunday at 11:59 PM
-- and hides them at 12:00 AM Monday in America/New_York.

drop policy if exists "shared members read proof" on storage.objects;
create policy "shared members read proof" on storage.objects
for select to authenticated
using (
  bucket_id = 'proof-photos'
  and exists (
    select 1 from public.workouts w
    where w.proof_path = name
      and w.proof_deleted_at is null
      and w.workout_date >= date_trunc('week', now() at time zone 'America/New_York')::date
      and (w.user_id = auth.uid() or public.shares_group(auth.uid(), w.user_id))
  )
);
