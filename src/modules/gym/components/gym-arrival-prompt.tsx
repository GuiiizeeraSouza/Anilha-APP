import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Modal, Text, TouchableOpacity, View } from 'react-native';

import { getScheduledEntry, startWorkoutSession, workoutLabel } from '@/modules/workouts/schedule';
import { Colors } from '@/shared/theme/colors';
import { useAuthStore } from '@/store/auth-store';
import { useWorkoutStore } from '@/store/workout-store';

import { isAtGym } from '../arrival';
import { localDayKey, useGymStore } from '../gym-store';

// Enquanto o app está aberto, confere a posição de tempos em tempos.
const CHECK_INTERVAL_MS = 60_000;

// "Chegou na academia?" — aparece quando o Anilha é aberto (ou volta a ficar
// visível) perto da academia salva. No máximo uma vez por dia e nunca com um
// treino em andamento. Na web não existe localização com o app fechado, então
// o aviso é dentro do app.
export function GymArrivalPrompt() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const gym = useGymStore((s) => s.gym);
  const lastPromptDay = useGymStore((s) => s.lastPromptDay);
  const setLastPromptDay = useGymStore((s) => s.setLastPromptDay);
  const workouts = useWorkoutStore((s) => s.workouts);
  const completedSessions = useWorkoutStore((s) => s.completedSessions);
  const hasActiveSession = useWorkoutStore((s) => s.activeSession !== null);

  const [visible, setVisible] = useState(false);

  const entry = getScheduledEntry(workouts, completedSessions);
  const alreadyPromptedToday = lastPromptDay === localDayKey();
  const shouldCheck = !!gym && !!user && !!entry && !hasActiveSession && !alreadyPromptedToday;

  useEffect(() => {
    if (!shouldCheck || !gym) return;
    let cancelled = false;

    function check() {
      if (AppState.currentState !== 'active') return;
      isAtGym(gym!)
        .then((inside) => {
          if (!cancelled && inside) setVisible(true);
        })
        .catch(() => {
          // GPS indisponível ou negado: tenta de novo na próxima verificação.
        });
    }

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
  }, [shouldCheck, gym]);

  function close() {
    setLastPromptDay(localDayKey());
    setVisible(false);
  }

  function handleStart() {
    if (entry && user && !useWorkoutStore.getState().activeSession) {
      startWorkoutSession(user.id, entry.workout, entry.day);
    }
    close();
    router.navigate('/home');
  }

  if (!visible || !shouldCheck || !entry) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <View className="w-full bg-card rounded-2xl p-6 border border-border" style={{ maxWidth: 420 }}>
          <Text style={{ fontSize: 34 }}>💪</Text>
          <Text className="text-text text-lg font-bold mt-2">Chegou na academia?</Text>
          <Text className="text-secondary-text text-sm mt-1 leading-5">
            Treino de hoje: <Text className="text-text font-semibold">{workoutLabel(entry.workout, entry.day)}</Text>
          </Text>

          <TouchableOpacity
            onPress={handleStart}
            activeOpacity={0.85}
            className="h-12 rounded-xl items-center justify-center mt-5"
            style={{ backgroundColor: Colors.primary }}
          >
            <Text className="font-bold text-base" style={{ color: Colors.white }}>
              Iniciar treino
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={close} activeOpacity={0.7} className="h-11 items-center justify-center mt-2">
            <Text className="text-secondary-text text-sm font-semibold">Não estou na academia</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
