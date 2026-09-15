import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { MUSCLE_GROUPS } from '@/modules/workouts/data/muscle-groups';
import { useAllExercises } from '@/modules/workouts/hooks/use-all-exercises';
import { Container } from '@/shared/components/container';
import { useWorkoutStore } from '@/store/workout-store';

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ─── Gráfico de barras "na mão" ─────────────────────────────────────────────

type BarDatum = { label: string; value: number; displayValue: string };

function BarChart({ data, emptyLabel }: { data: BarDatum[]; emptyLabel: string }) {
  if (data.length === 0) {
    return (
      <Text className="text-secondary-text text-sm text-center py-6">{emptyLabel}</Text>
    );
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row items-end gap-4 px-1" style={{ height: 130 }}>
        {data.map((d, i) => {
          const barH = max > 0 ? Math.max((d.value / max) * 90, d.value > 0 ? 10 : 4) : 4;
          return (
            <View key={`${d.label}-${i}`} className="items-center gap-1.5" style={{ width: 40 }}>
              <Text className="text-primary text-xs font-bold">{d.displayValue}</Text>
              <View
                style={{
                  width: 22, height: barH, borderRadius: 6,
                  backgroundColor: i === data.length - 1 ? '#D62828' : '#D6282866',
                }}
              />
              <Text className="text-secondary-text" style={{ fontSize: 10 }}>{d.label}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function EvolutionScreen() {
  const workouts = useWorkoutStore((s) => s.workouts);
  const completedSessions = useWorkoutStore((s) => s.completedSessions);
  const weightLogs = useWorkoutStore((s) => s.weightLogs);
  const timeLogs = useWorkoutStore((s) => s.exerciseTimeLogs);
  const allExercises = useAllExercises();

  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  const trackedExerciseIds = useMemo(() => {
    const ids = new Set<string>();
    weightLogs.forEach((l) => ids.add(l.exerciseId));
    timeLogs.forEach((l) => ids.add(l.exerciseId));
    return [...ids];
  }, [weightLogs, timeLogs]);

  useEffect(() => {
    if (selectedExerciseId && trackedExerciseIds.includes(selectedExerciseId)) return;
    setSelectedExerciseId(trackedExerciseIds[0] ?? null);
  }, [trackedExerciseIds]);

  const weightData: BarDatum[] = weightLogs
    .filter((l) => l.exerciseId === selectedExerciseId)
    .slice(-8)
    .map((l) => ({ label: formatShortDate(l.loggedAt), value: l.weight, displayValue: `${l.weight}kg` }));

  const timeData: BarDatum[] = timeLogs
    .filter((l) => l.exerciseId === selectedExerciseId)
    .slice(-8)
    .map((l) => ({
      label: formatShortDate(l.loggedAt),
      value: l.seconds,
      displayValue: l.seconds >= 60 ? `${Math.round(l.seconds / 60)}m` : `${l.seconds}s`,
    }));

  // ── Estatísticas gerais (movidas da Home) ──────────────────────────────────
  const now = new Date();
  const diffToMon = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diffToMon);

  const WEEK_DAY_KEYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  const weekScheduledCount = WEEK_DAY_KEYS.filter((key) =>
    workouts.some((w) => w.days.some((d) => d.weekDays.includes(key))),
  ).length;
  const weekSessions = completedSessions.filter((s) => {
    const d = new Date(s.completedAt);
    return d >= monday && d < new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
  });
  const weekDoneCount = new Set(weekSessions.map((s) => new Date(s.completedAt).toDateString())).size;
  const weekSeconds = weekSessions.reduce((acc, s) => acc + s.durationSeconds, 0);

  const streak = (() => {
    if (completedSessions.length === 0) return 0;
    const doneDays = new Set(completedSessions.map((s) => new Date(s.completedAt).toDateString()));
    let count = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (doneDays.has(cursor.toDateString())) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  })();

  const totalSeconds = completedSessions.reduce((a, s) => a + s.durationSeconds, 0);
  const avgSeconds = completedSessions.length > 0 ? Math.floor(totalSeconds / completedSessions.length) : 0;

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

  const weekdayCounts = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((label, i) => ({
    label,
    count: completedSessions.filter((s) => new Date(s.completedAt).getDay() === i).length,
  }));
  const bestWeekday = weekdayCounts.reduce((max, d) => (d.count > max.count ? d : max), { label: '—', count: 0 });

  const weekTimeLabel = weekSeconds === 0 ? '—' : formatDuration(weekSeconds);

  return (
    <Container safe={false}>
      <View style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14 }}>
        <Text className="text-text text-lg font-bold">📊 Evolução</Text>
        <Text className="text-secondary-text text-xs mt-0.5">Seu progresso ao longo do tempo</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats rápidas da semana */}
        <View className="flex-row gap-3 mb-5">
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

        {/* Peso e tempo por exercício */}
        <View className="bg-card rounded-2xl border border-border mb-4 overflow-hidden">
          <View className="flex-row items-center px-5 pt-4 pb-3 border-b border-border">
            <View className="w-2 h-2 rounded-full bg-primary mr-2" />
            <Text className="text-text text-base font-semibold flex-1">Por exercício</Text>
          </View>

          {trackedExerciseIds.length === 0 ? (
            <Text className="text-secondary-text text-sm text-center py-8 px-5">
              Complete exercícios e edite pesos na aba Treino do dia para ver sua evolução aqui.
            </Text>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}
              >
                {trackedExerciseIds.map((id) => {
                  const ex = allExercises.find((e) => e.id === id);
                  if (!ex) return null;
                  const active = id === selectedExerciseId;
                  return (
                    <TouchableOpacity
                      key={id}
                      onPress={() => setSelectedExerciseId(id)}
                      activeOpacity={0.75}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                        backgroundColor: active ? '#D62828' : '#121212',
                        borderWidth: 1, borderColor: active ? '#D62828' : '#2A2A2A',
                      }}
                    >
                      <Text style={{ color: active ? '#fff' : '#A0A0A0', fontWeight: 'bold', fontSize: 12 }}>
                        {ex.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View className="px-5 pt-4">
                <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mb-2">
                  Peso utilizado
                </Text>
                <BarChart data={weightData} emptyLabel="Sem histórico de peso para este exercício ainda." />
              </View>

              <View className="px-5 pt-2 pb-5">
                <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mb-2">
                  Tempo por execução
                </Text>
                <BarChart data={timeData} emptyLabel="Sem histórico de tempo para este exercício ainda." />
              </View>
            </>
          )}
        </View>

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
                        <Text className="text-xs font-bold" style={{ color: count > 0 ? '#D62828' : '#505050' }}>
                          {count > 0 ? count : ''}
                        </Text>
                        <View
                          style={{
                            width: '70%', height: barH, borderRadius: 6,
                            backgroundColor: isCurrent ? '#D62828' : count > 0 ? '#D6282866' : '#2A2A2A',
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
              <View className="bg-card rounded-2xl border border-border overflow-hidden">
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
                          <View style={{ width: pct, height: '100%', borderRadius: 999, backgroundColor: muscle.color }} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Container>
  );
}
