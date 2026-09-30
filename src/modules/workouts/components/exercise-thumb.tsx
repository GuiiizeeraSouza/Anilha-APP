import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import type { Exercise } from '../types';

interface ExerciseThumbProps {
  exercise: Exercise;
  size: number;
  radius?: number;
}

// Miniatura do gif do exercício (ou um ícone, quando ele ainda não tem gif).
export function ExerciseThumb({ exercise, size, radius = 8 }: ExerciseThumbProps) {
  if (exercise.gif) {
    return (
      <Image
        source={exercise.gif}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#121212' }}
        contentFit="cover"
      />
    );
  }
  return (
    <View
      className="items-center justify-center bg-background border border-border"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <Text style={{ fontSize: size * 0.4 }}>🏋️</Text>
    </View>
  );
}
