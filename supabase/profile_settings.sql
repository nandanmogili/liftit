-- Run once in the Supabase SQL Editor.
-- Makes usernames unique regardless of uppercase/lowercase differences.

create unique index if not exists profiles_username_lower_unique
  on public.profiles(lower(username));
