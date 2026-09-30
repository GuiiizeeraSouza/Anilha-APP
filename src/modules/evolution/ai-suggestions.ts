import AsyncStorage from '@react-native-async-storage/async-storage';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { ExerciseTimeLog, WeightLog } from '@/lib/workout-service';
import { MUSCLE_GROUPS } from '@/modules/workouts/data/muscle-groups';
import type { Exercise, Workout } from '@/modules/workouts/types';
import type { CompletedSession } from '@/store/workout-store';

import { computeStreak, lastValuePerDay, startOfDay, startOfWeek } from './utils';

// Mesmo formato que a Edge Function supabase/functions/ai-weekly-suggestions espera.

export type AiSuggestionKind = 'increase' | 'maintain' | 'decrease' | 'consistency' | 'recovery' | 'tip';

export interface AiSuggestion {
  kind: AiSuggestionKind;
  title: string;
  detail: string;
  exerciseName: string | null;
  currentWeightKg: number | null;
  suggestedWeightKg: number | null;
}

interface SuggestionsInput {
  week: {
    today: string;
    weekday: string;
    daysTrainedThisWeek: number;
    daysScheduledPerWeek: number;
    minutesThisWeek: number;
    streakDays: number;
  };
  days: {
    workout: string;
    day: string;
    muscles: string[];
    weekdays: string[];
    sessionsLast4Weeks: number;
    daysSinceLastSession: number | null;
    avgMinutes: number | null;
  }[];
  exercises: {
    name: string;
    muscle: string;
    days: string[];
    sets: number;
    reps: number;
    currentWeightKg: number;
    weightHistory: { date: string; kg: number }[];
    timesDoneLast4Weeks: number;
  }[];
}

interface TrainingData {
  workouts: Workout[];
  completedSessions: CompletedSession[];
  weightLogs: WeightLog[];
  timeLogs: ExerciseTimeLog[];
  allExercises: Exercise[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const WEEK_DAY_KEYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
const HISTORY_POINTS = 8;

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function muscleName(id: string): string {
  return MUSCLE_GROUPS.find((m) => m.id === id)?.name ?? id;
}

// Semana atual (segunda-feira) — as sugestões ficam salvas por semana.
export function currentWeekKey(): string {
  return isoDate(startOfWeek(new Date()));
}

// Tem histórico suficiente para a IA dizer algo útil?
export function hasEnoughDataForSuggestions(data: Pick<TrainingData, 'completedSessions' | 'weightLogs'>): boolean {
  return data.completedSessions.length > 0 || data.weightLogs.length > 0;
}

export function buildSuggestionsInput(data: TrainingData): SuggestionsInput {
  const { workouts, completedSessions, weightLogs, timeLogs, allExercises } = data;
  const now = new Date();
  const today = startOfDay(now);
  const monday = startOfWeek(now);
  const fourWeeksAgo = today.getTime() - 28 * DAY_MS;

  const weekSessions = completedSessions.filter((s) => new Date(s.completedAt).getTime() >= monday.getTime());

  const days = workouts.flatMap((w) =>
    w.days.map((d) => {
      const sessions = completedSessions
        .filter((s) => s.workoutId === w.id && s.dayId === d.id)
        .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
      const last = sessions[sessions.length - 1];
      return {
        workout: w.name,
        day: d.label,
        muscles: d.muscleGroupIds.map(muscleName),
        weekdays: d.weekDays,
        sessionsLast4Weeks: sessions.filter((s) => new Date(s.completedAt).getTime() >= fourWeeksAgo).length,
        daysSinceLastSession: last
          ? Math.round((today.getTime() - startOfDay(new Date(last.completedAt)).getTime()) / DAY_MS)
          : null,
        avgMinutes:
          sessions.length > 0
            ? Math.round(sessions.reduce((acc, s) => acc + s.durationSeconds, 0) / sessions.length / 60)
            : null,
      };
    }),
  );

  // Um item por exercício, mesmo que ele apareça em mais de um dia de treino.
  const byExercise = new Map<string, SuggestionsInput['exercises'][number]>();
  workouts.forEach((w) =>
    w.days.forEach((d) =>
      d.exercises.forEach((cfg) => {
        const existing = byExercise.get(cfg.exerciseId);
        const dayName = `${w.name} · ${d.label}`;
        if (existing) {
          existing.days.push(dayName);
          return;
        }
        const ex = allExercises.find((e) => e.id === cfg.exerciseId);
        if (!ex) return;
        byExercise.set(cfg.exerciseId, {
          name: ex.name,
          muscle: muscleName(ex.muscleGroupId),
          days: [dayName],
          sets: cfg.sets,
          reps: cfg.reps,
          currentWeightKg: cfg.weight,
          weightHistory: lastValuePerDay(
            weightLogs.filter((l) => l.exerciseId === cfg.exerciseId),
            (l) => l.weight,
          )
            .slice(-HISTORY_POINTS)
            .map((p) => ({ date: isoDate(new Date(p.date)), kg: p.value })),
          timesDoneLast4Weeks: timeLogs.filter(
            (l) => l.exerciseId === cfg.exerciseId && new Date(l.loggedAt).getTime() >= fourWeeksAgo,
          ).length,
        });
      }),
    ),
  );

  return {
    week: {
      today: isoDate(now),
      weekday: WEEKDAY_NAMES[now.getDay()],
      daysTrainedThisWeek: new Set(weekSessions.map((s) => new Date(s.completedAt).toDateString())).size,
      daysScheduledPerWeek: WEEK_DAY_KEYS.filter((key) =>
        workouts.some((w) => w.days.some((d) => d.weekDays.includes(key))),
      ).length,
      minutesThisWeek: Math.round(weekSessions.reduce((acc, s) => acc + s.durationSeconds, 0) / 60),
      streakDays: computeStreak(completedSessions.map((s) => s.completedAt)),
    },
    days,
    // Exercícios com histórico primeiro — são os que a IA consegue analisar.
    exercises: [...byExercise.values()].sort(
      (a, b) => b.weightHistory.length + b.timesDoneLast4Weeks - (a.weightHistory.length + a.timesDoneLast4Weeks),
    ),
  };
}

export async function fetchWeeklySuggestions(input: SuggestionsInput): Promise<AiSuggestion[]> {
  const { data, error } = await supabase.functions.invoke<{ suggestions: AiSuggestion[] }>(
    'ai-weekly-suggestions',
    { body: input },
  );
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response;
      // Nossa função responde { error }; o gateway do Supabase usa { message } ou { msg }.
      const body = (await response.json().catch(() => null)) as
        | { error?: string; message?: string; msg?: string }
        | null;
      if (body?.error) throw new Error(body.error);
      if (response.status === 404) {
        throw new Error('A função de sugestões ainda não foi publicada no Supabase (ai-weekly-suggestions).');
      }
      if (response.status === 401) {
        throw new Error('Sua sessão expirou. Saia e entre novamente na conta.');
      }
      const detail = body?.message ?? body?.msg;
      throw new Error(`Erro ${response.status} ao gerar sugestões${detail ? `: ${detail}` : '.'}`);
    }
    console.error('ai-weekly-suggestions', error);
    throw new Error('Não foi possível falar com o servidor de sugestões. Verifique sua conexão e tente novamente.');
  }
  return data?.suggestions ?? [];
}

// ── Cache local: uma geração por semana (o usuário pode atualizar manualmente) ──

export interface CachedSuggestions {
  weekKey: string;
  generatedAt: string;
  suggestions: AiSuggestion[];
}

function cacheKey(userId: string): string {
  return `ai-weekly-suggestions:v1:${userId}`;
}

export async function loadCachedSuggestions(userId: string): Promise<CachedSuggestions | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    return raw ? (JSON.parse(raw) as CachedSuggestions) : null;
  } catch {
    return null;
  }
}

export async function saveCachedSuggestions(userId: string, value: CachedSuggestions): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(value));
  } catch {
    // Cache é só conveniência — sem ele o usuário apenas gera de novo.
  }
}
