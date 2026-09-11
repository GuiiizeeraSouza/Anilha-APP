import { useMemo } from 'react';

import { useWorkoutStore } from '@/store/workout-store';
import { DEFAULT_EXERCISES } from '../data/muscle-groups';
import type { Exercise } from '../types';

// Exercícios padrão + customizados, com o gif substituído por um enviado
// pelo usuário (exerciseGifOverrides) quando o exercício ainda não tem um.
export function useAllExercises(): Exercise[] {
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const gifOverrides = useWorkoutStore((s) => s.exerciseGifOverrides);

  return useMemo(() => {
    const merged = [...DEFAULT_EXERCISES, ...customExercises];
    if (Object.keys(gifOverrides).length === 0) return merged;

    return merged.map((ex) => {
      const override = gifOverrides[ex.id];
      return override ? { ...ex, gif: override } : ex;
    });
  }, [customExercises, gifOverrides]);
}
