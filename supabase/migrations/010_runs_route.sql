-- ============================================================
-- 010_runs_route.sql  –  Trajeto (mapa) das corridas
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- Requires 009_runs.sql.
-- ============================================================

-- Trajeto simplificado, um trecho por período em movimento:
-- [[[lat, lon], [lat, lon], ...], [[lat, lon], ...]]
-- Vazio para corridas na esteira ou registradas manualmente.
alter table public.runs
  add column if not exists route jsonb not null default '[]'::jsonb;
