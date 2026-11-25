import { createCheckin, notifyFriendsWorkoutStarted } from '@/lib/friend-service';
import { startWorkoutTimer } from '@/lib/workout-timer';
import { type CompletedSession, useWorkoutStore } from '@/store/workout-store';

import type { Workout, WorkoutDay } from './types';

const WEEKDAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

export interface ScheduledEntry {
  workout: Workout;
  day: WorkoutDay;
  // true = dia programado para hoje; false = próximo dia do treino principal.
  isToday: boolean;
}

// Treino a fazer hoje: o dia programado para o dia da semana; sem nada
// programado, o próximo dia do treino principal (round-robin pelas sessões
// já concluídas dele).
export function getScheduledEntry(
  workouts: Workout[],
  completedSessions: CompletedSession[],
  date = new Date(),
): ScheduledEntry | null {
  const todayKey = WEEKDAY_KEYS[date.getDay()];
  for (const workout of workouts) {
    const day = workout.days.find((d) => d.weekDays.includes(todayKey));
    if (day) return { workout, day, isToday: true };
  }

  const primary = workouts.find((w) => w.isPrimary);
  if (!primary || primary.days.length === 0) return null;
  const done = completedSessions.filter((s) => s.workoutId === primary.id).length;
  return { workout: primary, day: primary.days[done % primary.days.length], isToday: false };
}

export function workoutLabel(workout: Workout, day: WorkoutDay): string {
  return `${workout.name} · Treino ${day.label}`;
}

// Inicia a sessão com todos os efeitos colaterais: cronômetro na notificação /
// Live Activity, post na timeline e aviso aos amigos.
export function startWorkoutSession(userId: string, workout: Workout, day: WorkoutDay): void {
  const { startActiveSession } = useWorkoutStore.getState();
  startActiveSession(workout.id, day.id);
  const startedAt = useWorkoutStore.getState().activeSession?.startedAt ?? Date.now();
  const label = workoutLabel(workout, day);
  startWorkoutTimer(label, startedAt);
  createCheckin(userId, null, `🏋️ Iniciou um treino · ${label}`).catch(() => {});
  notifyFriendsWorkoutStarted(userId, label);
}
