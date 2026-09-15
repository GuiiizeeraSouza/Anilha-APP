import { createCheckin, notifyFriendsWorkoutStarted } from '@/lib/friend-service';
import {
    cancelWorkoutNotification,
    requestNotificationPermissions,
    showWorkoutNotification,
} from '@/lib/notification-service';
import { MUSCLE_GROUPS } from '@/modules/workouts/data/muscle-groups';
import { useAllExercises } from '@/modules/workouts/hooks/use-all-exercises';
import type { Exercise, MuscleGroup, WorkoutExercise } from '@/modules/workouts/types';
import { useAuthStore } from '@/store/auth-store';
import { useWorkoutStore } from '@/store/workout-store';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

// ─── ExerciseGifCard ──────────────────────────────────────────────────────

type ExerciseGifCardProps = {
  ex: Exercise;
  config: WorkoutExercise;
  done: boolean;
  color: string;
  muscle: MuscleGroup | undefined;
  onToggle: () => void;
};

function ExerciseGifCard({ ex, config, done, color, muscle, onToggle }: ExerciseGifCardProps) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.85}
      className="bg-card rounded-xl mb-2.5 border overflow-hidden"
      style={{ borderColor: done ? color + '88' : '#2A2A2A' }}
    >
      <View className="flex-row items-center gap-3 p-4">
        <View
          className="w-6 h-6 rounded-full border-2 items-center justify-center"
          style={{
            borderColor: done ? color : '#3A3A3A',
            backgroundColor: done ? color : 'transparent',
          }}
        >
          {done && <Text className="text-white text-xs font-bold">✓</Text>}
        </View>

        <View className="flex-1">
          <Text
            className="text-base font-medium"
            style={{
              color: done ? '#606060' : '#FFFFFF',
              textDecorationLine: done ? 'line-through' : 'none',
            }}
          >
            {ex.name}{ex.isCustom ? ' ★' : ''}
          </Text>
          <View className="flex-row items-center gap-2 mt-0.5">
            {muscle && (
              <Text className="text-xs" style={{ color: done ? '#404040' : color }}>
                {muscle.name}
              </Text>
            )}
            <Text className="text-xs" style={{ color: done ? '#404040' : '#707070' }}>
              {config.sets}x{config.reps}{config.weight > 0 ? ` · ${config.weight}kg` : ''}
            </Text>
          </View>
        </View>
      </View>

      {ex.gif && (
        <Image
          source={ex.gif}
          style={{ width: '100%', height: 200, opacity: done ? 0.35 : 1 }}
          contentFit="contain"
        />
      )}
    </TouchableOpacity>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const { workoutId, dayId, fromCheckin } = useLocalSearchParams<{
    workoutId: string;
    dayId: string;
    fromCheckin?: string;
  }>();

  const user = useAuthStore((s) => s.user);
  const workouts = useWorkoutStore((s) => s.workouts);
  const addCompletedSession = useWorkoutStore((s) => s.addCompletedSession);
  const addExerciseTimeLog = useWorkoutStore((s) => s.addExerciseTimeLog);
  const startActiveSession = useWorkoutStore((s) => s.startActiveSession);
  const clearActiveSession = useWorkoutStore((s) => s.clearActiveSession);
  const allExercises = useAllExercises();

  // Active workout/day (can be swapped via "Trocar treino")
  const [currentWorkoutId, setCurrentWorkoutId] = useState(workoutId);
  const [currentDayId, setCurrentDayId] = useState(dayId);

  // Timer — driven by startedAt so it keeps ticking even after back navigation
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  // True when the user navigated back and is now resuming an existing session
  const isResumingRef = useRef<boolean>(false);

  // Elapsed time (seconds) at the last exercise marked as done — used to log
  // per-exercise duration for the evolution charts.
  const lastCheckpointRef = useRef<number>(0);

  // Exercise checklist
  const [doneIds, setDoneIds] = useState<string[]>([]);

  // Modals
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [stopMode, setStopMode] = useState<'finish' | 'abandon'>('finish');
  const [showChangePicker, setShowChangePicker] = useState(false);

  const workout = workouts.find((w) => w.id === currentWorkoutId);
  const day = workout?.days.find((d) => d.id === currentDayId);

  useEffect(() => {
    const snap = useWorkoutStore.getState().activeSession;
    const isResuming = snap !== null && snap.workoutId === workoutId && snap.dayId === dayId;
    isResumingRef.current = isResuming;

    if (isResuming) {
      startedAtRef.current = snap!.startedAt;
    } else {
      startedAtRef.current = Date.now();
      startActiveSession(workoutId, dayId);
    }

    setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── Workout start side-effects (skip on resume) ────────────────────────────
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current || !user || !workout || !day) return;
    if (isResumingRef.current) return;
    startedRef.current = true;

    const label = `${workout.name} · Treino ${day.label}`;

    // Show persistent local notification
    requestNotificationPermissions().then((granted) => {
      if (granted) showWorkoutNotification(label, 0);
    });

    // Post timeline entry only when NOT coming from a check-in
    // (check-in already created the timeline entry in ranking.tsx)
    if (fromCheckin !== 'true') {
      createCheckin(user.id, null, `🏋️ Iniciou um treino · ${label}`).catch(() => {});
    }

    // Notify all friends via Edge Function
    notifyFriendsWorkoutStarted(user.id, label);
  }, [user, workout, day]);

  // Update notification every 60 seconds
  useEffect(() => {
    if (elapsed > 0 && elapsed % 60 === 0 && workout && day) {
      showWorkoutNotification(`${workout.name} · Treino ${day.label}`, elapsed);
    }
  }, [elapsed]);

  // Reset checklist when workout changes
  useEffect(() => {
    setDoneIds([]);
    lastCheckpointRef.current = elapsed;
  }, [currentWorkoutId, currentDayId]);

  if (!workout || !day) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-text text-lg font-bold mb-2">Treino não encontrado</Text>
        <Text className="text-secondary-text text-sm text-center mb-6">
          O treino selecionado não existe mais.
        </Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} className="bg-primary rounded-xl px-6 py-3">
          <Text className="text-white font-bold text-sm">Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const exercises = day.exercises.flatMap((config) => {
    const ex = allExercises.find((e) => e.id === config.exerciseId);
    return ex ? [{ ex, config }] : [];
  });

  const doneCount = exercises.filter(({ ex }) => doneIds.includes(ex.id)).length;
  const progress = exercises.length > 0 ? doneCount / exercises.length : 0;

  const muscleGroupNames = day.muscleGroupIds
    .map((id) => MUSCLE_GROUPS.find((m) => m.id === id)?.name ?? id)
    .join(' + ');

  const allWorkoutDays = workouts.flatMap((w) => w.days.map((d) => ({ workout: w, day: d })));

  function toggleDone(exId: string) {
    setDoneIds((prev) => {
      const alreadyDone = prev.includes(exId);
      if (!alreadyDone && user) {
        const seconds = Math.max(0, elapsed - lastCheckpointRef.current);
        lastCheckpointRef.current = elapsed;
        addExerciseTimeLog(exId, seconds);
      }
      return alreadyDone ? prev.filter((id) => id !== exId) : [...prev, exId];
    });
  }

  function handleAbandon() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    clearActiveSession();
    cancelWorkoutNotification();
    router.back();
  }

  function handleFinish() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    clearActiveSession();
    cancelWorkoutNotification();
    addCompletedSession({
      workoutId: currentWorkoutId,
      dayId: currentDayId,
      completedAt: new Date().toISOString(),
      durationSeconds: elapsed,
    });
    router.back();
  }

  function handleChangeWorkout(newWorkoutId: string, newDayId: string) {
    setCurrentWorkoutId(newWorkoutId);
    setCurrentDayId(newDayId);
    setShowChangePicker(false);
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-14 pb-4 border-b border-border">
        <View className="flex-1">
          <Text className="text-text text-lg font-bold" numberOfLines={1}>
            {workout.name} · Treino {day.label}
          </Text>
          {muscleGroupNames ? (
            <Text className="text-secondary-text text-xs mt-0.5">{muscleGroupNames}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          className="w-9 h-9 rounded-full bg-card border border-border items-center justify-center"
        >
          <Text className="text-secondary-text">‹</Text>
        </TouchableOpacity>
      </View>

      {/* Timer */}
      <View className="items-center pt-8 pb-6 border-b border-border">
        <Text className="text-secondary-text text-xs uppercase tracking-widest mb-3">
          Tempo de treino
        </Text>
        <Text
          className="text-text font-bold"
          style={{ fontSize: 64, lineHeight: 72, letterSpacing: 2 }}
        >
          {formatTime(elapsed)}
        </Text>

        {/* Progress bar */}
        {exercises.length > 0 && (
          <View className="flex-row items-center gap-3 mt-4">
            <View className="w-40 h-1.5 bg-border rounded-full overflow-hidden">
              <View
                className="h-full bg-primary rounded-full"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </View>
            <Text className="text-secondary-text text-xs">
              {doneCount}/{exercises.length}
            </Text>
          </View>
        )}
      </View>

      {/* Exercise list */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mb-3">
          Exercícios
        </Text>

        {exercises.length === 0 ? (
          <Text className="text-secondary-text text-sm">
            Nenhum exercício neste treino.
          </Text>
        ) : (
          exercises.map(({ ex, config }) => {
            const done = doneIds.includes(ex.id);
            const muscle = MUSCLE_GROUPS.find((m) => m.id === ex.muscleGroupId);
            const color = muscle?.color ?? '#D62828';
            return (
              <ExerciseGifCard
                key={ex.id}
                ex={ex}
                config={config}
                done={done}
                color={color}
                muscle={muscle}
                onToggle={() => toggleDone(ex.id)}
              />
            );
          })
        )}
      </ScrollView>

      {/* Footer */}
      <View className="px-5 pb-8 pt-3 border-t border-border gap-2">
        <TouchableOpacity
          onPress={() => setShowChangePicker(true)}
          activeOpacity={0.7}
          className="h-11 rounded-xl items-center justify-center border border-border"
        >
          <Text className="text-secondary-text text-sm font-medium">Trocar treino</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setStopMode('finish'); setShowStopConfirm(true); }}
          activeOpacity={0.85}
          className="h-14 rounded-xl items-center justify-center bg-primary"
          style={{ elevation: 4, shadowColor: '#D62828', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}
        >
          <Text className="text-white font-bold text-base">Finalizar treino</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setStopMode('abandon'); setShowStopConfirm(true); }}
          activeOpacity={0.6}
          className="items-center py-1"
        >
          <Text style={{ color: '#505050', fontSize: 13 }}>Abandonar treino</Text>
        </TouchableOpacity>
      </View>

      {/* ── Stop confirmation modal ────────────────────────────────────── */}
      <Modal
        visible={showStopConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStopConfirm(false)}
      >
        <View
          className="flex-1 items-center justify-center px-8"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
        >
          <View className="bg-card rounded-2xl p-6 w-full border border-border">
            <Text className="text-text font-bold text-lg mb-2">
              {stopMode === 'finish' ? 'Finalizar treino?' : 'Abandonar treino?'}
            </Text>
            <Text className="text-secondary-text text-sm mb-5 leading-5">
              {stopMode === 'finish'
                ? 'O treino será registrado como concluído. Bom trabalho!'
                : 'O treino será encerrado sem registro. Seu progresso desta sessão não será salvo.'}
            </Text>
            <View className="gap-2">
              <TouchableOpacity
                onPress={stopMode === 'finish' ? handleFinish : handleAbandon}
                activeOpacity={0.85}
                className="h-12 rounded-xl items-center justify-center bg-primary"
              >
                <Text className="text-white font-bold">
                  {stopMode === 'finish' ? 'Sim, finalizar' : 'Sim, abandonar'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowStopConfirm(false)}
                activeOpacity={0.7}
                className="h-12 rounded-xl items-center justify-center border border-border"
              >
                <Text className="text-secondary-text font-medium">Continuar treinando</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Change workout modal ───────────────────────────────────────── */}
      <Modal
        visible={showChangePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChangePicker(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}>
          <View className="bg-card rounded-t-3xl" style={{ maxHeight: '70%' }}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
              <Text className="text-text font-bold text-lg">Trocar treino</Text>
              <TouchableOpacity
                onPress={() => setShowChangePicker(false)}
                activeOpacity={0.7}
                className="w-8 h-8 rounded-full bg-background items-center justify-center"
              >
                <Text className="text-secondary-text">✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {allWorkoutDays.length === 0 ? (
                <Text className="text-secondary-text text-sm text-center py-6">
                  Nenhum treino criado ainda.
                </Text>
              ) : (
                allWorkoutDays.map(({ workout: w, day: d }) => {
                  const isActive = w.id === currentWorkoutId && d.id === currentDayId;
                  const names = d.muscleGroupIds
                    .map((id) => MUSCLE_GROUPS.find((m) => m.id === id)?.name ?? id)
                    .join(' + ');
                  return (
                    <TouchableOpacity
                      key={`${w.id}-${d.id}`}
                      onPress={() => handleChangeWorkout(w.id, d.id)}
                      activeOpacity={0.7}
                      className="flex-row items-center gap-3 p-3 rounded-xl mb-2 border"
                      style={{
                        backgroundColor: isActive ? '#D6282818' : '#121212',
                        borderColor: isActive ? '#D62828' : '#2A2A2A',
                      }}
                    >
                      <View className="w-9 h-9 rounded-lg bg-primary items-center justify-center">
                        <Text className="text-white font-bold text-xs">{d.label}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-text font-semibold text-sm">{w.name}</Text>
                        <Text className="text-secondary-text text-xs">
                          {names || 'Sem grupos musculares'}
                        </Text>
                      </View>
                      {isActive && (
                        <View className="bg-primary rounded-md px-2 py-0.5">
                          <Text className="text-white text-xs font-bold">atual</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
