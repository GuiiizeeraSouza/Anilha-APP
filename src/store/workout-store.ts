import { create } from 'zustand';

import * as workoutService from '@/lib/workout-service';
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
  // Bulk setters — used when loading from Supabase on login
  setWorkouts: (workouts: Workout[]) => void;
  setCustomExercises: (exercises: Exercise[]) => void;
  setCompletedSessions: (sessions: CompletedSession[]) => void;
  resetStore: () => void;
  // Mutating actions — update local state and sync to Supabase in background
  addWorkout: (workout: Workout) => void;
  removeWorkout: (id: string) => void;
  updateWorkout: (workout: Workout) => void;
  addCustomExercise: (exercise: Exercise) => void;
  addCompletedSession: (session: CompletedSession) => void;
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

  setWorkouts: (workouts) => set({ workouts }),
  setCustomExercises: (exercises) => set({ customExercises: exercises }),
  setCompletedSessions: (sessions) => set({ completedSessions: sessions }),
  resetStore: () => set({ workouts: [], customExercises: [], completedSessions: [], activeSession: null }),

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

  addCustomExercise: (exercise) => {
    set((state) => ({ customExercises: [...state.customExercises, exercise] }));
    const uid = getUserId();
    if (uid) workoutService.insertCustomExercise(uid, exercise).catch(console.error);
  },

  addCompletedSession: (session) => {
    set((state) => ({ completedSessions: [...state.completedSessions, session] }));
    const uid = getUserId();
    if (uid) workoutService.insertCompletedSession(uid, session).catch(console.error);
  },

  startActiveSession: (workoutId, dayId) =>
    set({ activeSession: { workoutId, dayId, startedAt: Date.now() } }),

  clearActiveSession: () => set({ activeSession: null }),
}));
