import { Text, View } from 'react-native';

import { MUSCLE_GROUPS } from '@/modules/workouts/data/muscle-groups';
import { useWorkoutStore } from '@/store/workout-store';

import { computeStreak, formatDuration, formatShortDate, startOfWeek } from '../utils';
import { AiSuggestionsCard } from './ai-suggestions-card';
import { ChartColors } from './chart-colors';
import { ColumnChart } from './column-chart';
import { EmptyCard } from './empty-card';
import { SectionCard } from './section-card';
import { StatTile } from './stat-tile';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKS_SHOWN = 8;
const WEEK_DAY_KEYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Aba "Visão geral": números de todos os treinos juntos.
export function OverviewEvolution() {
  const workouts = useWorkoutStore((s) => s.workouts);
  const completedSessions = useWorkoutStore((s) => s.completedSessions);

  if (completedSessions.length === 0) {
    return (
      <EmptyCard
        icon="📊"
        title="Sem treinos concluídos"
        text="Finalize um treino na aba Treino do dia para ver suas estatísticas aqui."
      />
    );
  }

  // ── Esta semana ────────────────────────────────────────────────────────────
  const monday = startOfWeek(new Date());
  const weekSessions = completedSessions.filter((s) => {
    const t = new Date(s.completedAt).getTime();
    return t >= monday.getTime() && t < monday.getTime() + WEEK_MS;
  });
  const weekDoneDays = new Set(weekSessions.map((s) => new Date(s.completedAt).toDateString())).size;
  const weekScheduled = WEEK_DAY_KEYS.filter((key) =>
    workouts.some((w) => w.days.some((d) => d.weekDays.includes(key))),
  ).length;
  const weekSeconds = weekSessions.reduce((acc, s) => acc + s.durationSeconds, 0);
  const streak = computeStreak(completedSessions.map((s) => s.completedAt));

  // ── Consistência: sessões por semana ───────────────────────────────────────
  const weeks = Array.from({ length: WEEKS_SHOWN }, (_, i) => {
    const start = new Date(monday.getTime() - (WEEKS_SHOWN - 1 - i) * WEEK_MS);
    const count = completedSessions.filter((s) => {
      const t = new Date(s.completedAt).getTime();
      return t >= start.getTime() && t < start.getTime() + WEEK_MS;
    }).length;
    const isCurrent = i === WEEKS_SHOWN - 1;
    return {
      key: start.toISOString(),
      label: isCurrent ? 'Atual' : formatShortDate(start.toISOString()),
      value: count,
      valueLabel: `${count}`,
    };
  });

  // ── Totais ─────────────────────────────────────────────────────────────────
  const totalSeconds = completedSessions.reduce((acc, s) => acc + s.durationSeconds, 0);
  const avgSeconds = Math.round(totalSeconds / completedSessions.length);
  const weekdayCounts = WEEKDAY_NAMES.map((_, i) =>
    completedSessions.filter((s) => new Date(s.completedAt).getDay() === i).length,
  );
  const bestWeekdayIndex = weekdayCounts.indexOf(Math.max(...weekdayCounts));

  // ── Grupos musculares ──────────────────────────────────────────────────────
  const muscleCounts = new Map<string, number>();
  completedSessions.forEach((s) => {
    const day = workouts.find((w) => w.id === s.workoutId)?.days.find((d) => d.id === s.dayId);
    day?.muscleGroupIds.forEach((id) => muscleCounts.set(id, (muscleCounts.get(id) ?? 0) + 1));
  });
  const muscles = [...muscleCounts.entries()]
    .flatMap(([id, count]) => {
      const muscle = MUSCLE_GROUPS.find((m) => m.id === id);
      return muscle ? [{ muscle, count }] : [];
    })
    .sort((a, b) => b.count - a.count);
  const maxMuscleCount = muscles[0]?.count ?? 1;

  return (
    <View>
      <SectionCard title="Esta semana">
        <View className="flex-row gap-2">
          <StatTile
            label="Dias treinados"
            value={weekScheduled > 0 ? `${weekDoneDays}/${weekScheduled}` : String(weekDoneDays)}
          />
          <StatTile label="Tempo" value={weekSeconds > 0 ? formatDuration(weekSeconds) : '—'} />
          <StatTile label="Sequência" value={`${streak} ${streak === 1 ? 'dia' : 'dias'}`} />
        </View>
      </SectionCard>

      <AiSuggestionsCard />

      <SectionCard title="Consistência" aside="Treinos por semana">
        <ColumnChart data={weeks} emptyLabel="" plotHeight={80} />
      </SectionCard>

      <SectionCard title="Totais">
        <View className="gap-2">
          <View className="flex-row gap-2">
            <StatTile label="Treinos concluídos" value={String(completedSessions.length)} />
            <StatTile label="Duração média" value={formatDuration(avgSeconds)} />
          </View>
          <View className="flex-row gap-2">
            <StatTile label="Tempo total" value={formatDuration(totalSeconds)} />
            <StatTile label="Dia mais ativo" value={WEEKDAY_NAMES[bestWeekdayIndex]} />
          </View>
        </View>
      </SectionCard>

      {muscles.length > 0 && (
        <SectionCard title="Grupos musculares" aside="Sessões por grupo">
          <View className="gap-3">
            {muscles.map(({ muscle, count }) => (
              <View key={muscle.id} className="flex-row items-center gap-3">
                <View className="flex-row items-center gap-2" style={{ width: 92 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: muscle.color }} />
                  <Text className="text-text text-sm" numberOfLines={1}>
                    {muscle.name}
                  </Text>
                </View>
                <View className="flex-1 flex-row items-center gap-2">
                  <View
                    style={{
                      // até 85% da linha, deixando espaço para o número ao lado
                      width: `${Math.max((count / maxMuscleCount) * 85, 2)}%`,
                      height: 8,
                      borderTopRightRadius: 4,
                      borderBottomRightRadius: 4,
                      backgroundColor: ChartColors.accent,
                    }}
                  />
                  <Text className="text-secondary-text text-xs">{count}</Text>
                </View>
              </View>
            ))}
          </View>
        </SectionCard>
      )}
    </View>
  );
}
