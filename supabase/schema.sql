create extension if not exists pgcrypto;

create type public.workout_type as enum ('Gym', 'Cardio', 'Sports');
create type public.member_role as enum ('owner', 'member');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 24),
  avatar_path text,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  description text not null default '',
  image_path text,
  weekly_quota smallint not null check (weekly_quota between 1 and 14),
  password_hash text not null,
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  next_weekly_quota smallint check (next_weekly_quota between 1 and 14),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workout_type public.workout_type not null,
  workout_date date not null,
  note text not null default '' check (char_length(note) <= 280),
  proof_path text not null,
  created_at timestamptz not null default now(),
  check (workout_date <= current_date),
  check (workout_date >= current_date - 1)
);

create table public.reactions (
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '🔥', '💪', '👏')),
  created_at timestamptz not null default now(),
  primary key (workout_id, user_id)
);

create index workouts_user_date_idx on public.workouts(user_id, workout_date desc);
create index group_members_user_idx on public.group_members(user_id);

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create function public.is_group_member(target_group uuid, target_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from group_members where group_id = target_group and user_id = target_user);
$$;

create function public.shares_group(first_user uuid, second_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from group_members a
    join group_members b on b.group_id = a.group_id
    where a.user_id = first_user and b.user_id = second_user
  );
$$;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.workouts enable row level security;
alter table public.reactions enable row level security;

create policy "profiles readable by signed in users" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "groups searchable" on public.groups for select to authenticated using (true);
create policy "users create owned groups" on public.groups for insert to authenticated with check (owner_id = auth.uid());
create policy "owners update groups" on public.groups for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners delete groups" on public.groups for delete to authenticated using (owner_id = auth.uid());
create policy "memberships visible to members" on public.group_members for select to authenticated using (public.is_group_member(group_id, auth.uid()));
create policy "users can join" on public.group_members for insert to authenticated with check (user_id = auth.uid());
create policy "owners can remove members" on public.group_members for delete to authenticated using (user_id = auth.uid() or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid()));
create policy "users create own workouts" on public.workouts for insert to authenticated with check (user_id = auth.uid());
create policy "shared group workouts are visible" on public.workouts for select to authenticated using (user_id = auth.uid() or public.shares_group(auth.uid(), user_id));
create policy "shared group reactions visible" on public.reactions for select to authenticated using (exists (select 1 from public.workouts w where w.id = workout_id));
create policy "users manage own reaction" on public.reactions for insert to authenticated with check (user_id = auth.uid());
create policy "users delete own reaction" on public.reactions for delete to authenticated using (user_id = auth.uid());

insert into storage.buckets (id, name, public) values ('proof-photos', 'proof-photos', false) on conflict do nothing;
create policy "upload own proof" on storage.objects for insert to authenticated with check (bucket_id = 'proof-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own proof" on storage.objects for select to authenticated using (bucket_id = 'proof-photos' and (storage.foldername(name))[1] = auth.uid()::text);
