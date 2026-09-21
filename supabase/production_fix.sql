-- Run this once in the Supabase SQL Editor for existing Lift It projects.

drop policy if exists "users create own profile" on public.profiles;
create policy "users create own profile" on public.profiles
for insert to authenticated with check (id = auth.uid());

create or replace function public.create_group(
  p_name text,
  p_description text,
  p_quota integer,
  p_password text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if trim(p_name) = '' or char_length(trim(p_name)) > 50 then raise exception 'Enter a group name between 1 and 50 characters.'; end if;
  if p_quota < 1 or p_quota > 14 then raise exception 'Weekly quota must be between 1 and 14.'; end if;
  if char_length(p_password) < 4 then raise exception 'Group password must be at least 4 characters.'; end if;
  if (select count(*) from group_members where user_id = auth.uid()) >= 3 then raise exception 'You can belong to a maximum of 3 groups.'; end if;

  insert into groups(owner_id, name, description, weekly_quota, password_hash)
  values(auth.uid(), trim(p_name), coalesce(trim(p_description), ''), p_quota, extensions.crypt(p_password, extensions.gen_salt('bf')))
  returning id into new_group_id;

  insert into group_members(group_id, user_id, role)
  values(new_group_id, auth.uid(), 'owner');
  return new_group_id;
end;
$$;

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

grant execute on function public.create_group(text, text, integer, text) to authenticated;
grant execute on function public.join_group(uuid, text, text) to authenticated;

drop policy if exists "read own proof" on storage.objects;
drop policy if exists "shared members read proof" on storage.objects;
create policy "shared members read proof" on storage.objects
for select to authenticated
using (
  bucket_id = 'proof-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.shares_group(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
