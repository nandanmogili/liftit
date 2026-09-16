-- Run once in the Supabase SQL Editor to let users delete their own posts.

drop policy if exists "users delete own workouts" on public.workouts;
create policy "users delete own workouts" on public.workouts
for delete to authenticated
using (user_id = auth.uid());
