-- ============================================================
-- 002_friends.sql  –  Profiles & friend request system
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── 1. Profiles table ───────────────────────────────────────────────────────
-- Stores public display info mirrored from auth.users.

create table if not exists public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  name       text not null default '',
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles: anyone authenticated can read"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "profiles: user can update own"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger: auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill existing users (safe to run multiple times)
insert into public.profiles (id, name)
select
  id,
  coalesce(raw_user_meta_data->>'name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;


-- ── 2. Friend requests table ─────────────────────────────────────────────────

create table if not exists public.friend_requests (
  id          uuid        default gen_random_uuid() primary key,
  sender_id   uuid        references public.profiles(id) on delete cascade not null,
  receiver_id uuid        references public.profiles(id) on delete cascade not null,
  status      text        default 'pending'
              check (status in ('pending', 'accepted', 'declined')),
  created_at  timestamptz default now(),
  unique (sender_id, receiver_id)
);

alter table public.friend_requests enable row level security;

create policy "friend_requests: participants can read"
  on public.friend_requests for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "friend_requests: sender can insert"
  on public.friend_requests for insert
  with check (auth.uid() = sender_id);

create policy "friend_requests: participants can update status"
  on public.friend_requests for update
  using (auth.uid() = receiver_id or auth.uid() = sender_id);

create policy "friend_requests: participants can delete"
  on public.friend_requests for delete
  using (auth.uid() = sender_id or auth.uid() = receiver_id);
