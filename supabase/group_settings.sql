-- Run once in the Supabase SQL Editor to enable secure owner-only group settings.

create or replace function public.update_group_settings(
  p_group_id uuid,
  p_name text,
  p_description text,
  p_quota integer,
  p_password text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if not exists (
    select 1 from public.groups
    where id = p_group_id and owner_id = auth.uid()
  ) then
    raise exception 'Only the group owner can change these settings.';
  end if;

  if trim(coalesce(p_name, '')) = '' or char_length(trim(p_name)) > 50 then
    raise exception 'Enter a group name between 1 and 50 characters.';
  end if;

  if p_quota < 1 or p_quota > 14 then
    raise exception 'Weekly quota must be between 1 and 14.';
  end if;

  if nullif(p_password, '') is not null and char_length(p_password) < 4 then
    raise exception 'Group password must be at least 4 characters.';
  end if;

  update public.groups
  set
    name = trim(p_name),
    description = coalesce(trim(p_description), ''),
    weekly_quota = p_quota,
    password_hash = case
      when nullif(p_password, '') is null then password_hash
      else extensions.crypt(p_password, extensions.gen_salt('bf'))
    end
  where id = p_group_id and owner_id = auth.uid();
end;
$$;

create or replace function public.regenerate_group_invite(
  p_group_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if not exists (
    select 1 from public.groups
    where id = p_group_id and owner_id = auth.uid()
  ) then
    raise exception 'Only the group owner can regenerate the invite code.';
  end if;

  loop
    new_code := encode(extensions.gen_random_bytes(6), 'hex');
    exit when not exists (select 1 from public.groups where invite_code = new_code);
  end loop;

  update public.groups
  set invite_code = new_code
  where id = p_group_id and owner_id = auth.uid();

  return new_code;
end;
$$;

revoke all on function public.update_group_settings(uuid, text, text, integer, text) from public;
revoke all on function public.regenerate_group_invite(uuid) from public;
grant execute on function public.update_group_settings(uuid, text, text, integer, text) to authenticated;
grant execute on function public.regenerate_group_invite(uuid) to authenticated;
