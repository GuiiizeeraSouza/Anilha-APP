import { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { EmptyCard } from '@/modules/evolution/components/empty-card';
import { ExerciseProgressCard } from '@/modules/evolution/components/exercise-progress-card';
import { StatTile } from '@/modules/evolution/components/stat-tile';
import { buildExerciseProgress, dayLabel, type ExerciseProgress } from '@/modules/evolution/progression';
import { MUSCLE_GROUPS } from '@/modules/workouts/data/muscle-groups';
import { useAllExercises } from '@/modules/workouts/hooks/use-all-exercises';
import { Container } from '@/shared/components/container';
import { ProfileButton } from '@/shared/components/profile-button';
import { Colors } from '@/shared/theme/colors';
import { useWorkoutStore } from '@/store/workout-store';

// 'all' | 'increase' | id de grupo muscular
type Filter = string;

function muscleNames(ids: string[]): string {
  return ids.map((id) => MUSCLE_GROUPS.find((m) => m.id === id)?.name ?? id).join(' + ');
}

interface ChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function Chip({ label, active, onPress }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      className="rounded-full px-4 py-2 border"
      style={{
        backgroundColor: active ? Colors.primary : Colors.card,
        borderColor: active ? Colors.primary : Colors.border,
      }}
    >
      <Text className="text-sm font-semibold" style={{ color: active ? Colors.white : Colors.secondaryText }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function EvolutionScreen() {
  const workouts = useWorkoutStore((s) => s.workouts);
  const completedSessions = useWorkoutStore((s) => s.completedSessions);
  const weightLogs = useWorkoutStore((s) => s.weightLogs);
  const updateWorkout = useWorkoutStore((s) => s.updateWorkout);
  const allExercises = useAllExercises();

  const [pickedWorkoutId, setPickedWorkoutId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const progressById = useMemo(
    () => new Map(buildExerciseProgress(workouts, weightLogs, allExercises).map((p) => [p.exercise.id, p])),
    [workouts, weightLogs, allExercises],
  );

  // Sem escolha do usuário: o treino feito mais recentemente, depois o principal.
  const lastSession = useMemo(
    () => completedSessions.reduce<(typeof completedSessions)[number] | undefined>(
      (latest, s) => (!latest || s.completedAt > latest.completedAt ? s : latest),
      undefined,
    ),
    [completedSessions],
  );
  const workout =
    workouts.find((w) => w.id === pickedWorkoutId) ??
    workouts.find((w) => w.id === lastSession?.workoutId) ??
    workouts.find((w) => w.isPrimary) ??
    workouts[0] ??
    null;

  if (!workout) {
    return (
      <Screen>
        <EmptyCard
          icon="🏋️"
          title="Nenhum treino criado"
          text="Crie um treino na aba Treinos para acompanhar as cargas e receber sugestões de evolução aqui."
        />
      </Screen>
    );
  }

  // Um bloco por dia do treino, com os exercícios na ordem do próprio dia
  // (séries x reps daquele dia).
  const sections = workout.days.map((day) => {
    const label = dayLabel(workouts, workout, day);
    const items = day.exercises.flatMap((cfg) => {
      const p = progressById.get(cfg.exerciseId);
      return p ? [{ ...p, sets: cfg.sets, reps: cfg.reps } satisfies ExerciseProgress] : [];
    });
    return { day, label, items };
  });

  const workoutItems = [...new Map(sections.flatMap((s) => s.items).map((p) => [p.exercise.id, p])).values()];
  const readyCount = workoutItems.filter((p) => p.suggestion.kind === 'increase').length;
  const improvedCount = workoutItems.filter(
    (p) => p.lastWeight !== null && p.firstWeight !== null && p.lastWeight > p.firstWeight,
  ).length;
  const muscles = MUSCLE_GROUPS.filter((m) => workoutItems.some((p) => p.exercise.muscleGroupId === m.id));

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    ...(readyCount > 0 ? [{ id: 'increase', label: `Subir carga · ${readyCount}` }] : []),
    ...muscles.map((m) => ({ id: m.id, label: m.name })),
  ];
  // Se o filtro escolhido sumiu (ex: aplicou a última sugestão), volta para "Todos".
  const activeFilter = chips.some((c) => c.id === filter) ? filter : 'all';

  function matches(p: ExerciseProgress): boolean {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'increase') return p.suggestion.kind === 'increase';
    return p.exercise.muscleGroupId === activeFilter;
  }

  function pickWorkout(id: string) {
    setPickedWorkoutId(id);
    setFilter('all');
    setExpandedKey(null);
  }

  // Aplica a mesma carga em todos os dias/treinos em que o exercício aparece.
  function setExerciseWeight(exerciseId: string, weight: number) {
    workouts.forEach((w) => {
      const changes = w.days.some((d) => d.exercises.some((e) => e.exerciseId === exerciseId && e.weight !== weight));
      if (!changes) return;
      updateWorkout({
        ...w,
        days: w.days.map((d) => ({
          ...d,
          exercises: d.exercises.map((e) => (e.exerciseId === exerciseId ? { ...e, weight } : e)),
        })),
      });
    });
  }

  const visibleSections = sections
    .map((s) => ({ ...s, items: s.items.filter(matches) }))
    .filter((s) => activeFilter === 'all' || s.items.length > 0);

  return (
    <Screen>
      {workouts.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        >
          {workouts.map((w) => (
            <Chip
              key={w.id}
              label={`${w.isPrimary ? '★ ' : ''}${w.name}`}
              active={w.id === workout.id}
              onPress={() => pickWorkout(w.id)}
            />
          ))}
        </ScrollView>
      )}

      {workoutItems.length === 0 ? (
        <EmptyCard
          icon="📋"
          title="Treino sem exercícios"
          text="Adicione exercícios aos dias deste treino na aba Treinos."
        />
      ) : (
        <>
          <View className="flex-row gap-2 mb-4">
            <StatTile label="Exercícios" value={String(workoutItems.length)} />
            <StatTile label="Prontos p/ subir" value={String(readyCount)} />
            <StatTile label="Já evoluíram" value={String(improvedCount)} />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
          >
            {chips.map((c) => (
              <Chip
                key={c.id}
                label={c.label}
                active={c.id === activeFilter}
                onPress={() => {
                  setFilter(c.id);
                  setExpandedKey(null);
                }}
              />
            ))}
          </ScrollView>

          {visibleSections.map(({ day, label, items }) => {
            const ready = items.filter((p) => p.suggestion.kind === 'increase').length;
            return (
              <View key={day.id} className="mt-4">
                <View className="flex-row items-center gap-2.5 mb-3">
                  <View className="w-8 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: Colors.primary }}>
                    <Text className="font-bold text-sm" style={{ color: Colors.white }}>
                      {day.label}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-text text-sm font-semibold" numberOfLines={1}>
                      {muscleNames(day.muscleGroupIds) || `Treino ${day.label}`}
                    </Text>
                    <Text className="text-secondary-text text-xs" numberOfLines={1}>
                      {items.length} {items.length === 1 ? 'exercício' : 'exercícios'}
                      {ready > 0 ? ` · ${ready} p/ subir` : ''}
                    </Text>
                  </View>
                </View>

                {items.length === 0 ? (
                  <Text className="text-secondary-text text-sm mb-3">Este dia ainda não tem exercícios.</Text>
                ) : (
                  items.map((p) => {
                    const key = `${day.id}:${p.exercise.id}`;
                    return (
                      <ExerciseProgressCard
                        key={key}
                        progress={p}
                        alsoIn={p.dayLabels.filter((l) => l !== label)}
                        expanded={expandedKey === key}
                        onToggle={() => setExpandedKey((cur) => (cur === key ? null : key))}
                        onSetWeight={(weight) => setExerciseWeight(p.exercise.id, weight)}
                      />
                    );
                  })
                )}
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <Container safe={false}>
      <View className="px-5 pt-14 pb-4 border-b border-border">
        <View className="flex-row items-center">
          <View className="flex-1">
            <Text className="text-text text-lg font-bold">Evolução</Text>
            <Text className="text-secondary-text text-xs">Cargas dos seus exercícios e o próximo passo</Text>
          </View>
          <ProfileButton />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </Container>
  );
}
