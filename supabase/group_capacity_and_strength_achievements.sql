-- Raise group capacity and add one-time Dominant strength achievement posts.
-- Run once in the Supabase SQL editor after strength_tracking.sql.

create or replace function public.join_group(
  p_group_id uuid default null,
  p_password text default null,
  p_invite_code text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target groups%rowtype;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if (select count(*) from group_members where user_id = auth.uid()) >= 3 then raise exception 'You can belong to a maximum of 3 groups.'; end if;

  if nullif(trim(coalesce(p_invite_code, '')), '') is not null then
    select * into target from groups where lower(invite_code) = lower(trim(p_invite_code));
  else
    select * into target from groups where id = p_group_id;
  end if;
  if target.id is null then raise exception 'Group not found.'; end if;
  if exists(select 1 from group_members where group_id = target.id and user_id = auth.uid()) then return target.id; end if;
  if (select count(*) from group_members where group_id = target.id) >= 20 then raise exception 'This group already has 20 members.'; end if;
  if nullif(trim(coalesce(p_invite_code, '')), '') is null and (p_password is null or target.password_hash <> extensions.crypt(p_password, target.password_hash)) then raise exception 'Incorrect group password.'; end if;

  insert into group_members(group_id, user_id, role)
  values(target.id, auth.uid(), 'member');
  return target.id;
end;
$$;

grant execute on function public.join_group(uuid, text, text) to authenticated;

create table if not exists public.strength_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lift_key text not null,
  lift_label text not null,
  lift_weight_kg numeric(7,2) not null check (lift_weight_kg > 0 and lift_weight_kg <= 1000),
  achieved_week date not null,
  created_at timestamptz not null default now(),
  unique (user_id, lift_key)
);

create index if not exists strength_achievements_week_idx
  on public.strength_achievements(achieved_week desc, created_at desc);

alter table public.strength_achievements enable row level security;

drop policy if exists "shared group strength achievements visible" on public.strength_achievements;
create policy "shared group strength achievements visible" on public.strength_achievements
  for select to authenticated
  using (user_id = auth.uid() or public.shares_group(auth.uid(), user_id));

drop policy if exists "users create own strength achievements" on public.strength_achievements;
create policy "users create own strength achievements" on public.strength_achievements
  for insert to authenticated with check (user_id = auth.uid());
