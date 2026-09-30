import { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import type { ExerciseTimeLog, WeightLog } from '@/lib/workout-service';
import { MUSCLE_GROUPS } from '@/modules/workouts/data/muscle-groups';
import { useAllExercises } from '@/modules/workouts/hooks/use-all-exercises';
import { Colors } from '@/shared/theme/colors';
import { useWorkoutStore } from '@/store/workout-store';

import { formatDuration, formatRelativeDay, formatShortDate } from '../utils';
import { ColumnChart } from './column-chart';
import { EmptyCard } from './empty-card';
import { ExerciseEvolutionCard } from './exercise-evolution-card';
import { SectionCard } from './section-card';
import { StatTile } from './stat-tile';

function groupByExercise<T extends { exerciseId: string }>(logs: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  logs.forEach((log) => {
    const list = map.get(log.exerciseId);
    if (list) list.push(log);
    else map.set(log.exerciseId, [log]);
  });
  return map;
}

function muscleNames(ids: string[]): string {
  return ids.map((id) => MUSCLE_GROUPS.find((m) => m.id === id)?.name ?? id).join(' + ');
}

const NO_WEIGHT_LOGS: WeightLog[] = [];
const NO_TIME_LOGS: ExerciseTimeLog[] = [];

// Aba "Por treino": escolhe treino → dia, e mostra o resumo das sessões
// daquele dia e a evolução de cada exercício dele.
export function WorkoutEvolution() {
  const workouts = useWorkoutStore((s) => s.workouts);
  const completedSessions = useWorkoutStore((s) => s.completedSessions);
  const weightLogs = useWorkoutStore((s) => s.weightLogs);
  const timeLogs = useWorkoutStore((s) => s.exerciseTimeLogs);
  const allExercises = useAllExercises();

  const [pickedWorkoutId, setPickedWorkoutId] = useState<string | null>(null);
  const [pickedDayId, setPickedDayId] = useState<string | null>(null);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);

  const sessions = useMemo(
    () => [...completedSessions].sort((a, b) => a.completedAt.localeCompare(b.completedAt)),
    [completedSessions],
  );
  const weightByExercise = useMemo(() => groupByExercise(weightLogs), [weightLogs]);
  const timeByExercise = useMemo(() => groupByExercise(timeLogs), [timeLogs]);

  // Sem escolha do usuário: o treino feito mais recentemente, depois o principal.
  const lastSession = sessions[sessions.length - 1];
  const workout =
    workouts.find((w) => w.id === pickedWorkoutId) ??
    workouts.find((w) => w.id === lastSession?.workoutId) ??
    workouts.find((w) => w.isPrimary) ??
    workouts[0] ??
    null;

  const workoutSessions = workout ? sessions.filter((s) => s.workoutId === workout.id) : [];
  const lastWorkoutSession = workoutSessions[workoutSessions.length - 1];
  const day =
    workout?.days.find((d) => d.id === pickedDayId) ??
    workout?.days.find((d) => d.id === lastWorkoutSession?.dayId) ??
    workout?.days[0] ??
    null;

  if (!workout) {
    return (
      <EmptyCard
        icon="🏋️"
        title="Nenhum treino criado"
        text="Crie um treino na aba Treinos para acompanhar a evolução de cada exercício aqui."
      />
    );
  }

  function pickWorkout(id: string) {
    setPickedWorkoutId(id);
    setPickedDayId(null);
    setExpandedExerciseId(null);
  }

  function pickDay(id: string) {
    setPickedDayId(id);
    setExpandedExerciseId(null);
  }

  const daySessions = day ? workoutSessions.filter((s) => s.dayId === day.id) : [];
  const avgDuration =
    daySessions.length > 0
      ? Math.round(daySessions.reduce((acc, s) => acc + s.durationSeconds, 0) / daySessions.length)
      : null;
  const lastDaySession = daySessions[daySessions.length - 1];

  const dayExercises = day
    ? day.exercises.flatMap((cfg) => {
        const ex = allExercises.find((e) => e.id === cfg.exerciseId);
        return ex ? [{ ex, cfg }] : [];
      })
    : [];

  return (
    <View>
      {/* Seletor de treino (só quando há mais de um) */}
      {workouts.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        >
          {workouts.map((w) => {
            const active = w.id === workout.id;
            return (
              <TouchableOpacity
                key={w.id}
                onPress={() => pickWorkout(w.id)}
                activeOpacity={0.75}
                className="rounded-full px-4 py-2 border"
                style={{
                  backgroundColor: active ? Colors.primary : Colors.card,
                  borderColor: active ? Colors.primary : Colors.border,
                }}
              >
                <Text className="text-sm font-semibold" style={{ color: active ? Colors.white : Colors.secondaryText }}>
                  {w.isPrimary ? '★ ' : ''}
                  {w.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {workout.days.length === 0 || !day ? (
        <EmptyCard icon="📋" title="Treino sem dias" text="Adicione dias a este treino na aba Treinos." />
      ) : (
        <>
          {/* Seletor de dia */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
          >
            {workout.days.map((d) => {
              const active = d.id === day.id;
              return (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => pickDay(d.id)}
                  activeOpacity={0.75}
                  className="flex-row items-center gap-2.5 rounded-xl pl-2 pr-3.5 py-2 border"
                  style={{
                    backgroundColor: active ? '#D628281F' : Colors.card,
                    borderColor: active ? Colors.primary : Colors.border,
                  }}
                >
                  <View
                    className="w-8 h-8 rounded-lg items-center justify-center"
                    style={{ backgroundColor: active ? Colors.primary : Colors.background }}
                  >
                    <Text className="font-bold text-sm" style={{ color: active ? Colors.white : Colors.secondaryText }}>
                      {d.label}
                    </Text>
                  </View>
                  <Text
                    className="text-xs font-medium"
                    style={{ color: active ? Colors.text : Colors.secondaryText, maxWidth: 140 }}
                    numberOfLines={1}
                  >
                    {muscleNames(d.muscleGroupIds) || `Treino ${d.label}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Resumo das sessões do dia */}
          <SectionCard title={`Treino ${day.label}`} aside={muscleNames(day.muscleGroupIds)}>
            <View className="flex-row gap-2">
              <StatTile label="Sessões" value={String(daySessions.length)} />
              <StatTile
                label="Última vez"
                value={lastDaySession ? formatRelativeDay(lastDaySession.completedAt) : '—'}
              />
              <StatTile label="Duração média" value={avgDuration !== null ? formatDuration(avgDuration) : '—'} />
            </View>

            <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mt-5 mb-3">
              Duração por sessão
            </Text>
            <ColumnChart
              data={daySessions.map((s) => ({
                key: s.completedAt,
                label: formatShortDate(s.completedAt),
                value: s.durationSeconds,
                valueLabel: formatDuration(s.durationSeconds),
              }))}
              emptyLabel="Conclua este treino para ver a duração de cada sessão."
            />
          </SectionCard>

          {/* Evolução por exercício */}
          <View className="flex-row items-baseline justify-between mb-3 mt-1">
            <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider">
              Exercícios · {dayExercises.length}
            </Text>
            {dayExercises.length > 0 && (
              <Text className="text-secondary-text" style={{ fontSize: 11 }}>
                Toque para ver o histórico
              </Text>
            )}
          </View>

          {dayExercises.length === 0 ? (
            <EmptyCard icon="🏋️" title="Sem exercícios" text="Este dia ainda não tem exercícios cadastrados." />
          ) : (
            dayExercises.map(({ ex, cfg }) => (
              <ExerciseEvolutionCard
                key={ex.id}
                exercise={ex}
                config={cfg}
                weightLogs={weightByExercise.get(ex.id) ?? NO_WEIGHT_LOGS}
                timeLogs={timeByExercise.get(ex.id) ?? NO_TIME_LOGS}
                expanded={expandedExerciseId === ex.id}
                onToggle={() => setExpandedExerciseId((cur) => (cur === ex.id ? null : ex.id))}
              />
            ))
          )}
        </>
      )}
    </View>
  );
}
