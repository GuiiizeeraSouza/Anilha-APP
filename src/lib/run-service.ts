import type { LatLng, Run } from '@/modules/running/types';

import { supabase } from './supabase';

const BASE_COLUMNS = 'id, started_at, distance_meters, duration_seconds, source, effort, split_seconds';

// A coluna "route" vem da migration 010. Se ela ainda não foi aplicada, o
// Supabase responde com estes códigos — aí tentamos de novo sem o trajeto, para
// não perder a corrida (nem impedir o histórico de carregar).
function isMissingRouteColumn(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42703' || // select de coluna inexistente
    error.code === 'PGRST204' || // insert com coluna fora do schema cache
    (error.message ?? '').includes('route')
  );
}

function toRun(r: any): Run {
  return {
    id: r.id as string,
    startedAt: r.started_at as string,
    distanceMeters: Number(r.distance_meters),
    durationSeconds: r.duration_seconds as number,
    source: r.source as Run['source'],
    effort: (r.effort as Run['effort']) ?? null,
    splitSeconds: Array.isArray(r.split_seconds) ? (r.split_seconds as number[]) : [],
    route: Array.isArray(r.route) ? (r.route as LatLng[][]) : [],
  };
}

export async function fetchRuns(userId: string): Promise<Run[]> {
  const query = (columns: string) =>
    supabase.from('runs').select(columns).eq('user_id', userId).order('started_at');

  let { data, error } = await query(`${BASE_COLUMNS}, route`);
  if (error && isMissingRouteColumn(error)) {
    console.warn('runs.route não existe — aplique a migration 010_runs_route.sql');
    ({ data, error } = await query(BASE_COLUMNS));
  }
  if (error) throw error;
  return (data ?? []).map(toRun);
}

export async function insertRun(userId: string, run: Run): Promise<void> {
  const row = {
    id: run.id,
    user_id: userId,
    started_at: run.startedAt,
    distance_meters: run.distanceMeters,
    duration_seconds: run.durationSeconds,
    source: run.source,
    effort: run.effort,
    split_seconds: run.splitSeconds,
  };
  let { error } = await supabase.from('runs').insert({ ...row, route: run.route });
  if (error && isMissingRouteColumn(error)) {
    console.warn('runs.route não existe — corrida salva sem trajeto. Aplique a migration 010_runs_route.sql');
    ({ error } = await supabase.from('runs').insert(row));
  }
  if (error) throw error;
}

export async function deleteRun(runId: string): Promise<void> {
  const { error } = await supabase.from('runs').delete().eq('id', runId);
  if (error) throw error;
}
