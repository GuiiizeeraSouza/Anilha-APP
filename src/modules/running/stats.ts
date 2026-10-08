import { startOfWeek } from '@/modules/evolution/utils';

import type { Run } from './types';
import { paceOf } from './utils';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function timeOf(run: Run): number {
  return new Date(run.startedAt).getTime();
}

export function runsSince(runs: Run[], sinceMs: number): Run[] {
  return runs.filter((r) => timeOf(r) >= sinceMs);
}

export function totalMeters(runs: Run[]): number {
  return runs.reduce((acc, r) => acc + r.distanceMeters, 0);
}

export function totalSeconds(runs: Run[]): number {
  return runs.reduce((acc, r) => acc + r.durationSeconds, 0);
}

export function thisWeekRuns(runs: Run[], now = new Date()): Run[] {
  return runsSince(runs, startOfWeek(now).getTime());
}

export function thisMonthRuns(runs: Run[], now = new Date()): Run[] {
  return runsSince(runs, new Date(now.getFullYear(), now.getMonth(), 1).getTime());
}

// Km por semana (segunda a domingo), das mais antigas para a atual.
export function weeklyMeters(runs: Run[], weeks: number, now = new Date()): { weekStart: Date; meters: number }[] {
  const monday = startOfWeek(now).getTime();
  return Array.from({ length: weeks }, (_, i) => {
    const start = monday - (weeks - 1 - i) * WEEK_MS;
    const meters = totalMeters(runs.filter((r) => timeOf(r) >= start && timeOf(r) < start + WEEK_MS));
    return { weekStart: new Date(start), meters };
  });
}

export interface RunRecords {
  longest: Run | null; // maior distância
  fastest: Run | null; // melhor pace (corridas de pelo menos 1 km)
  longestTime: Run | null; // maior duração
  bestWeekMeters: number;
}

export function personalRecords(runs: Run[]): RunRecords {
  let longest: Run | null = null;
  let fastest: Run | null = null;
  let longestTime: Run | null = null;
  for (const run of runs) {
    if (!longest || run.distanceMeters > longest.distanceMeters) longest = run;
    if (!longestTime || run.durationSeconds > longestTime.durationSeconds) longestTime = run;
    const pace = paceOf(run.distanceMeters, run.durationSeconds);
    const bestPace = fastest ? paceOf(fastest.distanceMeters, fastest.durationSeconds) : null;
    if (run.distanceMeters >= 1000 && pace !== null && (bestPace === null || pace < bestPace)) fastest = run;
  }

  const byWeek = new Map<number, number>();
  for (const run of runs) {
    const key = startOfWeek(new Date(run.startedAt)).getTime();
    byWeek.set(key, (byWeek.get(key) ?? 0) + run.distanceMeters);
  }
  const bestWeekMeters = Math.max(0, ...byWeek.values());

  return { longest, fastest, longestTime, bestWeekMeters };
}
