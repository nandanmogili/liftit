-- Run once in the Supabase SQL Editor to add private, opt-in weight tracking.

alter table public.profiles
  add column if not exists weight_tracking_enabled boolean not null default false,
  add column if not exists preferred_weight_unit text not null default 'lb';

alter table public.profiles
  drop constraint if exists profiles_preferred_weight_unit_check;

alter table public.profiles
  add constraint profiles_preferred_weight_unit_check
  check (preferred_weight_unit in ('lb', 'kg'));

create table if not exists public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  weight_kg numeric(6,2) not null check (weight_kg between 20 and 500),
  logged_on date not null check (logged_on <= current_date),
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create index if not exists weight_entries_user_date_idx
  on public.weight_entries(user_id, logged_on desc);

alter table public.weight_entries enable row level security;

drop policy if exists "users read own weight entries" on public.weight_entries;
create policy "users read own weight entries" on public.weight_entries
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "users create own weight entries" on public.weight_entries;
create policy "users create own weight entries" on public.weight_entries
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "users update own weight entries" on public.weight_entries;
create policy "users update own weight entries" on public.weight_entries
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users delete own weight entries" on public.weight_entries;
create policy "users delete own weight entries" on public.weight_entries
for delete to authenticated
using (user_id = auth.uid());
