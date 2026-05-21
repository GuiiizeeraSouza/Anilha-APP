import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#121212' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="home" />
      <Stack.Screen name="ranking" />
      <Stack.Screen name="profile" />
      <Stack.Screen
        name="create-workout"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="manage-workouts" />
      <Stack.Screen name="active-workout" />
    </Stack>
  );
}
