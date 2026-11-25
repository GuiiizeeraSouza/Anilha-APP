import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useWorkoutStore } from '@/store/workout-store';

function formatElapsed(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Web: sem notificação persistente no navegador, o cronômetro do treino em
// andamento vai para o título da aba ("⏱ 12:34 · Push · Treino A").
// Derivado de startedAt, então continua certo depois de recarregar a página.
export function useWorkoutTitleTimer() {
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const workouts = useWorkoutStore((s) => s.workouts);

  const workout = activeSession ? workouts.find((w) => w.id === activeSession.workoutId) : undefined;
  const day = workout?.days.find((d) => d.id === activeSession?.dayId);
  const label = workout && day ? `${workout.name} · Treino ${day.label}` : 'Treino';
  const startedAt = activeSession?.startedAt ?? null;

  useEffect(() => {
    if (Platform.OS !== 'web' || startedAt === null || typeof document === 'undefined') return;
    const originalTitle = document.title;

    function tick() {
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt!) / 1000));
      document.title = `⏱ ${formatElapsed(elapsed)} · ${label}`;
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      clearInterval(interval);
      document.title = originalTitle;
    };
  }, [startedAt, label]);
}
