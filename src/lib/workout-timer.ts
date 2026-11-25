import {
  cancelWorkoutNotification,
  requestNotificationPermissions,
  showWorkoutNotification,
} from './notification-service';

// Android/web: notificação fixa com o tempo em texto, reescrita a cada minuto
// enquanto o app está aberto. No iPhone, ver workout-timer.ios.ts (Live Activity).

function elapsedSeconds(startedAt: number): number {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

export async function startWorkoutTimer(label: string, startedAt: number): Promise<void> {
  if (await requestNotificationPermissions()) {
    await showWorkoutNotification(label, elapsedSeconds(startedAt));
  }
}

// Chamado a cada minuto de treino pelas telas.
export async function refreshWorkoutTimer(label: string, startedAt: number): Promise<void> {
  await showWorkoutNotification(label, elapsedSeconds(startedAt));
}

export async function stopWorkoutTimer(): Promise<void> {
  await cancelWorkoutNotification();
}
