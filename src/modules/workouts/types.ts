export type MuscleGroup = {
  id: string;
  name: string;
  color: string;
};

export type Exercise = {
  id: string;
  name: string;
  muscleGroupId: string;
  // number = asset bundlado via require() (exercícios padrão);
  // string = URL de um gif enviado pelo usuário (Supabase Storage).
  gif?: number | string;
  isCustom?: boolean;
};

export type WorkoutDay = {
  id: string;
  label: string;
  muscleGroupIds: string[];
  exerciseIds: string[];
  weekDays: string[];
};

export type Workout = {
  id: string;
  name: string;
  days: WorkoutDay[];
  createdAt: string;
};

export type PresetTemplate = {
  id: string;
  name: string;
  description: string;
  days: {
    label: string;
    muscleGroupIds: string[];
  }[];
};
