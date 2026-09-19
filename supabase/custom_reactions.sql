-- Run once in the Supabase SQL Editor before deploying the custom emoji picker.
-- Keeps existing reactions and replaces the old four-emoji restriction.

alter table public.reactions
  drop constraint if exists reactions_emoji_check;

alter table public.reactions
  add constraint reactions_emoji_check
  check (char_length(emoji) between 1 and 32);
