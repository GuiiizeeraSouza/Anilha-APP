import { Text, View } from 'react-native';

import { RunHistoryList } from '@/modules/running/components/run-history';
import {
  personalRecords,
  thisMonthRuns,
  thisWeekRuns,
  totalMeters,
  totalSeconds,
  weeklyMeters,
} from '@/modules/running/stats';
import { formatClock, formatKm, formatPace, paceOf } from '@/modules/running/utils';
import { Colors } from '@/shared/theme/colors';
import { useRunStore } from '@/store/run-store';

import { formatShortDate } from '../utils';
import { ColumnChart } from './column-chart';
import { EmptyCard } from './empty-card';
import { LineChart } from './line-chart';
import { SectionCard } from './section-card';
import { StatTile } from './stat-tile';

const WEEKS_SHOWN = 8;
const HISTORY_ROWS = 10;

// Aba "Corrida" da Evolução: volume, ritmo e recordes ao longo do tempo.
export function RunningEvolution() {
  const runs = useRunStore((s) => s.runs);

  if (runs.length === 0) {
    return (
      <EmptyCard
        icon="🏃"
        title="Nenhuma corrida registrada"
        text="Registre suas corridas na aba Corrida para acompanhar distância, pace e recordes aqui."
      />
    );
  }

  const week = thisWeekRuns(runs);
  const month = thisMonthRuns(runs);
  const allMeters = totalMeters(runs);
  const avgPace = paceOf(allMeters, totalSeconds(runs));
  const records = personalRecords(runs);

  const weeks = weeklyMeters(runs, WEEKS_SHOWN).map((w, i) => ({
    key: w.weekStart.toISOString(),
    label: i === WEEKS_SHOWN - 1 ? 'Atual' : formatShortDate(w.weekStart.toISOString()),
    value: w.meters,
    valueLabel: `${formatKm(w.meters, 1)} km`,
  }));

  // Pace só das corridas com distância confiável (≥ 1 km).
  const paceSeries = runs
    .filter((r) => r.distanceMeters >= 1000)
    .map((r) => ({ date: r.startedAt, value: paceOf(r.distanceMeters, r.durationSeconds) ?? 0 }))
    .filter((p) => p.value > 0);

  const distanceSeries = runs.map((r) => ({
    key: r.id,
    label: formatShortDate(r.startedAt),
    value: r.distanceMeters,
    valueLabel: `${formatKm(r.distanceMeters, 1)} km`,
  }));

  const recordRows = [
    {
      label: 'Maior distância',
      value: records.longest ? `${formatKm(records.longest.distanceMeters)} km` : '—',
      date: records.longest?.startedAt,
    },
    {
      label: 'Melhor pace',
      value: records.fastest
        ? `${formatPace(paceOf(records.fastest.distanceMeters, records.fastest.durationSeconds))} /km`
        : '—',
      date: records.fastest?.startedAt,
    },
    {
      label: 'Corrida mais longa',
      value: records.longestTime ? formatClock(records.longestTime.durationSeconds) : '—',
      date: records.longestTime?.startedAt,
    },
    { label: 'Mais km numa semana', value: `${formatKm(records.bestWeekMeters, 1)} km`, date: undefined },
  ];

  return (
    <View>
      <SectionCard title="Resumo">
        <View className="gap-2">
          <View className="flex-row gap-2">
            <StatTile label="Esta semana" value={`${formatKm(totalMeters(week), 1)} km`} hint={`${week.length} corridas`} />
            <StatTile label="Este mês" value={`${formatKm(totalMeters(month), 1)} km`} hint={`${month.length} corridas`} />
          </View>
          <View className="flex-row gap-2">
            <StatTile label="Total" value={`${formatKm(allMeters, 1)} km`} hint={`${runs.length} corridas`} />
            <StatTile label="Pace médio" value={`${formatPace(avgPace)} /km`} hint="todas as corridas" />
          </View>
        </View>
      </SectionCard>

      <SectionCard title="Recordes pessoais">
        {recordRows.map((r, i) => (
          <View
            key={r.label}
            className="flex-row items-center py-2.5"
            style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Colors.border }}
          >
            <Text className="text-secondary-text text-sm flex-1">{r.label}</Text>
            <Text className="text-text text-sm font-bold" style={{ fontVariant: ['tabular-nums'] }}>
              {r.value}
            </Text>
            <Text className="text-secondary-text text-xs text-right" style={{ width: 48 }}>
              {r.date ? formatShortDate(r.date) : ''}
            </Text>
          </View>
        ))}
      </SectionCard>

      <SectionCard title="Pace por corrida" aside="Mais alto = mais rápido">
        <LineChart
          data={paceSeries}
          invertY
          formatValue={(v) => `${formatPace(v)} /km`}
          formatTick={(v) => formatPace(v)}
          emptyLabel="Corra pelo menos 1 km para acompanhar seu ritmo."
        />
      </SectionCard>

      <SectionCard title="Volume" aside="Km por semana">
        <ColumnChart data={weeks} emptyLabel="" plotHeight={80} />
      </SectionCard>

      <SectionCard title="Distância por corrida">
        <ColumnChart data={distanceSeries} emptyLabel="" plotHeight={80} />
      </SectionCard>

      <SectionCard title="Histórico" aside={`Últimas ${Math.min(HISTORY_ROWS, runs.length)}`}>
        <RunHistoryList runs={runs.slice(-HISTORY_ROWS).reverse()} />
      </SectionCard>
    </View>
  );
}
