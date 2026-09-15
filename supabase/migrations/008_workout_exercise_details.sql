-- ============================================================
-- 008_workout_exercise_details.sql
-- Séries/reps/peso por exercício, treino principal, e histórico
-- de peso/tempo por exercício (para os gráficos de evolução).
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── 1. workout_days: exercise_ids -> exercises (jsonb) ──────────────────────
-- Cada item: {"exercise_id": "chest-1", "sets": 3, "reps": 12, "weight": 20}

alter table public.workout_days
  add column if not exists exercises jsonb not null default '[]'::jsonb;

update public.workout_days
set exercises = (
  select coalesce(jsonb_agg(jsonb_build_object(
    'exercise_id', ex,
    'sets', 3,
    'reps', 12,
    'weight', 0
  )), '[]'::jsonb)
  from jsonb_array_elements_text(exercise_ids) as ex
)
where exercise_ids is not null and exercises = '[]'::jsonb;

alter table public.workout_days drop column if exists exercise_ids;

-- ── 2. workouts: treino principal ────────────────────────────────────────────

alter table public.workouts
  add column if not exists is_primary boolean not null default false;

-- ── 3. weight_logs: histórico de peso por exercício ─────────────────────────

create table if not exists public.weight_logs (
  id         uuid        default gen_random_uuid() primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  exercise_id text       not null,
  weight     numeric     not null,
  logged_at  timestamptz not null default now()
);

create index if not exists weight_logs_user_exercise_idx
  on public.weight_logs (user_id, exercise_id, logged_at);

alter table public.weight_logs enable row level security;

drop policy if exists "weight_logs: user can read own" on public.weight_logs;
create policy "weight_logs: user can read own"
  on public.weight_logs for select
  using (auth.uid() = user_id);

drop policy if exists "weight_logs: user can insert own" on public.weight_logs;
create policy "weight_logs: user can insert own"
  on public.weight_logs for insert
  with check (auth.uid() = user_id);

-- ── 4. exercise_time_logs: histórico de tempo por exercício ────────────────

create table if not exists public.exercise_time_logs (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users(id) on delete cascade not null,
  exercise_id text        not null,
  seconds     int         not null,
  logged_at   timestamptz not null default now()
);

create index if not exists exercise_time_logs_user_exercise_idx
  on public.exercise_time_logs (user_id, exercise_id, logged_at);

alter table public.exercise_time_logs enable row level security;

drop policy if exists "exercise_time_logs: user can read own" on public.exercise_time_logs;
create policy "exercise_time_logs: user can read own"
  on public.exercise_time_logs for select
  using (auth.uid() = user_id);

drop policy if exists "exercise_time_logs: user can insert own" on public.exercise_time_logs;
create policy "exercise_time_logs: user can insert own"
  on public.exercise_time_logs for insert
  with check (auth.uid() = user_id);
