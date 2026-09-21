-- Optional private strength profile. Run once in the Supabase SQL editor.
alter table public.profiles
  add column if not exists strength_tracking_enabled boolean not null default false;

create table if not exists public.strength_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  unit text not null default 'lb' check (unit in ('lb', 'kg')),
  body_weight_kg numeric(6,2) check (body_weight_kg between 20 and 500),
  incline_dumbbell_press numeric(7,2) check (incline_dumbbell_press > 0 and incline_dumbbell_press <= 1000),
  triceps_pushdown numeric(7,2) check (triceps_pushdown > 0 and triceps_pushdown <= 1000),
  overhead_press numeric(7,2) check (overhead_press > 0 and overhead_press <= 1000),
  incline_curl numeric(7,2) check (incline_curl > 0 and incline_curl <= 1000),
  seated_cable_row numeric(7,2) check (seated_cable_row > 0 and seated_cable_row <= 1000),
  lat_pulldown numeric(7,2) check (lat_pulldown > 0 and lat_pulldown <= 1000),
  leg_extension numeric(7,2) check (leg_extension > 0 and leg_extension <= 1000),
  leg_curl numeric(7,2) check (leg_curl > 0 and leg_curl <= 1000),
  hip_thrust numeric(7,2) check (hip_thrust > 0 and hip_thrust <= 1000),
  calf_raise numeric(7,2) check (calf_raise > 0 and calf_raise <= 1000),
  cable_crunch numeric(7,2) check (cable_crunch > 0 and cable_crunch <= 1000),
  updated_at timestamptz not null default now()
);

-- Keeps this migration safe for projects that created strength_profiles before
-- population-based tiers were added.
alter table public.strength_profiles
  add column if not exists body_weight_kg numeric(6,2) check (body_weight_kg between 20 and 500);

alter table public.strength_profiles enable row level security;

drop policy if exists "users read own strength profile" on public.strength_profiles;
create policy "users read own strength profile" on public.strength_profiles
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "users create own strength profile" on public.strength_profiles;
create policy "users create own strength profile" on public.strength_profiles
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "users update own strength profile" on public.strength_profiles;
create policy "users update own strength profile" on public.strength_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users delete own strength profile" on public.strength_profiles;
create policy "users delete own strength profile" on public.strength_profiles
  for delete to authenticated using (user_id = auth.uid());
