-- ============================================================
-- 007_exercise_gifs.sql  –  Let users attach a gif to any exercise
-- that doesn't have one yet (default library exercises or custom ones)
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── 1. Table: per-user gif overrides ────────────────────────────────────────
-- Keyed by exercise_id so it works both for bundled DEFAULT_EXERCISES ids
-- (e.g. "core-2") and for custom_exercises ids (uuid).

create table if not exists public.exercise_gif_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  gif_url text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

alter table public.exercise_gif_overrides enable row level security;

drop policy if exists "Users can view their own exercise gif overrides" on public.exercise_gif_overrides;
create policy "Users can view their own exercise gif overrides"
  on public.exercise_gif_overrides for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own exercise gif overrides" on public.exercise_gif_overrides;
create policy "Users can insert their own exercise gif overrides"
  on public.exercise_gif_overrides for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own exercise gif overrides" on public.exercise_gif_overrides;
create policy "Users can update their own exercise gif overrides"
  on public.exercise_gif_overrides for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own exercise gif overrides" on public.exercise_gif_overrides;
create policy "Users can delete their own exercise gif overrides"
  on public.exercise_gif_overrides for delete
  using (auth.uid() = user_id);

-- ── 2. Storage bucket for the uploaded gif files ────────────────────────────
-- Files are stored as "<user_id>/<exercise_id>.<ext>", public read.

insert into storage.buckets (id, name, public)
values ('exercise-gifs', 'exercise-gifs', true)
on conflict (id) do nothing;

drop policy if exists "Exercise gifs are publicly accessible" on storage.objects;
create policy "Exercise gifs are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'exercise-gifs');

drop policy if exists "Users can upload their own exercise gifs" on storage.objects;
create policy "Users can upload their own exercise gifs"
  on storage.objects for insert
  with check (bucket_id = 'exercise-gifs' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can update their own exercise gifs" on storage.objects;
create policy "Users can update their own exercise gifs"
  on storage.objects for update
  using (bucket_id = 'exercise-gifs' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete their own exercise gifs" on storage.objects;
create policy "Users can delete their own exercise gifs"
  on storage.objects for delete
  using (bucket_id = 'exercise-gifs' and auth.uid()::text = (storage.foldername(name))[1]);
