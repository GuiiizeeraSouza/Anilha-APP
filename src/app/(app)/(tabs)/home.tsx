import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { createCheckin, notifyFriendsWorkoutStarted } from '@/lib/friend-service';
import {
    cancelWorkoutNotification,
    requestNotificationPermissions,
    showWorkoutNotification,
} from '@/lib/notification-service';
import { MUSCLE_GROUPS } from '@/modules/workouts/data/muscle-groups';
import { useAllExercises } from '@/modules/workouts/hooks/use-all-exercises';
import type { Exercise, WorkoutExercise } from '@/modules/workouts/types';
import { Container } from '@/shared/components/container';
import { Colors } from '@/shared/theme/colors';
import { useAuthStore } from '@/store/auth-store';
import { useWorkoutStore } from '@/store/workout-store';

const WEIGHT_STEP = 2.5;

function formatActiveTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

function secondsSince(startedAtMs: number): number {
  return Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
}

function formatWeight(kg: number): string {
  return String(Math.round(kg * 100) / 100).replace('.', ',');
}

function parseWeight(text: string): number | null {
  const n = parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

// ─── Linha de exercício (listas "Exercícios de hoje", "A seguir", "Concluídos") ──

type ExerciseRowProps = {
  ex: Exercise;
  cfg: WorkoutExercise;
  number: number;
  done?: boolean;
  actionLabel?: string;
  onPress?: () => void;
};

function ExerciseRow({ ex, cfg, number, done = false, actionLabel, onPress }: ExerciseRowProps) {
  const muscle = MUSCLE_GROUPS.find((m) => m.id === ex.muscleGroupId);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
      className="bg-card rounded-xl border border-border flex-row items-center gap-3 p-3 mb-2"
    >
      <View
        className="w-7 h-7 rounded-full items-center justify-center"
        style={{ backgroundColor: done ? Colors.success : Colors.background }}
      >
        <Text className="text-xs font-bold" style={{ color: done ? Colors.white : Colors.secondaryText }}>
          {done ? '✓' : number}
        </Text>
      </View>
      {ex.gif ? (
        <Image
          source={ex.gif}
          style={{ width: 44, height: 44, borderRadius: 8, opacity: done ? 0.4 : 1 }}
          contentFit="cover"
        />
      ) : (
        <View className="rounded-lg bg-background items-center justify-center" style={{ width: 44, height: 44 }}>
          <Text style={{ fontSize: 18, opacity: done ? 0.4 : 1 }}>🏋️</Text>
        </View>
      )}
      <View className="flex-1">
        <Text
          className="text-sm font-medium"
          numberOfLines={1}
          style={{
            color: done ? Colors.secondaryText : Colors.text,
            textDecorationLine: done ? 'line-through' : 'none',
          }}
        >
          {ex.name}
        </Text>
        <Text className="text-secondary-text text-xs mt-0.5" numberOfLines={1}>
          {cfg.sets} × {cfg.reps}
          {cfg.weight > 0 ? ` · ${formatWeight(cfg.weight)} kg` : ''}
          {muscle ? ` · ${muscle.name}` : ''}
        </Text>
      </View>
      {actionLabel ? (
        <Text className="text-secondary-text text-xs">{actionLabel}</Text>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={16} color={Colors.secondaryText} />
      ) : null}
    </TouchableOpacity>
  );
}

function SectionLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <View className="flex-row items-baseline justify-between mb-2 mt-2">
      <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider">{title}</Text>
      {hint ? <Text className="text-secondary-text" style={{ fontSize: 11 }}>{hint}</Text> : null}
    </View>
  );
}

// ─── Tela ────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);

  const workouts = useWorkoutStore((s) => s.workouts);
  const completedSessions = useWorkoutStore((s) => s.completedSessions);
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const doneExerciseIds = useWorkoutStore((s) => s.activeSessionDoneExerciseIds);
  const activeExerciseTimer = useWorkoutStore((s) => s.activeExerciseTimer);
  const updateWorkout = useWorkoutStore((s) => s.updateWorkout);
  const startActiveSession = useWorkoutStore((s) => s.startActiveSession);
  const clearActiveSession = useWorkoutStore((s) => s.clearActiveSession);
  const addCompletedSession = useWorkoutStore((s) => s.addCompletedSession);
  const addWeightLog = useWorkoutStore((s) => s.addWeightLog);
  const addExerciseTimeLog = useWorkoutStore((s) => s.addExerciseTimeLog);
  const markExerciseDone = useWorkoutStore((s) => s.markExerciseDone);
  const reopenExercise = useWorkoutStore((s) => s.reopenExercise);
  const setActiveExerciseTimer = useWorkoutStore((s) => s.setActiveExerciseTimer);
  const allExercises = useAllExercises();

  // ── Relógio ─────────────────────────────────────────────────────────────
  // Os cronômetros (treino e exercício) são derivados de timestamps salvos no
  // store; aqui só existe o "tick" de 1s que faz a tela redesenhar.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!activeSession) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeSession]);
  const activeElapsed = activeSession
    ? Math.max(0, Math.floor((nowMs - activeSession.startedAt) / 1000))
    : 0;

  // ── Qual treino mostrar ─────────────────────────────────────────────────
  const today = new Date();
  const TODAY_KEY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][today.getDay()];
  const TODAY_LABEL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][today.getDay()];
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

  const dateLabel = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const badgeLabel = isSessionActive
    ? 'Treino em andamento'
    : displayEntry === todayEntry
    ? `Programado para hoje · ${TODAY_LABEL}`
    : '★ Próximo do treino principal';

  // ── Exercícios ──────────────────────────────────────────────────────────
  const dayExercises = displayEntry
    ? displayEntry.day.exercises.flatMap((cfg) => {
        const ex = allExercises.find((e) => e.id === cfg.exerciseId);
        return ex ? [{ ex, cfg }] : [];
      })
    : [];
  const numberOf = (exerciseId: string) => dayExercises.findIndex((d) => d.ex.id === exerciseId) + 1;

  const pendingItems = dayExercises.filter((d) => !doneExerciseIds.includes(d.ex.id));
  const completedItems = dayExercises.filter((d) => doneExerciseIds.includes(d.ex.id));
  const allDone = dayExercises.length > 0 && pendingItems.length === 0;

  // Exercício atual: o escolhido pelo usuário (se ainda estiver pendente);
  // senão o que está com o cronômetro rodando (ex: app recarregado); senão o
  // primeiro pendente.
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const timedExerciseId = activeExerciseTimer?.exerciseId ?? null;
  const heroId =
    selectedExerciseId && pendingItems.some((d) => d.ex.id === selectedExerciseId)
      ? selectedExerciseId
      : timedExerciseId && pendingItems.some((d) => d.ex.id === timedExerciseId)
      ? timedExerciseId
      : pendingItems[0]?.ex.id ?? null;
  const heroItem = pendingItems.find((d) => d.ex.id === heroId) ?? null;
  const otherItems = pendingItems.filter((d) => d.ex.id !== heroId);

  // O cronômetro do exercício começa sozinho quando ele vira o exercício atual
  // — assim cada exercício tem um único botão ("Concluir exercício").
  useEffect(() => {
    if (!isSessionActive || !heroId) return;
    if (useWorkoutStore.getState().activeExerciseTimer?.exerciseId === heroId) return;
    setActiveExerciseTimer({ exerciseId: heroId, startedAt: Date.now() });
  }, [isSessionActive, heroId, setActiveExerciseTimer]);

  const exerciseTimerStartedAt =
    activeExerciseTimer && activeExerciseTimer.exerciseId === heroId ? activeExerciseTimer.startedAt : null;
  const exerciseElapsed = exerciseTimerStartedAt
    ? Math.max(0, Math.floor((nowMs - exerciseTimerStartedAt) / 1000))
    : 0;

  // Anima a troca do card principal sempre que outro exercício assume o destaque.
  const [heroAnim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    heroAnim.setValue(0);
    Animated.timing(heroAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [heroId, heroAnim]);

  // ── Carga do exercício atual ────────────────────────────────────────────
  // Rascunho atrelado ao exercício: trocar de exercício descarta o rascunho e
  // volta a mostrar a carga salva no treino.
  const [weightDraft, setWeightDraft] = useState<{ exerciseId: string; text: string } | null>(null);
  const weightText = heroItem
    ? weightDraft?.exerciseId === heroItem.ex.id
      ? weightDraft.text
      : formatWeight(heroItem.cfg.weight)
    : '';

  function changeWeight(text: string) {
    if (heroItem) setWeightDraft({ exerciseId: heroItem.ex.id, text });
  }

  function stepWeight(direction: 1 | -1) {
    const current = parseWeight(weightText) ?? 0;
    changeWeight(formatWeight(Math.max(0, current + direction * WEIGHT_STEP)));
  }

  // ── Ações ───────────────────────────────────────────────────────────────
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  async function handleStartWorkout() {
    if (!scheduledEntry || !user) return;
    setSelectedExerciseId(null);
    startActiveSession(scheduledEntry.workout.id, scheduledEntry.day.id);
    const label = `${scheduledEntry.workout.name} · Treino ${scheduledEntry.day.label}`;
    requestNotificationPermissions().then((granted) => {
      if (granted) showWorkoutNotification(label, 0);
    });
    createCheckin(user.id, null, `🏋️ Iniciou um treino · ${label}`).catch(() => {});
    notifyFriendsWorkoutStarted(user.id, label);
  }

  function handleCompleteExercise() {
    if (!heroItem || !displayEntry || !isSessionActive) return;

    // Salva a carga usada (e registra no histórico da aba Evolução).
    const weight = parseWeight(weightText) ?? heroItem.cfg.weight;
    if (weight !== heroItem.cfg.weight) {
      updateWorkout({
        ...displayEntry.workout,
        days: displayEntry.workout.days.map((d) =>
          d.id === displayEntry.day.id
            ? {
                ...d,
                exercises: d.exercises.map((e) =>
                  e.exerciseId === heroItem.ex.id ? { ...e, weight } : e,
                ),
              }
            : d,
        ),
      });
    }
    if (weight > 0) addWeightLog(heroItem.ex.id, weight);
    if (exerciseTimerStartedAt) {
      addExerciseTimeLog(heroItem.ex.id, secondsSince(exerciseTimerStartedAt));
    }

    markExerciseDone(heroItem.ex.id);
    setWeightDraft(null);
    const idx = pendingItems.findIndex((d) => d.ex.id === heroItem.ex.id);
    const next = pendingItems[idx + 1] ?? pendingItems.find((d) => d.ex.id !== heroItem.ex.id);
    setSelectedExerciseId(next ? next.ex.id : null);
  }

  function handleReopenExercise(exerciseId: string) {
    reopenExercise(exerciseId);
    setSelectedExerciseId(exerciseId);
  }

  function handleFinishWorkout() {
    if (!activeSession) return;
    cancelWorkoutNotification();
    addCompletedSession({
      workoutId: activeSession.workoutId,
      dayId: activeSession.dayId,
      completedAt: new Date().toISOString(),
      durationSeconds: secondsSince(activeSession.startedAt),
    });
    clearActiveSession();
    setSelectedExerciseId(null);
    setShowFinishConfirm(false);
  }

  function handleDiscardWorkout() {
    cancelWorkoutNotification();
    clearActiveSession();
    setSelectedExerciseId(null);
    setShowFinishConfirm(false);
  }

  // Atualiza a notificação persistente a cada minuto de treino.
  useEffect(() => {
    if (!sessionEntry) return;
    if (activeElapsed > 0 && activeElapsed % 60 === 0) {
      showWorkoutNotification(`${sessionEntry.workout.name} · Treino ${sessionEntry.day.label}`, activeElapsed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeElapsed]);

  const muscleNames = displayEntry
    ? displayEntry.day.muscleGroupIds
        .map((id) => MUSCLE_GROUPS.find((m) => m.id === id)?.name ?? id)
        .join(' + ')
    : '';
  const heroMuscle = heroItem ? MUSCLE_GROUPS.find((m) => m.id === heroItem.ex.muscleGroupId) : undefined;
  const progressPct = dayExercises.length > 0 ? (completedItems.length / dayExercises.length) * 100 : 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Container safe={false}>
      {/* Header */}
      <View className="flex-row items-center px-5 pt-14 pb-4 border-b border-border">
        <View className="flex-1">
          <Text className="text-text text-lg font-bold">Treino do dia</Text>
          <Text className="text-secondary-text text-xs capitalize">{dateLabel}</Text>
        </View>
        {isSessionActive && (
          <View
            className="flex-row items-center gap-2 rounded-full px-3.5 h-9 border"
            style={{ borderColor: Colors.primary, backgroundColor: '#D628281A' }}
          >
            <View className="w-2 h-2 rounded-full bg-primary" />
            <Text className="text-text font-bold text-base" style={{ fontVariant: ['tabular-nums'] }}>
              {formatActiveTime(activeElapsed)}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {workouts.length === 0 ? (
          <View className="bg-card rounded-2xl p-6 border border-border items-center">
            <Text style={{ fontSize: 36, marginBottom: 12 }}>🏋️</Text>
            <Text className="text-text font-semibold text-base mb-1">Nenhum treino criado</Text>
            <Text className="text-secondary-text text-sm text-center leading-5">
              Crie seu primeiro treino na aba Treinos para ver o treino do dia aqui.
            </Text>
          </View>
        ) : !displayEntry ? (
          <View className="bg-card rounded-2xl p-6 border border-border items-center">
            <Text style={{ fontSize: 36, marginBottom: 12 }}>🛌</Text>
            <Text className="text-text font-semibold text-base mb-1">Dia de descanso</Text>
            <Text className="text-secondary-text text-sm text-center leading-5">
              Nenhum treino programado para hoje. Marque um treino como &quot;principal&quot; na aba
              Treinos para sempre ter algo por aqui.
            </Text>
          </View>
        ) : (
          <>
            {/* Resumo do treino + progresso */}
            <View className="bg-card rounded-2xl border border-border p-4 mb-4">
              <View className="flex-row items-center gap-3">
                <View className="w-11 h-11 rounded-xl bg-primary items-center justify-center">
                  <Text className="text-white font-bold text-base">{displayEntry.day.label}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-secondary-text text-xs" numberOfLines={1}>
                    {badgeLabel}
                  </Text>
                  <Text className="text-text font-bold text-base" numberOfLines={1}>
                    {displayEntry.workout.name} · Treino {displayEntry.day.label}
                  </Text>
                  <Text className="text-secondary-text text-xs mt-0.5" numberOfLines={1}>
                    {muscleNames ? `${muscleNames} · ` : ''}
                    {dayExercises.length} {dayExercises.length === 1 ? 'exercício' : 'exercícios'}
                  </Text>
                </View>
              </View>

              {isSessionActive && dayExercises.length > 0 && (
                <View className="mt-4">
                  <View className="flex-row justify-between mb-1.5">
                    <Text className="text-secondary-text text-xs">Progresso</Text>
                    <Text className="text-text text-xs font-semibold">
                      {completedItems.length} de {dayExercises.length} concluídos
                    </Text>
                  </View>
                  <View className="h-2 bg-background rounded-full overflow-hidden">
                    <View className="h-full bg-primary rounded-full" style={{ width: `${progressPct}%` }} />
                  </View>
                </View>
              )}
            </View>

            {!isSessionActive ? (
              /* ── Antes de começar: só a lista do que vai ser feito ── */
              <>
                <SectionLabel title="Exercícios de hoje" />
                {dayExercises.length === 0 ? (
                  <Text className="text-secondary-text text-sm">Nenhum exercício neste dia de treino.</Text>
                ) : (
                  dayExercises.map(({ ex, cfg }, i) => (
                    <ExerciseRow key={ex.id} ex={ex} cfg={cfg} number={i + 1} />
                  ))
                )}
                <Text className="text-secondary-text text-xs text-center leading-5 mt-3 px-4">
                  Toque em Iniciar treino quando começar. O tempo e o progresso ficam salvos mesmo se
                  você sair do app.
                </Text>
              </>
            ) : (
              /* ── Treino em andamento ── */
              <>
                {heroItem ? (
                  <Animated.View
                    style={{
                      opacity: heroAnim,
                      transform: [
                        { translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
                      ],
                    }}
                  >
                    <View
                      className="bg-card rounded-2xl border overflow-hidden mb-4"
                      style={{ borderColor: Colors.primary }}
                    >
                      <View className="flex-row items-center justify-between px-4 pt-4">
                        <Text className="text-primary text-xs font-bold uppercase tracking-wider">
                          Agora · {numberOf(heroItem.ex.id)} de {dayExercises.length}
                        </Text>
                        <Text className="text-secondary-text text-xs" style={{ fontVariant: ['tabular-nums'] }}>
                          ⏱ {formatActiveTime(exerciseElapsed)} neste exercício
                        </Text>
                      </View>

                      {heroItem.ex.gif && (
                        <Image
                          source={heroItem.ex.gif}
                          style={{ width: '100%', height: 200, marginTop: 12 }}
                          contentFit="contain"
                        />
                      )}

                      <View className="p-4">
                        <Text className="text-text text-xl font-bold">{heroItem.ex.name}</Text>
                        {heroMuscle && (
                          <Text className="text-secondary-text text-xs mt-0.5">{heroMuscle.name}</Text>
                        )}

                        {/* Séries e repetições */}
                        <View className="flex-row gap-2 mt-4">
                          <View className="flex-1 bg-background rounded-xl py-3 items-center">
                            <Text className="text-text text-2xl font-bold">{heroItem.cfg.sets}</Text>
                            <Text className="text-secondary-text text-xs">séries</Text>
                          </View>
                          <View className="flex-1 bg-background rounded-xl py-3 items-center">
                            <Text className="text-text text-2xl font-bold">{heroItem.cfg.reps}</Text>
                            <Text className="text-secondary-text text-xs">repetições</Text>
                          </View>
                        </View>

                        {/* Carga */}
                        <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mt-4 mb-2">
                          Carga (kg)
                        </Text>
                        <View className="flex-row items-center gap-2">
                          <TouchableOpacity
                            onPress={() => stepWeight(-1)}
                            activeOpacity={0.7}
                            className="w-12 h-12 rounded-xl bg-background border border-border items-center justify-center"
                          >
                            <Text className="text-text text-xl font-bold">−</Text>
                          </TouchableOpacity>
                          <TextInput
                            value={weightText}
                            onChangeText={changeWeight}
                            keyboardType="decimal-pad"
                            selectTextOnFocus
                            placeholder="0"
                            placeholderTextColor="#505050"
                            className="flex-1 bg-background rounded-xl text-text border border-border text-center font-bold"
                            style={{ height: 48, fontSize: 20 }}
                          />
                          <TouchableOpacity
                            onPress={() => stepWeight(1)}
                            activeOpacity={0.7}
                            className="w-12 h-12 rounded-xl bg-background border border-border items-center justify-center"
                          >
                            <Text className="text-text text-xl font-bold">+</Text>
                          </TouchableOpacity>
                        </View>
                        <Text className="text-secondary-text mt-1.5" style={{ fontSize: 11 }}>
                          Ajuste se mudou a carga. Ela é salva ao concluir o exercício.
                        </Text>

                        <TouchableOpacity
                          onPress={handleCompleteExercise}
                          activeOpacity={0.85}
                          className="h-14 rounded-xl bg-primary items-center justify-center mt-4"
                        >
                          <Text className="text-white font-bold text-base">✓  Concluir exercício</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Animated.View>
                ) : allDone ? (
                  <View className="bg-card rounded-2xl border border-border p-6 items-center mb-4">
                    <Text style={{ fontSize: 36, marginBottom: 12 }}>🎉</Text>
                    <Text className="text-text font-semibold text-base mb-1">Todos os exercícios concluídos!</Text>
                    <Text className="text-secondary-text text-sm text-center leading-5">
                      Toque em Finalizar treino para salvar esta sessão.
                    </Text>
                  </View>
                ) : null}

                {otherItems.length > 0 && (
                  <>
                    <SectionLabel title={`A seguir · ${otherItems.length}`} hint="Toque para fazer agora" />
                    {otherItems.map(({ ex, cfg }) => (
                      <ExerciseRow
                        key={ex.id}
                        ex={ex}
                        cfg={cfg}
                        number={numberOf(ex.id)}
                        onPress={() => setSelectedExerciseId(ex.id)}
                      />
                    ))}
                  </>
                )}

                {completedItems.length > 0 && (
                  <>
                    <SectionLabel title={`Concluídos · ${completedItems.length}`} />
                    {completedItems.map(({ ex, cfg }) => (
                      <ExerciseRow
                        key={ex.id}
                        ex={ex}
                        cfg={cfg}
                        number={numberOf(ex.id)}
                        done
                        actionLabel="Desfazer"
                        onPress={() => handleReopenExercise(ex.id)}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Rodapé fixo com a ação principal do momento */}
      {displayEntry && (
        <View className="px-4 pt-3 pb-4 border-t border-border bg-background">
          {!isSessionActive ? (
            <TouchableOpacity
              onPress={handleStartWorkout}
              disabled={dayExercises.length === 0}
              activeOpacity={0.85}
              className="h-14 rounded-xl bg-primary items-center justify-center"
              style={{ opacity: dayExercises.length === 0 ? 0.4 : 1 }}
            >
              <Text className="text-white font-bold text-base">▶  Iniciar treino</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setShowFinishConfirm(true)}
              activeOpacity={0.85}
              className="h-12 rounded-xl items-center justify-center border"
              style={{
                backgroundColor: allDone ? Colors.primary : 'transparent',
                borderColor: allDone ? Colors.primary : Colors.border,
              }}
            >
              <Text className="font-bold text-sm" style={{ color: allDone ? Colors.white : Colors.text }}>
                ■  Finalizar treino
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Confirmação de finalizar */}
      <Modal
        visible={showFinishConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFinishConfirm(false)}
      >
        <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <View className="bg-card rounded-2xl p-6 w-full border border-border">
            <Text className="text-text font-bold text-lg mb-2">Finalizar treino?</Text>
            <Text className="text-secondary-text text-sm mb-5 leading-5">
              Você concluiu {completedItems.length} de {dayExercises.length} exercícios em{' '}
              {formatActiveTime(activeElapsed)}.
              {!allDone ? ' Os exercícios que faltam ficam de fora desta sessão.' : ' Bom trabalho!'}
            </Text>
            <View className="gap-2">
              <TouchableOpacity
                onPress={handleFinishWorkout}
                activeOpacity={0.85}
                className="h-12 rounded-xl items-center justify-center bg-primary"
              >
                <Text className="text-white font-bold">Salvar e finalizar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowFinishConfirm(false)}
                activeOpacity={0.7}
                className="h-12 rounded-xl items-center justify-center border border-border"
              >
                <Text className="text-secondary-text font-medium">Continuar treinando</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDiscardWorkout} activeOpacity={0.6} className="items-center pt-2">
                <Text style={{ color: '#707070', fontSize: 13 }}>Descartar treino sem salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Container>
  );
}
