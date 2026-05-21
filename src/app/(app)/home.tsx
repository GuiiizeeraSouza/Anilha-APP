import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

// import { analyzeWorkout } from '@/lib/ai-analysis';

import { signOut } from '@/modules/auth/services/auth-service';
import { DEFAULT_EXERCISES, MUSCLE_GROUPS } from '@/modules/workouts/data/muscle-groups';
import { Button } from '@/shared/components/button';
import { Container } from '@/shared/components/container';
import { Header } from '@/shared/components/header';
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
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const router = useRouter();

  const workouts = useWorkoutStore((s) => s.workouts);
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const completedSessions = useWorkoutStore((s) => s.completedSessions);
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const allExercises = [...DEFAULT_EXERCISES, ...customExercises];

  // Live elapsed timer for in-progress session
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

  // ── Workout selector ────────────────────────────────────────────────────
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [fadeAnim] = useState(() => new Animated.Value(1));
  const [slideAnim] = useState(() => new Animated.Value(0));
  const filteredWorkouts = selectedWorkoutId ? workouts.filter((w) => w.id === selectedWorkoutId) : workouts;

  useEffect(() => {
    if (workouts.length > 0 && (selectedWorkoutId === null || !workouts.find((w) => w.id === selectedWorkoutId))) {
      setSelectedWorkoutId(workouts[0].id);
    }
  }, [workouts]);

  const TODAY_KEY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][new Date().getDay()];
  const TODAY_LABEL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][new Date().getDay()];
  const todayEntry = workouts
    .flatMap((w) => w.days.filter((d) => d.weekDays.includes(TODAY_KEY)).map((d) => ({ workout: w, day: d })))[0];
  const todayExercises = todayEntry
    ? todayEntry.day.exerciseIds.flatMap((id) => { const ex = allExercises.find((e) => e.id === id); return ex ? [ex] : []; })
    : [];

  // ── Week computation ───────────────────────────────────────────────────
  const WEEK_DAY_KEYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  const WEEK_DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const now = new Date();
  const diffToMon = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diffToMon);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  const todayDateStr = now.toDateString();
  const weekDayInfos = weekDates.map((date, i) => {
    const key = WEEK_DAY_KEYS[i];
    const entry = workouts
      .flatMap((w) => w.days.filter((d) => d.weekDays.includes(key)).map((d) => ({ workout: w, day: d })))[0];
    const isToday = date.toDateString() === todayDateStr;
    const isPast = date < now || isToday;
    const dateStr = date.toDateString();
    const completed = entry
      ? completedSessions.some(
          (s) =>
            s.workoutId === entry.workout.id &&
            s.dayId === entry.day.id &&
            new Date(s.completedAt).toDateString() === dateStr,
        )
      : false;
    return { label: WEEK_DAY_LABELS[i], date, isToday, isPast, entry, completed };
  });
  const weekDoneCount = weekDayInfos.filter((d) => d.completed).length;
  const weekScheduledCount = weekDayInfos.filter((d) => d.entry).length;

  // ── Filtered card data (muda com seletor) ────────────────────────────
  const filteredTodayEntry = filteredWorkouts
    .flatMap((w) => w.days.filter((d) => d.weekDays.includes(TODAY_KEY)).map((d) => ({ workout: w, day: d })))[0];
  const filteredTodayExercises = filteredTodayEntry
    ? filteredTodayEntry.day.exerciseIds.flatMap((id) => {
        const ex = allExercises.find((e) => e.id === id);
        return ex ? [ex] : [];
      })
    : [];
  const filteredWeekDayInfos = weekDates.map((date, i) => {
    const key = WEEK_DAY_KEYS[i];
    const entry = filteredWorkouts
      .flatMap((w) => w.days.filter((d) => d.weekDays.includes(key)).map((d) => ({ workout: w, day: d })))[0];
    const isToday = date.toDateString() === todayDateStr;
    const isPast = date < now || isToday;
    const dateStr = date.toDateString();
    const completed = entry
      ? completedSessions.some(
          (s) =>
            s.workoutId === entry.workout.id &&
            s.dayId === entry.day.id &&
            new Date(s.completedAt).toDateString() === dateStr,
        )
      : false;
    return { label: WEEK_DAY_LABELS[i], date, isToday, isPast, entry, completed };
  });
  const filteredWeekDoneCount = filteredWeekDayInfos.filter((d) => d.completed).length;
  const filteredWeekScheduledCount = filteredWeekDayInfos.filter((d) => d.entry).length;

  const weekSessions = completedSessions.filter((s) => {
    const d = new Date(s.completedAt);
    return d >= monday && d < new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
  });
  const weekSeconds = weekSessions.reduce((acc, s) => acc + s.durationSeconds, 0);
  const weekHours = Math.floor(weekSeconds / 3600);
  const weekMinutes = Math.floor((weekSeconds % 3600) / 60);
  const weekTimeLabel = weekSeconds === 0
    ? '—'
    : weekHours > 0
    ? `${weekHours}h ${weekMinutes.toString().padStart(2, '0')}m`
    : `${weekMinutes}m`;

  const streak = (() => {
    if (completedSessions.length === 0) return 0;
    const doneDays = new Set(
      completedSessions.map((s) => new Date(s.completedAt).toDateString()),
    );
    let count = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (doneDays.has(cursor.toDateString())) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  })();

  const dateLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });

  // ── Métricas avançadas ─────────────────────────────────────────────────
  const totalSeconds = completedSessions.reduce((a, s) => a + s.durationSeconds, 0);
  const avgSeconds = completedSessions.length > 0
    ? Math.floor(totalSeconds / completedSessions.length)
    : 0;
  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
  };

  // Frequência por grupo muscular
  const muscleFrequency = new Map<string, number>();
  completedSessions.forEach((s) => {
    const wk = workouts.find((w) => w.id === s.workoutId);
    const day = wk?.days.find((d) => d.id === s.dayId);
    day?.muscleGroupIds.forEach((id) => {
      muscleFrequency.set(id, (muscleFrequency.get(id) ?? 0) + 1);
    });
  });
  const topMuscles = [...muscleFrequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxMuscleCount = topMuscles[0]?.[1] ?? 1;

  // Últimas 4 semanas
  const last4Weeks = Array.from({ length: 4 }, (_, i) => {
    const wkStart = new Date(monday);
    wkStart.setDate(monday.getDate() - (3 - i) * 7);
    const wkEnd = new Date(wkStart);
    wkEnd.setDate(wkStart.getDate() + 7);
    const count = completedSessions.filter((s) => {
      const d = new Date(s.completedAt);
      return d >= wkStart && d < wkEnd;
    }).length;
    return { label: i === 3 ? 'Atual' : `-${3 - i}sem`, count, isCurrent: i === 3 };
  });
  const maxWeekCount = Math.max(...last4Weeks.map((w) => w.count), 1);

  // Melhor dia da semana
  const weekdayCounts = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((label, i) => ({
    label,
    count: completedSessions.filter((s) => new Date(s.completedAt).getDay() === i).length,
  }));
  const bestWeekday = weekdayCounts.reduce(
    (max, d) => (d.count > max.count ? d : max),
    { label: '—', count: 0 },
  );

  // Curiosidade do dia
  const FITNESS_FACTS = [
    { icon: '💧', text: 'Beba água antes, durante e após o treino para manter a performance.' },
    { icon: '😴', text: 'O crescimento muscular acontece durante o descanso, não no treino em si.' },
    { icon: '🥩', text: 'Proteínas são essenciais: consuma entre 1,6 e 2,2g por kg de peso corporal.' },
    { icon: '⏱️', text: 'Treinos de 45–60 min costumam ser mais eficientes que sessões muito longas.' },
    { icon: '🔥', text: 'EPOC: seu corpo continua queimando calorias por horas após o treino.' },
    { icon: '🧠', text: 'Exercício regular aumenta BDNF, melhorando memória e foco.' },
    { icon: '🏃', text: 'Aquecimento de 5–10 min reduz o risco de lesões em até 50%.' },
  ];
  const todayCuriosity = FITNESS_FACTS[new Date().getDay() % FITNESS_FACTS.length];

  const displayName =
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Atleta';

  async function handleSignOut() {
    await signOut();
    logout();
    router.replace('/(auth)/login');
  }

  function switchWorkout(id: string | null) {
    if (id === selectedWorkoutId) return;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -18, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      setSelectedWorkoutId(id);
      slideAnim.setValue(18);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }),
      ]).start();
    });
  }

  // ── AI Analysis ─────────────────────────────────────────────────
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  async function openAiAnalysis() {
    // Análise de IA desabilitada
    /*
    setShowAiModal(true);
    setAiLoading(true);
    setAiError(null);
    setAiResponse(null);
    try {
      const response = await analyzeWorkout({
        todayWorkoutName: todayEntry?.workout.name ?? null,
        todayDayLabel: todayEntry?.day.label ?? null,
        todayMuscleGroups: todayEntry
          ? todayEntry.day.muscleGroupIds.map((id) => MUSCLE_GROUPS.find((m) => m.id === id)?.name ?? id)
          : [],
        todayExercises: todayExercises.map((e) => e.name),
        weekDoneCount,
        weekScheduledCount,
        weekTimeLabel,
        streak,
      });
      setAiResponse(response);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setAiLoading(false);
    }
    */
  }



  return (
    <Container safe={false}>
      <Header />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header de boas-vindas + stats */}
        <View className="mb-6">
          <Text className="text-secondary-text text-sm mb-1 capitalize">{dateLabel}</Text>
          <View className="flex-row items-end justify-between mb-5">
            <Text className="text-text text-2xl font-bold flex-1" numberOfLines={1}>
              Olá, {displayName} 👋
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 12 }}>
              <TouchableOpacity
                onPress={() => router.push('/(app)/ranking')}
                activeOpacity={0.8}
              >
                <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 22 }}>🏆</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/(app)/profile')}
                activeOpacity={0.8}
              >
                {user?.user_metadata?.avatar_url ? (
                  <Image
                    source={{ uri: user.user_metadata.avatar_url as string }}
                    style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2.5, borderColor: '#D62828' }}
                  />
                ) : (
                  <View
                    style={{
                      width: 56, height: 56, borderRadius: 28,
                      backgroundColor: '#D62828',
                      borderWidth: 2.5, borderColor: '#D6282866',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 22 }}>
                      {displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats grid */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-card rounded-2xl p-4 border border-border items-center">
              <Text className="text-primary text-xl font-bold">{weekTimeLabel}</Text>
              <Text className="text-secondary-text text-xs mt-1 text-center">Horas{'\n'}na semana</Text>
            </View>
            <View className="flex-1 bg-card rounded-2xl p-4 border border-border items-center">
              <Text className="text-primary text-xl font-bold">
                {weekDoneCount}<Text className="text-secondary-text text-sm">/{weekScheduledCount}</Text>
              </Text>
              <Text className="text-secondary-text text-xs mt-1 text-center">Treinos{'\n'}esta semana</Text>
            </View>
            <View className="flex-1 bg-card rounded-2xl p-4 border border-border items-center">
              <Text className="text-primary text-xl font-bold">{streak}</Text>
              <Text className="text-secondary-text text-xs mt-1 text-center">Dias em{'\n'}sequência</Text>
            </View>
          </View>
        </View>

        {/* Seletor de treino */}
        {workouts.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
          >
            {workouts.map((w) => (
              <TouchableOpacity
                key={w.id}
                onPress={() => switchWorkout(w.id)}
                activeOpacity={0.75}
                style={{
                  paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
                  backgroundColor: selectedWorkoutId === w.id ? '#D62828' : '#1E1E1E',
                  borderWidth: 1,
                  borderColor: selectedWorkoutId === w.id ? '#D62828' : '#2A2A2A',
                }}
              >
                <Text style={{ color: selectedWorkoutId === w.id ? '#fff' : '#A0A0A0', fontWeight: 'bold', fontSize: 13 }}>
                  {w.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        {/* Treino do dia */}
        {workouts.length === 0 ? (
          <View className="bg-card rounded-2xl p-5 border border-border mb-4">
            <View className="flex-row items-center mb-3">
              <View className="w-2 h-2 rounded-full bg-primary mr-2" />
              <Text className="text-text text-base font-semibold">Treino do dia</Text>
            </View>
            <Text className="text-secondary-text text-sm leading-5">
              Crie seu primeiro treino para ver ele aqui.
            </Text>
          </View>
        ) : filteredTodayEntry ? (
          <View className="bg-card rounded-2xl border border-border mb-4 overflow-hidden">
            <View className="flex-row items-center px-5 pt-4 pb-3 border-b border-border">
              <View className="w-2 h-2 rounded-full bg-primary mr-2" />
              <Text className="text-text text-base font-semibold flex-1">Treino do dia</Text>
              <View className="bg-background rounded-md px-2 py-1">
                <Text className="text-secondary-text text-xs">Hoje · {TODAY_LABEL}</Text>
              </View>
            </View>
            <View className="p-5">
              <View className="flex-row items-center gap-3 mb-3">
                <View className="w-10 h-10 rounded-xl bg-primary items-center justify-center">
                  <Text className="text-white font-bold text-sm">{filteredTodayEntry.day.label}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-text font-bold text-base">{filteredTodayEntry.workout.name}</Text>
                  <View className="flex-row flex-wrap gap-1 mt-1.5">
                    {filteredTodayEntry.day.muscleGroupIds.map((id) => {
                      const muscle = MUSCLE_GROUPS.find((m) => m.id === id);
                      if (!muscle) return null;
                      return (
                        <View
                          key={id}
                          className="rounded-md px-2 py-0.5"
                          style={{ backgroundColor: muscle.color + '28' }}
                        >
                          <Text className="text-xs font-semibold" style={{ color: muscle.color }}>
                            {muscle.name}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
              {filteredTodayExercises.length > 0 && (
                <View className="gap-1.5 mb-4">
                  {filteredTodayExercises.slice(0, 3).map((ex) => (
                    <View key={ex.id} className="flex-row items-center gap-2">
                      <View className="w-1.5 h-1.5 rounded-full bg-border" />
                      <Text className="text-secondary-text text-sm">{ex.name}</Text>
                    </View>
                  ))}
                  {filteredTodayExercises.length > 3 && (
                    <Text className="text-secondary-text text-xs ml-3.5">
                      +{filteredTodayExercises.length - 3} exercício{filteredTodayExercises.length - 3 > 1 ? 's' : ''}
                    </Text>
                  )}
                </View>
              )}
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/(app)/active-workout',
                    params: activeSession
                      ? { workoutId: activeSession.workoutId, dayId: activeSession.dayId }
                      : { workoutId: filteredTodayEntry.workout.id, dayId: filteredTodayEntry.day.id },
                  })
                }
                activeOpacity={0.85}
                className="bg-primary rounded-xl items-center"
                style={{
                  paddingVertical: activeSession ? 10 : 14,
                  elevation: 3, shadowColor: '#D62828', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
                }}
              >
                {activeSession ? (
                  <>
                    <Text className="text-white font-bold" style={{ fontSize: 22, letterSpacing: 1 }}>
                      ⏱️  {formatActiveTime(activeElapsed)}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 }}>
                      Treino em andamento — toque para abrir
                    </Text>
                  </>
                ) : (
                  <Text className="text-white font-bold text-base">▶  Começar treino</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : activeSession ? (
          // Active session on a rest day — show resume banner
          <View className="bg-card rounded-2xl border border-border mb-4 overflow-hidden">
            <View className="flex-row items-center px-5 pt-4 pb-3 border-b border-border">
              <View className="w-2 h-2 rounded-full bg-primary mr-2" />
              <Text className="text-text text-base font-semibold flex-1">Treino em andamento</Text>
              <Text style={{ color: '#D62828', fontWeight: 'bold', fontSize: 14 }}>
                ⏱ {formatActiveTime(activeElapsed)}
              </Text>
            </View>
            <View className="p-5">
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/(app)/active-workout',
                    params: { workoutId: activeSession.workoutId, dayId: activeSession.dayId },
                  })
                }
                activeOpacity={0.85}
                className="bg-primary rounded-xl py-3.5 items-center"
                style={{ elevation: 3, shadowColor: '#D62828', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}
              >
                <Text className="text-white font-bold text-base">▶  Continuar treino</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View className="bg-card rounded-2xl border border-border mb-4 overflow-hidden">
            <View className="flex-row items-center px-5 pt-4 pb-3 border-b border-border">
              <View className="w-2 h-2 rounded-full bg-border mr-2" />
              <Text className="text-text text-base font-semibold flex-1">Treino do dia</Text>
              <View className="bg-background rounded-md px-2 py-1">
                <Text className="text-secondary-text text-xs">Hoje</Text>
              </View>
            </View>
            <View className="p-5 items-center">
              <Text className="text-4xl mb-3">🛌</Text>
              <Text className="text-text font-semibold text-base mb-1">Dia de descanso</Text>
              <Text className="text-secondary-text text-sm text-center leading-5">
                Nenhum treino programado para hoje. Aproveite para recuperar!
              </Text>
            </View>
          </View>
        )}

        {/* Card semanal */}
        {workouts.length > 0 && (
          <View className="bg-card rounded-2xl border border-border mb-4 overflow-hidden">
            <View className="flex-row items-center px-5 pt-4 pb-3 border-b border-border">
              <View className="w-2 h-2 rounded-full bg-primary mr-2" />
              <Text className="text-text text-base font-semibold flex-1">Semana atual</Text>
              {filteredWeekScheduledCount > 0 && (
                <View className="bg-background rounded-md px-2 py-1">
                  <Text className="text-secondary-text text-xs">
                    {filteredWeekDoneCount}/{filteredWeekScheduledCount} treinos
                  </Text>
                </View>
              )}
            </View>
            <View className="px-4 py-2">
              {filteredWeekDayInfos.map(({ label, isToday, isPast, entry, completed }) => (
                <View
                  key={label}
                  className="flex-row items-center py-2.5 px-2 rounded-xl"
                  style={{ backgroundColor: isToday ? '#D6282812' : 'transparent' }}
                >
                  {/* Dia */}
                  <Text
                    className="text-xs font-bold w-8"
                    style={{
                      color: isToday ? '#D62828' : isPast ? '#A0A0A0' : '#505050',
                    }}
                  >
                    {label}
                  </Text>

                  {/* Badge treino */}
                  {entry ? (
                    <View
                      className="w-7 h-7 rounded-lg items-center justify-center mr-2"
                      style={{ backgroundColor: completed ? '#4CAF5033' : '#D6282833' }}
                    >
                      <Text
                        className="font-bold text-xs"
                        style={{ color: completed ? '#4CAF50' : '#D62828' }}
                      >
                        {entry.day.label}
                      </Text>
                    </View>
                  ) : (
                    <View className="w-7 h-7 rounded-lg bg-background items-center justify-center mr-2">
                      <Text className="text-secondary-text" style={{ fontSize: 10 }}>—</Text>
                    </View>
                  )}

                  {/* Grupos musculares */}
                  {entry ? (
                    <View className="flex-1 flex-row flex-wrap gap-1">
                      {entry.day.muscleGroupIds.slice(0, 3).map((id) => {
                        const muscle = MUSCLE_GROUPS.find((m) => m.id === id);
                        if (!muscle) return null;
                        return (
                          <View
                            key={id}
                            className="rounded-md px-1.5 py-0.5"
                            style={{ backgroundColor: muscle.color + (completed ? '18' : '28') }}
                          >
                            <Text
                              className="text-xs"
                              style={{ color: completed ? muscle.color + '99' : muscle.color }}
                            >
                              {muscle.name}
                            </Text>
                          </View>
                        );
                      })}
                      {entry.day.muscleGroupIds.length > 3 && (
                        <Text className="text-secondary-text text-xs self-center">
                          +{entry.day.muscleGroupIds.length - 3}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text className="flex-1 text-secondary-text" style={{ fontSize: 11 }}>Descanso</Text>
                  )}

                  {/* Indicador */}
                  {entry && completed && (
                    <View className="w-6 h-6 rounded-full bg-success items-center justify-center ml-1">
                      <Text className="text-white text-xs font-bold">✓</Text>
                    </View>
                  )}
                  {entry && !completed && isPast && !isToday && (
                    <View className="w-6 h-6 rounded-full bg-border items-center justify-center ml-1">
                      <Text className="text-secondary-text" style={{ fontSize: 10 }}>✕</Text>
                    </View>
                  )}
                  {isToday && !completed && (
                    <View className="rounded-md px-2 py-0.5 ml-1" style={{ backgroundColor: '#D62828' }}>
                      <Text className="text-white font-bold" style={{ fontSize: 10 }}>hoje</Text>
                    </View>
                  )}
                  {isToday && completed && (
                    <View className="rounded-md px-2 py-0.5 ml-1" style={{ backgroundColor: '#4CAF5033' }}>
                      <Text className="font-bold" style={{ fontSize: 10, color: '#4CAF50' }}>🌟 feito</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
        </Animated.View>

        {/* Botão Criar Treino */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/create-workout')}
          activeOpacity={0.85}
          className="bg-primary rounded-2xl py-4 px-5 mb-2 flex-row items-center justify-center gap-2"
          style={{ elevation: 4, shadowColor: '#D62828', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}
        >
          <Text className="text-white text-lg font-bold tracking-wide">＋ Criar treino</Text>
        </TouchableOpacity>

        {/* Botão Gerenciar Treinos */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/manage-workouts')}
          activeOpacity={0.7}
          className="rounded-xl py-3 px-5 mb-6 flex-row items-center justify-center gap-2 border border-border"
        >
          <Text className="text-secondary-text text-sm font-medium">Gerenciar treinos</Text>
        </TouchableOpacity>

        {/* ──── Estatísticas avançadas ──── */}
        {completedSessions.length > 0 && (
          <>
            {/* Métricas gerais */}
            <View className="bg-card rounded-2xl border border-border mb-4 overflow-hidden">
              <View className="flex-row items-center px-5 pt-4 pb-3 border-b border-border">
                <View className="w-2 h-2 rounded-full bg-primary mr-2" />
                <Text className="text-text text-base font-semibold">Suas métricas</Text>
              </View>
              <View className="p-4 flex-row flex-wrap gap-3">
                <View className="bg-background rounded-xl p-3 flex-1 min-w-[30%] items-center">
                  <Text className="text-primary text-xl font-bold">{completedSessions.length}</Text>
                  <Text className="text-secondary-text text-xs mt-1 text-center">Treinos{'\n'}totais</Text>
                </View>
                <View className="bg-background rounded-xl p-3 flex-1 min-w-[30%] items-center">
                  <Text className="text-primary text-xl font-bold">{avgSeconds > 0 ? formatDuration(avgSeconds) : '—'}</Text>
                  <Text className="text-secondary-text text-xs mt-1 text-center">Duração{'\n'}média</Text>
                </View>
                <View className="bg-background rounded-xl p-3 flex-1 min-w-[30%] items-center">
                  <Text className="text-primary text-xl font-bold">{totalSeconds > 0 ? formatDuration(totalSeconds) : '—'}</Text>
                  <Text className="text-secondary-text text-xs mt-1 text-center">Tempo{'\n'}total</Text>
                </View>
                <View className="bg-background rounded-xl p-3 flex-1 min-w-[44%] items-center">
                  <Text className="text-primary text-xl font-bold">{streak > 0 ? `${streak} 🔥` : '0'}</Text>
                  <Text className="text-secondary-text text-xs mt-1 text-center">Sequência{'\n'}atual (dias)</Text>
                </View>
                <View className="bg-background rounded-xl p-3 flex-1 min-w-[44%] items-center">
                  <Text className="text-primary text-xl font-bold">{bestWeekday.count > 0 ? bestWeekday.label : '—'}</Text>
                  <Text className="text-secondary-text text-xs mt-1 text-center">Dia mais{'\n'}ativo</Text>
                </View>
              </View>
            </View>

            {/* Consistência — últimas 4 semanas */}
            <View className="bg-card rounded-2xl border border-border mb-4 overflow-hidden">
              <View className="flex-row items-center px-5 pt-4 pb-3 border-b border-border">
                <View className="w-2 h-2 rounded-full bg-primary mr-2" />
                <Text className="text-text text-base font-semibold flex-1">Consistência</Text>
                <Text className="text-secondary-text text-xs">Últimas 4 semanas</Text>
              </View>
              <View className="px-5 py-4">
                <View className="flex-row items-end gap-3 justify-center" style={{ height: 90 }}>
                  {last4Weeks.map(({ label, count, isCurrent }) => {
                    const barH = maxWeekCount > 0 ? Math.max((count / maxWeekCount) * 70, count > 0 ? 12 : 4) : 4;
                    return (
                      <View key={label} className="flex-1 items-center gap-1.5">
                        <Text
                          className="text-xs font-bold"
                          style={{ color: count > 0 ? '#D62828' : '#505050' }}
                        >
                          {count > 0 ? count : ''}
                        </Text>
                        <View
                          style={{
                            width: '70%',
                            height: barH,
                            borderRadius: 6,
                            backgroundColor: isCurrent
                              ? '#D62828'
                              : count > 0
                              ? '#D6282866'
                              : '#2A2A2A',
                          }}
                        />
                        <Text
                          className="text-xs"
                          style={{ color: isCurrent ? '#D62828' : '#505050', fontWeight: isCurrent ? 'bold' : 'normal' }}
                        >
                          {label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Músculos mais treinados */}
            {topMuscles.length > 0 && (
              <View className="bg-card rounded-2xl border border-border mb-4 overflow-hidden">
                <View className="flex-row items-center px-5 pt-4 pb-3 border-b border-border">
                  <View className="w-2 h-2 rounded-full bg-primary mr-2" />
                  <Text className="text-text text-base font-semibold flex-1">Músculos mais treinados</Text>
                </View>
                <View className="px-5 py-4 gap-3">
                  {topMuscles.map(([id, count]) => {
                    const muscle = MUSCLE_GROUPS.find((m) => m.id === id);
                    if (!muscle) return null;
                    const pct = `${Math.round((count / maxMuscleCount) * 100)}%` as `${number}%`;
                    return (
                      <View key={id}>
                        <View className="flex-row justify-between mb-1">
                          <Text className="text-text text-sm font-medium">{muscle.name}</Text>
                          <Text className="text-secondary-text text-xs">{count}x</Text>
                        </View>
                        <View className="h-2 bg-border rounded-full overflow-hidden">
                          <View
                            style={{
                              width: pct,
                              height: '100%',
                              borderRadius: 999,
                              backgroundColor: muscle.color,
                            }}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}

        {/* Curiosidade fitness */}
        <View
          className="rounded-2xl border mb-4 overflow-hidden"
          style={{ backgroundColor: '#0D1B2A', borderColor: '#1E3A5F' }}
        >
          <View className="px-5 pt-4 pb-3 flex-row items-center gap-3">
            <View
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: '#1E3A5F' }}
            >
              <Text style={{ fontSize: 20 }}>{todayCuriosity.icon}</Text>
            </View>
            <View className="flex-1">
              <Text style={{ color: '#93C5FD', fontSize: 11, fontWeight: 'bold', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Curiosidade do dia
              </Text>
              <Text style={{ color: '#DBEAFE', fontSize: 13, lineHeight: 20 }}>
                {todayCuriosity.text}
              </Text>
            </View>
          </View>
        </View>

        {/* Ações */}
        <View className="gap-3">
          <Button
            title="Meu Perfil"
            onPress={() => router.push('/(app)/profile')}
            variant="secondary"
          />
          <Button title="Sair" onPress={handleSignOut} variant="ghost" />
        </View>
      </ScrollView>


      {/* ── AI Analysis Modal - desabilitado ─────────────────── */}
      {false && (
      <Modal
        visible={showAiModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAiModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(4, 0, 18, 0.93)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#0C0121',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              borderWidth: 1,
              borderColor: '#6D28D944',
              maxHeight: '85%',
              paddingBottom: 36,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 20, paddingVertical: 16,
                borderBottomWidth: 1, borderBottomColor: '#6D28D922',
              }}
            >
              <View
                style={{
                  width: 38, height: 38, borderRadius: 19,
                  backgroundColor: '#2D0A5E',
                  borderWidth: 1, borderColor: '#7C3AED66',
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Text style={{ fontSize: 18 }}>✨</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#EDE9FE', fontWeight: 'bold', fontSize: 16 }}>Análise de IA</Text>
                <Text style={{ color: '#7C3AED', fontSize: 11 }}>Gemini 2.5 Flash · Personal trainer virtual</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAiModal(false)}
                activeOpacity={0.7}
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: '#1F0940',
                  borderWidth: 1, borderColor: '#6D28D933',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#A78BFA' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Body */}
            <ScrollView
              contentContainerStyle={{ padding: 20 }}
              showsVerticalScrollIndicator={false}
            >
              {aiLoading ? (
                <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                  <ActivityIndicator color="#7C3AED" size="large" />
                  <Text style={{ color: '#7C3AED', marginTop: 16, fontSize: 14 }}>
                    Analisando seu treino...
                  </Text>
                  <Text style={{ color: '#4C1D95', fontSize: 12, marginTop: 4 }}>
                    Aguarde um momento
                  </Text>
                </View>
              ) : aiError ? (
                <View
                  style={{
                    padding: 16, borderRadius: 14,
                    backgroundColor: '#FF4D4D11',
                    borderWidth: 1, borderColor: '#FF4D4D33',
                  }}
                >
                  <Text style={{ color: '#FF4D4D', fontSize: 14, lineHeight: 22 }}>{aiError}</Text>
                  <TouchableOpacity
                    onPress={openAiAnalysis}
                    activeOpacity={0.7}
                    style={{ marginTop: 14, alignSelf: 'flex-start' }}
                  >
                    <Text style={{ color: '#A78BFA', fontSize: 13, fontWeight: '600' }}>↻ Tentar novamente</Text>
                  </TouchableOpacity>
                </View>
              ) : aiResponse ? (
                <View>
                  {/* Context pills */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                    {todayEntry ? (
                      <View style={{ backgroundColor: '#2D0A5E', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#7C3AED44' }}>
                        <Text style={{ color: '#C4B5FD', fontSize: 11 }}>💪 Treino {todayEntry.day.label} hoje</Text>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: '#1A1A2E', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#333366' }}>
                        <Text style={{ color: '#818CF8', fontSize: 11 }}>🛌 Descanso hoje</Text>
                      </View>
                    )}
                    <View style={{ backgroundColor: '#1A0A00', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#F4727244' }}>
                      <Text style={{ color: '#FCA5A5', fontSize: 11 }}>🔥 {weekDoneCount}/{weekScheduledCount} treinos</Text>
                    </View>
                    {streak > 0 && (
                      <View style={{ backgroundColor: '#0A1A0A', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#4CAF5044' }}>
                        <Text style={{ color: '#86EFAC', fontSize: 11 }}>⚡ {streak} dia{streak > 1 ? 's' : ''} seguidos</Text>
                      </View>
                    )}
                  </View>

                  {/* AI message bubble */}
                  <View
                    style={{
                      backgroundColor: '#160530',
                      borderRadius: 18,
                      padding: 18,
                      borderWidth: 1,
                      borderColor: '#6D28D933',
                    }}
                  >
                    <Text style={{ color: '#EDE9FE', fontSize: 15, lineHeight: 26 }}>{aiResponse}</Text>
                  </View>

                  {/* Retry */}
                  <TouchableOpacity
                    onPress={openAiAnalysis}
                    activeOpacity={0.7}
                    style={{ alignSelf: 'center', marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Text style={{ color: '#7C3AED', fontSize: 13, fontWeight: '600' }}>↻ Gerar nova análise</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      )}
    </Container>
  );
}
