import type { WeightLog } from '@/lib/workout-service';
import type { Exercise, Workout, WorkoutDay } from '@/modules/workouts/types';

import { type DatedValue, lastValuePerDay, startOfDay } from './utils';

const DAY_MS = 24 * 60 * 60 * 1000;

// Sessões seguidas na mesma carga antes de sugerir aumento.
export const SESSIONS_TO_PROGRESS = 3;
// Depois de tantos dias sem fazer o exercício, sugere voltar mais leve.
const LONG_BREAK_DAYS = 21;
const LOWER_BODY = new Set(['legs', 'glutes']);

export type SuggestionKind = 'start' | 'increase' | 'keep' | 'deload' | 'scheduled' | 'bodyweight';

export interface Suggestion {
  kind: SuggestionKind;
  // Carga sugerida para a próxima sessão (null quando não há o que sugerir).
  weight: number | null;
  // Sessões que faltam na carga atual antes de subir (só para 'keep').
  sessionsLeft: number;
  daysSinceLast: number | null;
}

export interface ExerciseProgress {
  exercise: Exercise;
  // Rótulos dos dias de treino em que o exercício aparece ("Treino A", "Push · B"...).
  dayLabels: string[];
  sets: number;
  reps: number;
  // Carga configurada no treino (maior entre os dias, se houver diferença).
  targetWeight: number;
  series: DatedValue[];
  lastWeight: number | null;
  firstWeight: number | null;
  record: number | null;
  // Sessões seguidas, mais recentes, na carga atual.
  sessionsAtCurrent: number;
  suggestion: Suggestion;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

// Halteres leves sobem de 1 em 1 kg; barras e máquinas de 2,5 em 2,5 (~5%,
// ~7,5% para membros inferiores, que costumam progredir mais rápido).
export function weightIncrement(weight: number, muscleGroupId: string): number {
  if (weight < 10) return 1;
  if (weight < 30) return 2;
  const pct = LOWER_BODY.has(muscleGroupId) ? 0.075 : 0.05;
  return Math.max(2.5, roundTo(weight * pct, 2.5));
}

function roundLoad(weight: number): number {
  if (weight < 10) return roundTo(weight, 0.5);
  if (weight < 30) return roundTo(weight, 1);
  return roundTo(weight, 2.5);
}

function trailingSameValue(series: DatedValue[]): number {
  if (series.length === 0) return 0;
  const last = series[series.length - 1].value;
  let count = 0;
  for (let i = series.length - 1; i >= 0 && series[i].value === last; i--) count++;
  return count;
}

function suggest(
  series: DatedValue[],
  sessionsAtCurrent: number,
  targetWeight: number,
  muscleGroupId: string,
): Suggestion {
  const last = series[series.length - 1];
  if (!last) {
    return {
      kind: targetWeight > 0 ? 'start' : 'bodyweight',
      weight: null,
      sessionsLeft: SESSIONS_TO_PROGRESS,
      daysSinceLast: null,
    };
  }

  const daysSinceLast = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(new Date(last.date)).getTime()) / DAY_MS,
  );

  if (daysSinceLast > LONG_BREAK_DAYS) {
    return { kind: 'deload', weight: roundLoad(last.value * 0.9), sessionsLeft: 0, daysSinceLast };
  }

  // O usuário já subiu a carga do treino e ainda não a usou.
  if (targetWeight > last.value) {
    return { kind: 'scheduled', weight: targetWeight, sessionsLeft: 0, daysSinceLast };
  }

  if (sessionsAtCurrent >= SESSIONS_TO_PROGRESS) {
    return {
      kind: 'increase',
      weight: last.value + weightIncrement(last.value, muscleGroupId),
      sessionsLeft: 0,
      daysSinceLast,
    };
  }

  return {
    kind: 'keep',
    weight: last.value,
    sessionsLeft: SESSIONS_TO_PROGRESS - sessionsAtCurrent,
    daysSinceLast,
  };
}

export function dayLabel(workouts: Workout[], workout: Workout, day: WorkoutDay): string {
  return workouts.length > 1 ? `${workout.name} · ${day.label}` : `Treino ${day.label}`;
}

// Um item por exercício, mesmo que ele apareça em vários dias/treinos.
export function buildExerciseProgress(
  workouts: Workout[],
  weightLogs: WeightLog[],
  allExercises: Exercise[],
): ExerciseProgress[] {
  const logsByExercise = new Map<string, WeightLog[]>();
  weightLogs.forEach((log) => {
    const list = logsByExercise.get(log.exerciseId);
    if (list) list.push(log);
    else logsByExercise.set(log.exerciseId, [log]);
  });

  const byExercise = new Map<
    string,
    { exercise: Exercise; dayLabels: string[]; sets: number; reps: number; targetWeight: number }
  >();

  workouts.forEach((w) =>
    w.days.forEach((d) =>
      d.exercises.forEach((cfg) => {
        const label = dayLabel(workouts, w, d);
        const existing = byExercise.get(cfg.exerciseId);
        if (existing) {
          if (!existing.dayLabels.includes(label)) existing.dayLabels.push(label);
          existing.targetWeight = Math.max(existing.targetWeight, cfg.weight);
          return;
        }
        const exercise = allExercises.find((e) => e.id === cfg.exerciseId);
        if (!exercise) return;
        byExercise.set(cfg.exerciseId, {
          exercise,
          dayLabels: [label],
          sets: cfg.sets,
          reps: cfg.reps,
          targetWeight: cfg.weight,
        });
      }),
    ),
  );

  return [...byExercise.values()].map((item) => {
    const series = lastValuePerDay(logsByExercise.get(item.exercise.id) ?? [], (l) => l.weight);
    const sessionsAtCurrent = trailingSameValue(series);
    return {
      ...item,
      series,
      lastWeight: series.length > 0 ? series[series.length - 1].value : null,
      firstWeight: series.length > 0 ? series[0].value : null,
      record: series.length > 0 ? Math.max(...series.map((p) => p.value)) : null,
      sessionsAtCurrent,
      suggestion: suggest(series, sessionsAtCurrent, item.targetWeight, item.exercise.muscleGroupId),
    };
  });
}
