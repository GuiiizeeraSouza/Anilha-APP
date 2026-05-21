-- ============================================================
-- 003_workout_sessions.sql  –  Workout sessions table + RLS
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── 1. workout_sessions table ────────────────────────────────────────────────

create table if not exists public.workout_sessions (
  id               uuid        default gen_random_uuid() primary key,
  user_id          uuid        references auth.users(id) on delete cascade not null,
  workout_id       uuid        not null,
  day_id           uuid        not null,
  completed_at     timestamptz not null default now(),
  duration_seconds int         not null default 0
);

create index if not exists workout_sessions_user_id_idx
  on public.workout_sessions (user_id);

create index if not exists workout_sessions_completed_at_idx
  on public.workout_sessions (completed_at);

alter table public.workout_sessions enable row level security;

-- ── 2. RLS policies ──────────────────────────────────────────────────────────

-- Users can always read, insert and delete their own sessions.
create policy "workout_sessions: user can read own"
  on public.workout_sessions for select
  using (auth.uid() = user_id);

create policy "workout_sessions: user can insert own"
  on public.workout_sessions for insert
  with check (auth.uid() = user_id);

create policy "workout_sessions: user can delete own"
  on public.workout_sessions for delete
  using (auth.uid() = user_id);

-- ── 3. Friends can read each other's sessions (for the weekly ranking) ───────
--
-- Allows SELECT when there is an accepted friend_request between the reader
-- (auth.uid()) and the session owner (user_id) in either direction.
--
create policy "workout_sessions: friends can read for ranking"
  on public.workout_sessions for select
  using (
    exists (
      select 1
      from public.friend_requests fr
      where fr.status = 'accepted'
        and (
          (fr.sender_id   = auth.uid() and fr.receiver_id = user_id)
          or
          (fr.receiver_id = auth.uid() and fr.sender_id   = user_id)
        )
    )
  );
