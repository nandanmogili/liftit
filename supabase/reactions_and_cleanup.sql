-- Run once in the Supabase SQL Editor.
-- Adds reaction permissions and tracks proof photos removed by the weekly cleanup job.

alter table public.workouts
  add column if not exists proof_deleted_at timestamptz;

create index if not exists workouts_pending_proof_cleanup_idx
  on public.workouts(workout_date, proof_deleted_at)
  where proof_deleted_at is null;

alter table public.reactions enable row level security;

drop policy if exists "shared group reactions visible" on public.reactions;
create policy "shared group reactions visible" on public.reactions
for select to authenticated
using (
  exists (
    select 1 from public.workouts w
    where w.id = workout_id
      and (w.user_id = auth.uid() or public.shares_group(auth.uid(), w.user_id))
  )
);

drop policy if exists "users manage own reaction" on public.reactions;
create policy "users manage own reaction" on public.reactions
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.workouts w
    where w.id = workout_id
      and (w.user_id = auth.uid() or public.shares_group(auth.uid(), w.user_id))
  )
);

drop policy if exists "users delete own reaction" on public.reactions;
create policy "users delete own reaction" on public.reactions
for delete to authenticated
using (user_id = auth.uid());

-- Old proof photos become unreadable as soon as the new Monday begins,
-- even if the scheduled physical deletion runs later that morning.
drop policy if exists "shared members read proof" on storage.objects;
create policy "shared members read proof" on storage.objects
for select to authenticated
using (
  bucket_id = 'proof-photos'
  and exists (
    select 1 from public.workouts w
    where w.proof_path = name
      and w.proof_deleted_at is null
      and w.workout_date >= date_trunc('week', current_date)::date
      and (w.user_id = auth.uid() or public.shares_group(auth.uid(), w.user_id))
  )
);

