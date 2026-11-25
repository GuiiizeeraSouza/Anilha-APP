import { Stack } from 'expo-router';

import { useWorkoutTitleTimer } from '@/lib/use-workout-title-timer';
import { GymArrivalPrompt } from '@/modules/gym/components/gym-arrival-prompt';

export default function AppLayout() {
  // Cronômetro do treino no título da aba (web) e aviso de chegada na academia.
  useWorkoutTitleTimer();

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#121212' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="create-workout"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="active-workout" />
        <Stack.Screen name="profile" />
      </Stack>
      <GymArrivalPrompt />
    </>
  );
}
