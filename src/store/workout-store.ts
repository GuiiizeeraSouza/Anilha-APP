import { create } from 'zustand';

import * as workoutService from '@/lib/workout-service';
import type { ExerciseTimeLog, WeightLog } from '@/lib/workout-service';
import type { Exercise, Workout } from '@/modules/workouts/types';
import { useAuthStore } from './auth-store';

export interface CompletedSession {
  workoutId: string;
  dayId: string;
  completedAt: string; // ISO date string
  durationSeconds: number;
}

export interface ActiveSession {
  workoutId: string;
  dayId: string;
  startedAt: number; // Date.now() ms timestamp
}

interface WorkoutState {
  workouts: Workout[];
  customExercises: Exercise[];
  completedSessions: CompletedSession[];
  activeSession: ActiveSession | null;
  // Gif enviado pelo usuário para exercícios que não têm um (padrão ou customizado),
  // por exercise id. Ver useAllExercises, que já aplica isso sobre a lista de exercícios.
  exerciseGifOverrides: Record<string, string>;
  // Histórico de peso/tempo por exercício — usado pelos gráficos da aba Evolução.
  weightLogs: WeightLog[];
  exerciseTimeLogs: ExerciseTimeLog[];
  // Bulk setters — used when loading from Supabase on login
  setWorkouts: (workouts: Workout[]) => void;
  setCustomExercises: (exercises: Exercise[]) => void;
  setCompletedSessions: (sessions: CompletedSession[]) => void;
  setExerciseGifOverrides: (overrides: Record<string, string>) => void;
  setWeightLogs: (logs: WeightLog[]) => void;
  setExerciseTimeLogs: (logs: ExerciseTimeLog[]) => void;
  resetStore: () => void;
  // Mutating actions — update local state and sync to Supabase in background
  addWorkout: (workout: Workout) => void;
  removeWorkout: (id: string) => void;
  updateWorkout: (workout: Workout) => void;
  setPrimaryWorkout: (id: string) => void;
  addCustomExercise: (exercise: Exercise) => void;
  setExerciseGifOverride: (exerciseId: string, gifUrl: string) => void;
  addCompletedSession: (session: CompletedSession) => void;
  addWeightLog: (exerciseId: string, weight: number) => void;
  addExerciseTimeLog: (exerciseId: string, seconds: number) => void;
  startActiveSession: (workoutId: string, dayId: string) => void;
  clearActiveSession: () => void;
}

function getUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  workouts: [],
  customExercises: [],
  completedSessions: [],
  activeSession: null,
  exerciseGifOverrides: {},
  weightLogs: [],
  exerciseTimeLogs: [],

  setWorkouts: (workouts) => set({ workouts }),
  setCustomExercises: (exercises) => set({ customExercises: exercises }),
  setCompletedSessions: (sessions) => set({ completedSessions: sessions }),
  setExerciseGifOverrides: (overrides) => set({ exerciseGifOverrides: overrides }),
  setWeightLogs: (logs) => set({ weightLogs: logs }),
  setExerciseTimeLogs: (logs) => set({ exerciseTimeLogs: logs }),
  resetStore: () =>
    set({
      workouts: [],
      customExercises: [],
      completedSessions: [],
      activeSession: null,
      exerciseGifOverrides: {},
      weightLogs: [],
      exerciseTimeLogs: [],
    }),

  addWorkout: (workout) => {
    set((state) => ({ workouts: [...state.workouts, workout] }));
    const uid = getUserId();
    if (uid) workoutService.upsertWorkout(uid, workout).catch(console.error);
  },

  removeWorkout: (id) => {
    set((state) => ({ workouts: state.workouts.filter((w) => w.id !== id) }));
    workoutService.deleteWorkout(id).catch(console.error);
  },

  updateWorkout: (workout) => {
    set((state) => ({
      workouts: state.workouts.map((w) => (w.id === workout.id ? workout : w)),
    }));
    const uid = getUserId();
    if (uid) workoutService.upsertWorkout(uid, workout).catch(console.error);
  },

  setPrimaryWorkout: (id) => {
    set((state) => ({
      workouts: state.workouts.map((w) => ({ ...w, isPrimary: w.id === id })),
    }));
    const uid = getUserId();
    if (uid) workoutService.setPrimaryWorkout(uid, id).catch(console.error);
  },

  addCustomExercise: (exercise) => {
    set((state) => ({ customExercises: [...state.customExercises, exercise] }));
    const uid = getUserId();
    if (uid) workoutService.insertCustomExercise(uid, exercise).catch(console.error);
  },

  setExerciseGifOverride: (exerciseId, gifUrl) => {
    set((state) => ({
      exerciseGifOverrides: { ...state.exerciseGifOverrides, [exerciseId]: gifUrl },
    }));
  },

  addCompletedSession: (session) => {
    set((state) => ({ completedSessions: [...state.completedSessions, session] }));
    const uid = getUserId();
    if (uid) workoutService.insertCompletedSession(uid, session).catch(console.error);
  },

  addWeightLog: (exerciseId, weight) => {
    const uid = getUserId();
    if (!uid) return;
    set((state) => ({
      weightLogs: [...state.weightLogs, { exerciseId, weight, loggedAt: new Date().toISOString() }],
    }));
    workoutService.insertWeightLog(uid, exerciseId, weight).catch(console.error);
  },

  addExerciseTimeLog: (exerciseId, seconds) => {
    const uid = getUserId();
    if (!uid) return;
    set((state) => ({
      exerciseTimeLogs: [...state.exerciseTimeLogs, { exerciseId, seconds, loggedAt: new Date().toISOString() }],
    }));
    workoutService.insertExerciseTimeLog(uid, exerciseId, seconds).catch(console.error);
  },

  startActiveSession: (workoutId, dayId) =>
    set({ activeSession: { workoutId, dayId, startedAt: Date.now() } }),

  clearActiveSession: () => set({ activeSession: null }),
}));
