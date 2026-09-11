import { File } from 'expo-file-system';

import type { Exercise, Workout } from '@/modules/workouts/types';
import type { CompletedSession } from '@/store/workout-store';

import { supabase } from './supabase';

// ─── Fetch ──────────────────────────────────────────────────────────────────

export async function fetchWorkouts(userId: string): Promise<Workout[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('*, workout_days(*)')
    .eq('user_id', userId)
    .order('created_at');

  if (error) throw error;

  return (data ?? []).map((w: any) => ({
    id: w.id as string,
    name: w.name as string,
    createdAt: w.created_at as string,
    days: ((w.workout_days ?? []) as any[])
      .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))
      .map((d) => ({
        id: d.id as string,
        label: d.label as string,
        weekDays: (d.week_days ?? []) as string[],
        muscleGroupIds: (d.muscle_group_ids ?? []) as string[],
        exerciseIds: (d.exercise_ids ?? []) as string[],
      })),
  }));
}

export async function fetchCustomExercises(userId: string): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('custom_exercises')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');

  if (error) throw error;

  return (data ?? []).map((e: any) => ({
    id: e.id as string,
    name: e.name as string,
    muscleGroupId: e.muscle_group_id as string,
    isCustom: true,
  }));
}

export async function fetchExerciseGifOverrides(userId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('exercise_gif_overrides')
    .select('exercise_id, gif_url')
    .eq('user_id', userId);

  if (error) throw error;

  return Object.fromEntries(
    (data ?? []).map((row: any) => [row.exercise_id as string, row.gif_url as string])
  );
}

export async function fetchCompletedSessions(userId: string): Promise<CompletedSession[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('completed_at');

  if (error) throw error;

  return (data ?? []).map((s: any) => ({
    workoutId: s.workout_id as string,
    dayId: s.day_id as string,
    completedAt: s.completed_at as string,
    durationSeconds: s.duration_seconds as number,
  }));
}

// ─── Upsert / Insert / Delete ───────────────────────────────────────────────

export async function upsertWorkout(userId: string, workout: Workout): Promise<void> {
  const { error: workoutError } = await supabase.from('workouts').upsert({
    id: workout.id,
    user_id: userId,
    name: workout.name,
    created_at: workout.createdAt,
  });
  if (workoutError) throw workoutError;

  // Replace all days: delete existing then insert current
  await supabase.from('workout_days').delete().eq('workout_id', workout.id);

  if (workout.days.length > 0) {
    const { error: daysError } = await supabase.from('workout_days').insert(
      workout.days.map((d, i) => ({
        id: d.id,
        workout_id: workout.id,
        label: d.label,
        week_days: d.weekDays,
        muscle_group_ids: d.muscleGroupIds,
        exercise_ids: d.exerciseIds,
        sort_order: i,
      }))
    );
    if (daysError) throw daysError;
  }
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  const { error } = await supabase.from('workouts').delete().eq('id', workoutId);
  if (error) throw error;
}

export async function insertCustomExercise(userId: string, exercise: Exercise): Promise<void> {
  const { error } = await supabase.from('custom_exercises').insert({
    id: exercise.id,
    user_id: userId,
    name: exercise.name,
    muscle_group_id: exercise.muscleGroupId,
  });
  if (error) throw error;
}

export async function uploadExerciseGif(
  userId: string,
  exerciseId: string,
  uri: string,
  mimeType?: string,
): Promise<string> {
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'gif';
  const path = `${userId}/${exerciseId}.${ext}`;

  const file = new File(uri);
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('exercise-gifs')
    .upload(path, arrayBuffer, { contentType: mimeType ?? 'image/gif', upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('exercise-gifs').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function upsertExerciseGifOverride(
  userId: string,
  exerciseId: string,
  gifUrl: string,
): Promise<void> {
  const { error } = await supabase
    .from('exercise_gif_overrides')
    .upsert({ user_id: userId, exercise_id: exerciseId, gif_url: gifUrl });
  if (error) throw error;
}

export async function insertCompletedSession(
  userId: string,
  session: CompletedSession,
): Promise<void> {
  const { error } = await supabase.from('workout_sessions').insert({
    user_id: userId,
    workout_id: session.workoutId,
    day_id: session.dayId,
    completed_at: session.completedAt,
    duration_seconds: session.durationSeconds,
  });
  if (error) throw error;
}
