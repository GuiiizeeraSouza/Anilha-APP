import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { createCheckin, notifyFriendsWorkoutStarted } from '@/lib/friend-service';
import {
    cancelWorkoutNotification,
    requestNotificationPermissions,
    showWorkoutNotification,
} from '@/lib/notification-service';
import { MUSCLE_GROUPS } from '@/modules/workouts/data/muscle-groups';
import { useAllExercises } from '@/modules/workouts/hooks/use-all-exercises';
import { Container } from '@/shared/components/container';
import { useAuthStore } from '@/store/auth-store';
import { useWorkoutStore } from '@/store/workout-store';

function formatActiveTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);

  const workouts = useWorkoutStore((s) => s.workouts);
  const completedSessions = useWorkoutStore((s) => s.completedSessions);
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const updateWorkout = useWorkoutStore((s) => s.updateWorkout);
  const startActiveSession = useWorkoutStore((s) => s.startActiveSession);
  const clearActiveSession = useWorkoutStore((s) => s.clearActiveSession);
  const addCompletedSession = useWorkoutStore((s) => s.addCompletedSession);
  const addWeightLog = useWorkoutStore((s) => s.addWeightLog);
  const addExerciseTimeLog = useWorkoutStore((s) => s.addExerciseTimeLog);
  const allExercises = useAllExercises();

  // ── Timer da sessão (cabeçalho) ─────────────────────────────────────────
  const [activeElapsed, setActiveElapsed] = useState<number>(
    activeSession ? Math.floor((Date.now() - activeSession.startedAt) / 1000) : 0,
  );
  useEffect(() => {
    if (!activeSession) return;
    setActiveElapsed(Math.floor((Date.now() - activeSession.startedAt) / 1000));
    const id = setInterval(() => {
      setActiveElapsed(Math.floor((Date.now() - activeSession.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [activeSession?.startedAt]);

  const now = new Date();
  const TODAY_KEY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][now.getDay()];
  const TODAY_LABEL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][now.getDay()];
  const todayEntry =
    workouts
      .flatMap((w) => w.days.filter((d) => d.weekDays.includes(TODAY_KEY)).map((d) => ({ workout: w, day: d })))[0]
      ?? null;

  // Sem treino agendado hoje: cai pro treino marcado como "principal",
  // avançando pro próximo dia dele (round-robin pelas sessões já concluídas).
  const primaryWorkout = workouts.find((w) => w.isPrimary) ?? null;
  const fallbackEntry =
    primaryWorkout && primaryWorkout.days.length > 0
      ? (() => {
          const doneForWorkout = completedSessions.filter((s) => s.workoutId === primaryWorkout.id).length;
          const dayIndex = doneForWorkout % primaryWorkout.days.length;
          return { workout: primaryWorkout, day: primaryWorkout.days[dayIndex] };
        })()
      : null;

  const scheduledEntry = todayEntry ?? fallbackEntry;

  // Se já existe um treino em andamento, ele manda — mesmo que "hoje" mude.
  const sessionEntry = activeSession
    ? (() => {
        const w = workouts.find((wk) => wk.id === activeSession.workoutId);
        const d = w?.days.find((dy) => dy.id === activeSession.dayId);
        return w && d ? { workout: w, day: d } : null;
      })()
    : null;

  const displayEntry = sessionEntry ?? scheduledEntry;
  const isSessionActive = !!sessionEntry;

  const dateLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });

  async function handleStartWorkout() {
    if (!scheduledEntry || !user) return;
    startActiveSession(scheduledEntry.workout.id, scheduledEntry.day.id);
    const label = `${scheduledEntry.workout.name} · Treino ${scheduledEntry.day.label}`;
    requestNotificationPermissions().then((granted) => {
      if (granted) showWorkoutNotification(label, 0);
    });
    createCheckin(user.id, null, `🏋️ Iniciou um treino · ${label}`).catch(() => {});
    notifyFriendsWorkoutStarted(user.id, label);
  }

  function handleFinishWorkout() {
    if (!activeSession) return;
    cancelWorkoutNotification();
    addCompletedSession({
      workoutId: activeSession.workoutId,
      dayId: activeSession.dayId,
      completedAt: new Date().toISOString(),
      durationSeconds: activeElapsed,
    });
    clearActiveSession();
    setSelectedExerciseId(null);
    setDoneExerciseIds([]);
  }

  // Atualiza a notificação persistente a cada minuto de treino.
  useEffect(() => {
    if (!isSessionActive || !sessionEntry) return;
    if (activeElapsed > 0 && activeElapsed % 60 === 0) {
      showWorkoutNotification(`${sessionEntry.workout.name} · Treino ${sessionEntry.day.label}`, activeElapsed);
    }
  }, [activeElapsed]);

  // ── Exercício selecionado (card grande) ─────────────────────────────────
  const dayExercises = displayEntry
    ? displayEntry.day.exercises.flatMap((cfg) => {
        const ex = allExercises.find((e) => e.id === cfg.exerciseId);
        return ex ? [{ ex, cfg }] : [];
      })
    : [];

  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [doneExerciseIds, setDoneExerciseIds] = useState<string[]>([]);

  // Reseta a lista de concluídos quando o dia de treino exibido muda.
  useEffect(() => {
    setDoneExerciseIds([]);
    setSelectedExerciseId(null);
  }, [displayEntry?.day.id]);

  const pendingItems = dayExercises.filter((d) => !doneExerciseIds.includes(d.ex.id));
  const completedItems = dayExercises.filter((d) => doneExerciseIds.includes(d.ex.id));

  const heroId =
    selectedExerciseId && pendingItems.some((d) => d.ex.id === selectedExerciseId)
      ? selectedExerciseId
      : pendingItems[0]?.ex.id ?? null;
  const heroItem = pendingItems.find((d) => d.ex.id === heroId) ?? null;
  const otherItems = pendingItems.filter((d) => d.ex.id !== heroId);

  // Peso — editável direto no card principal
  const [weightInput, setWeightInput] = useState('');
  const [weightSavedPulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    setWeightInput(heroItem ? String(heroItem.cfg.weight) : '0');
  }, [heroItem?.ex.id]);

  function handleSaveWeight() {
    if (!displayEntry || !heroItem || !user) return;
    const parsed = parseFloat(weightInput.replace(',', '.'));
    const newWeight = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    weightSavedPulse.stopAnimation();
    weightSavedPulse.setValue(0);
    Animated.sequence([
      Animated.timing(weightSavedPulse, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(700),
      Animated.timing(weightSavedPulse, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
    updateWorkout({
      ...displayEntry.workout,
      days: displayEntry.workout.days.map((d) =>
        d.id === displayEntry.day.id
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.exerciseId === heroItem.ex.id ? { ...e, weight: newWeight } : e,
              ),
            }
          : d,
      ),
    });
    addWeightLog(heroItem.ex.id, newWeight);
  }

  // Cronômetro do exercício selecionado
  const [exerciseTimerStartedAt, setExerciseTimerStartedAt] = useState<number | null>(null);
  const [exerciseElapsed, setExerciseElapsed] = useState(0);

  useEffect(() => {
    setExerciseTimerStartedAt(null);
    setExerciseElapsed(0);
  }, [heroItem?.ex.id]);

  useEffect(() => {
    if (!exerciseTimerStartedAt) return;
    const startedAt = exerciseTimerStartedAt;
    const id = setInterval(() => {
      setExerciseElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [exerciseTimerStartedAt]);

  function handleExerciseStartOrFinish() {
    if (!heroItem || !user || !isSessionActive) return;
    if (!exerciseTimerStartedAt) {
      setExerciseTimerStartedAt(Date.now());
      return;
    }
    addExerciseTimeLog(heroItem.ex.id, exerciseElapsed);
    setExerciseTimerStartedAt(null);
    setExerciseElapsed(0);
    setDoneExerciseIds((prev) => [...prev, heroItem.ex.id]);
    const idx = pendingItems.findIndex((d) => d.ex.id === heroItem.ex.id);
    const next = pendingItems[idx + 1];
    setSelectedExerciseId(next ? next.ex.id : null);
  }

  function handleReopenExercise(exerciseId: string) {
    setDoneExerciseIds((prev) => prev.filter((id) => id !== exerciseId));
    setSelectedExerciseId(exerciseId);
  }

  const badgeLabel = isSessionActive
    ? '● Treino em andamento'
    : displayEntry === todayEntry
    ? `Hoje · ${TODAY_LABEL}`
    : '★ Treino principal';

  return (
    <Container>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-secondary-text text-sm mb-3 capitalize">{dateLabel}</Text>
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={isSessionActive ? handleFinishWorkout : handleStartWorkout}
              disabled={!isSessionActive && !scheduledEntry}
              activeOpacity={0.85}
              className="rounded-xl px-5 h-12 items-center justify-center"
              style={{
                backgroundColor: isSessionActive ? '#1E1E1E' : '#D62828',
                borderWidth: isSessionActive ? 1 : 0,
                borderColor: '#D62828',
                opacity: !isSessionActive && !scheduledEntry ? 0.4 : 1,
                elevation: 3, shadowColor: '#D62828', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
              }}
            >
              <Text className="font-bold text-sm" style={{ color: isSessionActive ? '#D62828' : '#fff' }}>
                {isSessionActive ? '■  Finalizar treino' : '▶  Iniciar treino'}
              </Text>
            </TouchableOpacity>

            <View className="bg-card rounded-xl px-4 h-12 items-center justify-center border border-border flex-row gap-2">
              <Text style={{ fontSize: 15 }}>⏱️</Text>
              <Text
                className="font-bold text-base"
                style={{ color: isSessionActive ? '#D62828' : '#505050' }}
              >
                {isSessionActive ? formatActiveTime(activeElapsed) : '00:00'}
              </Text>
            </View>
          </View>
        </View>

        {workouts.length === 0 ? (
          <View className="bg-card rounded-2xl p-5 border border-border items-center">
            <Text style={{ fontSize: 36, marginBottom: 12 }}>🏋️</Text>
            <Text className="text-text font-semibold text-base mb-1">Nenhum treino criado</Text>
            <Text className="text-secondary-text text-sm text-center leading-5">
              Crie seu primeiro treino na aba Treinos para ver o treino do dia aqui.
            </Text>
          </View>
        ) : !displayEntry ? (
          <View className="bg-card rounded-2xl border border-border overflow-hidden">
            <View className="p-6 items-center">
              <Text style={{ fontSize: 36, marginBottom: 12 }}>🛌</Text>
              <Text className="text-text font-semibold text-base mb-1">Dia de descanso</Text>
              <Text className="text-secondary-text text-sm text-center leading-5">
                Nenhum treino programado para hoje. Marque um treino como "principal" na aba
                Treinos para sempre ter algo por aqui.
              </Text>
            </View>
          </View>
        ) : (
          <>
            {/* Badge do treino/dia */}
            <View className="flex-row items-center gap-3 mb-4">
              <View className="w-9 h-9 rounded-xl bg-primary items-center justify-center">
                <Text className="text-white font-bold text-sm">{displayEntry.day.label}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-text font-bold text-base">{displayEntry.workout.name}</Text>
                <Text className="text-secondary-text text-xs">{badgeLabel}</Text>
              </View>
            </View>

            {/* Tudo concluído */}
            {!heroItem && completedItems.length > 0 && (
              <View className="bg-card rounded-2xl border border-border overflow-hidden mb-3">
                <View className="p-6 items-center">
                  <Text style={{ fontSize: 36, marginBottom: 12 }}>🎉</Text>
                  <Text className="text-text font-semibold text-base mb-1">Tudo concluído!</Text>
                  <Text className="text-secondary-text text-sm text-center leading-5">
                    Você concluiu todos os exercícios deste treino. Bom trabalho!
                  </Text>
                </View>
              </View>
            )}

            {/* Card do exercício selecionado */}
            {heroItem && (
              <View className="bg-card rounded-2xl border border-border overflow-hidden mb-3">
                {heroItem.ex.gif && (
                  <Image
                    source={heroItem.ex.gif}
                    style={{ width: '100%', height: 220 }}
                    contentFit="contain"
                  />
                )}
                <View className="p-4">
                  <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mb-1">
                    Exercício selecionado
                  </Text>
                  <Text className="text-text text-lg font-bold mb-1">{heroItem.ex.name}</Text>
                  <Text className="text-primary text-sm font-semibold mb-4">
                    {heroItem.cfg.sets}x{heroItem.cfg.reps}
                    {heroItem.cfg.weight > 0 ? ` · ${heroItem.cfg.weight}kg` : ''}
                  </Text>

                  {/* Peso — editável direto no card */}
                  <View className="flex-row items-center gap-2 mb-2">
                    <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider">
                      Peso utilizado (kg)
                    </Text>
                    <Animated.View
                      pointerEvents="none"
                      style={{
                        opacity: weightSavedPulse,
                        transform: [
                          {
                            translateY: weightSavedPulse.interpolate({
                              inputRange: [0, 1],
                              outputRange: [4, 0],
                            }),
                          },
                        ],
                        backgroundColor: '#4CAF50',
                        borderRadius: 20,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✓ Salvo</Text>
                    </Animated.View>
                  </View>
                  <View className="flex-row gap-2 mb-4">
                    <TextInput
                      value={weightInput}
                      onChangeText={setWeightInput}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor="#505050"
                      className="flex-1 bg-background rounded-xl px-3.5 text-text border border-border"
                      style={{ height: 44, fontSize: 15 }}
                    />
                    <TouchableOpacity
                      onPress={handleSaveWeight}
                      activeOpacity={0.85}
                      className="bg-primary rounded-xl px-5 items-center justify-center"
                    >
                      <Text className="text-white font-bold text-sm">Salvar</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Iniciar / concluir exercício */}
                  <TouchableOpacity
                    onPress={handleExerciseStartOrFinish}
                    disabled={!isSessionActive}
                    activeOpacity={0.85}
                    className="rounded-xl items-center justify-center py-3.5"
                    style={{
                      backgroundColor: exerciseTimerStartedAt ? '#1E1E1E' : '#D62828',
                      borderWidth: exerciseTimerStartedAt ? 1 : 0,
                      borderColor: '#D62828',
                      opacity: isSessionActive ? 1 : 0.4,
                    }}
                  >
                    <Text
                      className="font-bold text-sm"
                      style={{ color: exerciseTimerStartedAt ? '#D62828' : '#fff' }}
                    >
                      {exerciseTimerStartedAt
                        ? `✓  Concluir · ${formatActiveTime(exerciseElapsed)}`
                        : '▶  Iniciar exercício'}
                    </Text>
                  </TouchableOpacity>
                  {!isSessionActive && (
                    <Text className="text-secondary-text text-xs text-center mt-2">
                      Inicie o treino para acompanhar o tempo deste exercício.
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Próximos exercícios */}
            {otherItems.length > 0 && (
              <View className="mb-2">
                <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mb-2 mt-1">
                  Próximos
                </Text>
                {otherItems.map(({ ex, cfg }) => {
                  const muscle = MUSCLE_GROUPS.find((m) => m.id === ex.muscleGroupId);
                  return (
                    <TouchableOpacity
                      key={ex.id}
                      onPress={() => setSelectedExerciseId(ex.id)}
                      activeOpacity={0.8}
                      className="bg-card rounded-xl border border-border flex-row items-center gap-3 p-3 mb-2"
                    >
                      {ex.gif ? (
                        <Image
                          source={ex.gif}
                          style={{ width: 52, height: 52, borderRadius: 10 }}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          className="rounded-lg bg-background items-center justify-center"
                          style={{ width: 52, height: 52 }}
                        >
                          <Text style={{ fontSize: 20 }}>🏋️</Text>
                        </View>
                      )}
                      <View className="flex-1">
                        <Text className="text-text text-sm font-medium" numberOfLines={1}>
                          {ex.name}
                        </Text>
                        <Text className="text-secondary-text text-xs mt-0.5">
                          {cfg.sets}x{cfg.reps}
                          {cfg.weight > 0 ? ` · ${cfg.weight}kg` : ''}
                          {muscle ? ` · ${muscle.name}` : ''}
                        </Text>
                      </View>
                      <Text className="text-secondary-text text-lg">›</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Concluídos */}
            {completedItems.length > 0 && (
              <View className="mb-2">
                <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mb-2 mt-1">
                  Concluídos · {completedItems.length}
                </Text>
                {completedItems.map(({ ex, cfg }) => (
                  <TouchableOpacity
                    key={ex.id}
                    onPress={() => handleReopenExercise(ex.id)}
                    activeOpacity={0.8}
                    className="bg-card rounded-xl border border-border flex-row items-center gap-3 p-3 mb-2"
                    style={{ opacity: 0.6 }}
                  >
                    <View
                      className="w-6 h-6 rounded-full items-center justify-center bg-success"
                    >
                      <Text className="text-white text-xs font-bold">✓</Text>
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-text text-sm font-medium"
                        numberOfLines={1}
                        style={{ textDecorationLine: 'line-through' }}
                      >
                        {ex.name}
                      </Text>
                      <Text className="text-secondary-text text-xs mt-0.5">
                        {cfg.sets}x{cfg.reps}
                        {cfg.weight > 0 ? ` · ${cfg.weight}kg` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Container>
  );
}
