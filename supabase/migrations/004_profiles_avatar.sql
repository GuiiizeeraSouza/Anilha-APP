-- ============================================================
-- 004_profiles_avatar.sql  –  Add avatar_url to profiles
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── 1. Add column ────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists avatar_url text;

-- ── 2. Backfill from existing auth metadata ──────────────────────────────────

update public.profiles p
set avatar_url = u.raw_user_meta_data->>'avatar_url'
from auth.users u
where p.id = u.id
  and u.raw_user_meta_data->>'avatar_url' is not null
  and p.avatar_url is null;

-- ── 3. Trigger: keep avatar_url in sync when auth metadata changes ────────────

create or replace function public.sync_avatar_from_auth()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  update public.profiles
  set avatar_url = new.raw_user_meta_data->>'avatar_url'
  where id = new.id
    and (avatar_url is distinct from new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of raw_user_meta_data on auth.users
  for each row execute procedure public.sync_avatar_from_auth();
