import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import type { ExerciseTimeLog, WeightLog } from '@/lib/workout-service';
import { MUSCLE_GROUPS } from '@/modules/workouts/data/muscle-groups';
import type { Exercise, WorkoutExercise } from '@/modules/workouts/types';
import { Colors } from '@/shared/theme/colors';

import {
  formatExerciseTime,
  formatKg,
  formatShortDate,
  lastValuePerDay,
} from '../utils';
import { ColumnChart } from './column-chart';
import { LineChart } from './line-chart';
import { StatTile } from './stat-tile';

const HISTORY_ROWS = 5;
const WEIGHT_STEP = 2.5;

function formatWeightInput(kg: number): string {
  return String(Math.round(kg * 100) / 100).replace('.', ',');
}

function parseWeightInput(text: string): number | null {
  const n = parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

interface ExerciseEvolutionCardProps {
  exercise: Exercise;
  config: WorkoutExercise;
  weightLogs: WeightLog[];
  timeLogs: ExerciseTimeLog[];
  expanded: boolean;
  onToggle: () => void;
  onSaveWeight: (weight: number) => void;
}

function formatSignedKg(delta: number): string {
  const abs = formatKg(Math.abs(delta));
  return delta > 0 ? `+${abs}` : delta < 0 ? `−${abs}` : abs;
}

export function ExerciseEvolutionCard({
  exercise,
  config,
  weightLogs,
  timeLogs,
  expanded,
  onToggle,
  onSaveWeight,
}: ExerciseEvolutionCardProps) {
  const [weightDraft, setWeightDraft] = useState<string | null>(null);
  const weightText = weightDraft ?? formatWeightInput(config.weight);
  const parsedWeight = parseWeightInput(weightText);
  const canSaveWeight = parsedWeight !== null && parsedWeight > 0 && parsedWeight !== config.weight;

  function stepWeight(direction: 1 | -1) {
    const current = parsedWeight ?? config.weight;
    setWeightDraft(formatWeightInput(Math.max(0, current + direction * WEIGHT_STEP)));
  }

  function saveWeight() {
    if (!canSaveWeight || parsedWeight === null) return;
    onSaveWeight(parsedWeight);
    setWeightDraft(null);
  }

  const muscle = MUSCLE_GROUPS.find((m) => m.id === exercise.muscleGroupId);
  const weightSeries = useMemo(() => lastValuePerDay(weightLogs, (l) => l.weight), [weightLogs]);
  const timeSeries = useMemo(() => lastValuePerDay(timeLogs, (l) => l.seconds), [timeLogs]);

  const firstWeight = weightSeries[0];
  const lastWeight = weightSeries[weightSeries.length - 1];
  const delta = weightSeries.length >= 2 ? lastWeight.value - firstWeight.value : null;
  const record = weightSeries.length > 0 ? Math.max(...weightSeries.map((w) => w.value)) : null;
  const avgTime =
    timeSeries.length > 0
      ? Math.round(timeSeries.reduce((acc, t) => acc + t.value, 0) / timeSeries.length)
      : null;

  const trend =
    delta === null
      ? {
          icon: '',
          text: weightSeries.length === 1 ? '1 registro' : 'Sem histórico',
          color: Colors.secondaryText,
        }
      : delta > 0
      ? { icon: '▲', text: formatSignedKg(delta), color: Colors.success }
      : delta < 0
      ? { icon: '▼', text: formatSignedKg(delta), color: Colors.error }
      : { icon: '=', text: 'Sem alteração', color: Colors.secondaryText };

  const history = weightSeries
    .map((w, i) => ({ ...w, change: i > 0 ? w.value - weightSeries[i - 1].value : null }))
    .slice(-HISTORY_ROWS)
    .reverse();

  return (
    <View className="bg-card rounded-2xl border border-border mb-3 overflow-hidden">
      <TouchableOpacity onPress={onToggle} activeOpacity={0.8} className="flex-row items-center p-4 gap-3">
        <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: muscle?.color ?? Colors.border }} />
        <View className="flex-1">
          <Text className="text-text text-sm font-semibold" numberOfLines={1}>
            {exercise.name}
          </Text>
          <Text className="text-secondary-text text-xs mt-0.5" numberOfLines={1}>
            {config.sets}x{config.reps}
            {muscle ? ` · ${muscle.name}` : ''}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-text text-base font-bold">
            {config.weight > 0 ? formatKg(config.weight) : '—'}
          </Text>
          <Text className="text-xs font-semibold mt-0.5" style={{ color: trend.color }}>
            {trend.icon ? `${trend.icon} ` : ''}
            {trend.text}
            {delta !== null && delta !== 0 ? (
              <Text className="text-secondary-text font-normal"> desde {formatShortDate(firstWeight.date)}</Text>
            ) : null}
          </Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.secondaryText} />
      </TouchableOpacity>

      {expanded && (
        <View className="px-4 pb-4 border-t border-border">
          <View className="flex-row gap-2 mt-4">
            <StatTile label="Recorde" value={record !== null ? formatKg(record) : '—'} />
            <StatTile label="Registros" value={String(Math.max(weightSeries.length, timeSeries.length))} />
            <StatTile label="Tempo médio" value={avgTime !== null ? formatExerciseTime(avgTime) : '—'} />
          </View>

          <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mt-5 mb-2">
            Atualizar carga (kg)
          </Text>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => stepWeight(-1)}
              activeOpacity={0.7}
              className="w-11 h-11 rounded-xl bg-background border border-border items-center justify-center"
            >
              <Text className="text-text text-lg font-bold">−</Text>
            </TouchableOpacity>
            <TextInput
              value={weightText}
              onChangeText={setWeightDraft}
              keyboardType="decimal-pad"
              selectTextOnFocus
              placeholder="0"
              placeholderTextColor="#505050"
              onSubmitEditing={saveWeight}
              className="flex-1 bg-background rounded-xl text-text border border-border text-center font-bold"
              style={{ height: 44, fontSize: 18 }}
            />
            <TouchableOpacity
              onPress={() => stepWeight(1)}
              activeOpacity={0.7}
              className="w-11 h-11 rounded-xl bg-background border border-border items-center justify-center"
            >
              <Text className="text-text text-lg font-bold">+</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={saveWeight}
              disabled={!canSaveWeight}
              activeOpacity={0.85}
              className="h-11 px-4 rounded-xl items-center justify-center"
              style={{ backgroundColor: canSaveWeight ? Colors.primary : Colors.border }}
            >
              <Text
                className="font-bold text-sm"
                style={{ color: canSaveWeight ? Colors.white : Colors.secondaryText }}
              >
                Salvar
              </Text>
            </TouchableOpacity>
          </View>
          <Text className="text-secondary-text mt-1.5" style={{ fontSize: 11 }}>
            Muda a carga do treino e registra no histórico de hoje.
          </Text>

          <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mt-5 mb-3">
            Peso utilizado
          </Text>
          <LineChart
            data={weightSeries}
            formatValue={formatKg}
            formatTick={(v) => String(Math.round(v))}
            emptyLabel="Salve o peso deste exercício na aba Treino do dia para acompanhar a evolução."
          />

          <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mt-6 mb-3">
            Tempo por execução
          </Text>
          <ColumnChart
            data={timeSeries.map((t) => ({
              key: t.date,
              label: formatShortDate(t.date),
              value: t.value,
              valueLabel: formatExerciseTime(t.value),
            }))}
            emptyLabel="Use o cronômetro do exercício no treino do dia para registrar o tempo."
          />

          {history.length > 0 && (
            <>
              <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mt-6 mb-2">
                Histórico de peso
              </Text>
              {history.map((h, i) => (
                <View
                  key={h.date}
                  className="flex-row items-center py-2.5"
                  style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Colors.border }}
                >
                  <Text className="text-secondary-text text-sm flex-1">{formatShortDate(h.date)}</Text>
                  <Text className="text-text text-sm font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
                    {formatKg(h.value)}
                  </Text>
                  <Text
                    className="text-xs text-right"
                    style={{
                      width: 72,
                      fontVariant: ['tabular-nums'],
                      color:
                        h.change === null || h.change === 0
                          ? Colors.secondaryText
                          : h.change > 0
                          ? Colors.success
                          : Colors.error,
                    }}
                  >
                    {h.change === null ? 'início' : h.change === 0 ? '=' : formatSignedKg(h.change)}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}
