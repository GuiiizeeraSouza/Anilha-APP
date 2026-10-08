-- ============================================================
-- 009_runs.sql  –  Corridas (aba Corrida) + RLS
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── 1. runs table ────────────────────────────────────────────────────────────

create table if not exists public.runs (
  id               uuid        primary key,                 -- gerado no app
  user_id          uuid        references auth.users(id) on delete cascade not null,
  started_at       timestamptz not null,
  distance_meters  numeric     not null check (distance_meters >= 0),
  duration_seconds int         not null check (duration_seconds >= 0),
  -- gps = medido pelo app · treadmill = esteira (distância digitada) · manual = registrada depois
  source           text        not null default 'gps' check (source in ('gps', 'treadmill', 'manual')),
  effort           text        check (effort in ('leve', 'moderado', 'forte')),
  -- tempo de movimento (s) acumulado ao completar cada km: [312, 640, ...]
  split_seconds    jsonb       not null default '[]'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists runs_user_started_idx
  on public.runs (user_id, started_at);

alter table public.runs enable row level security;

-- ── 2. RLS policies ──────────────────────────────────────────────────────────

create policy "runs: user can read own"
  on public.runs for select
  using (auth.uid() = user_id);

create policy "runs: user can insert own"
  on public.runs for insert
  with check (auth.uid() = user_id);

create policy "runs: user can delete own"
  on public.runs for delete
  using (auth.uid() = user_id);
