import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { MUSCLE_GROUPS } from '@/modules/workouts/data/muscle-groups';
import { Colors } from '@/shared/theme/colors';

import type { ExerciseProgress, Suggestion } from '../progression';
import { SESSIONS_TO_PROGRESS } from '../progression';
import { formatKg, formatShortDate } from '../utils';
import { LineChart } from './line-chart';
import { StatTile } from './stat-tile';

const HISTORY_ROWS = 6;
const WEIGHT_STEP = 2.5;
const AMBER = '#D69E2E';

function formatWeightInput(kg: number): string {
  return String(Math.round(kg * 100) / 100).replace('.', ',');
}

function parseWeightInput(text: string): number | null {
  const n = parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

function formatSignedKg(delta: number): string {
  const abs = formatKg(Math.abs(delta));
  return delta > 0 ? `+${abs}` : delta < 0 ? `−${abs}` : abs;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

// Texto curto (no card fechado) e explicação (no card aberto) de cada sugestão.
function describe(s: Suggestion, p: ExerciseProgress) {
  const scheme = `${p.sets}x${p.reps}`;
  switch (s.kind) {
    case 'increase':
      return {
        icon: 'trending-up' as const,
        color: Colors.success,
        short: `Suba para ${formatKg(s.weight!)}`,
        detail: `Você fez ${plural(p.sessionsAtCurrent, 'sessão', 'sessões')} seguidas com ${formatKg(
          p.lastWeight!,
        )}. Se completou as ${scheme} com boa técnica, é hora de subir para ${formatKg(s.weight!)}.`,
      };
    case 'deload':
      return {
        icon: 'refresh' as const,
        color: AMBER,
        short: `Volte com ${formatKg(s.weight!)}`,
        detail: `Faz ${s.daysSinceLast} dias desde a última vez. Retome com ~90% da carga (${formatKg(
          s.weight!,
        )}) e suba de novo em poucas sessões.`,
      };
    case 'scheduled':
      return {
        icon: 'flag' as const,
        color: Colors.text,
        short: `Próximo treino: ${formatKg(s.weight!)}`,
        detail: `A carga do treino já está em ${formatKg(s.weight!)}. Faça o exercício na aba Treino do dia para registrar a nova marca.`,
      };
    case 'keep':
      return {
        icon: 'pause' as const,
        color: Colors.secondaryText,
        short: `Mantenha ${formatKg(s.weight!)} · ${plural(s.sessionsLeft, 'sessão', 'sessões')} p/ subir`,
        detail: `Faça mais ${plural(s.sessionsLeft, 'sessão', 'sessões')} com ${formatKg(
          s.weight!,
        )} completando as ${scheme}. Depois de ${SESSIONS_TO_PROGRESS} seguidas, a sugestão é aumentar.`,
      };
    case 'start':
      return {
        icon: 'play' as const,
        color: Colors.secondaryText,
        short: 'Sem registros ainda',
        detail: 'Conclua este exercício na aba Treino do dia para começar o histórico de cargas.',
      };
    case 'bodyweight':
      return {
        icon: 'body' as const,
        color: Colors.secondaryText,
        short: 'Peso corporal',
        detail: 'Sem carga definida. Para evoluir, aumente as repetições ou defina uma carga abaixo.',
      };
  }
}

interface ExerciseProgressCardProps {
  progress: ExerciseProgress;
  expanded: boolean;
  onToggle: () => void;
  // Muda a carga configurada nos treinos (não registra no histórico — isso
  // acontece quando o exercício é feito de verdade na aba Treino do dia).
  onSetWeight: (weight: number) => void;
  // Outros dias de treino em que o mesmo exercício aparece.
  alsoIn: string[];
}

export function ExerciseProgressCard({
  progress,
  expanded,
  onToggle,
  onSetWeight,
  alsoIn,
}: ExerciseProgressCardProps) {
  const { exercise, series, suggestion, targetWeight, lastWeight, firstWeight, record } = progress;
  const muscle = MUSCLE_GROUPS.find((m) => m.id === exercise.muscleGroupId);
  const info = describe(suggestion, progress);

  const [weightDraft, setWeightDraft] = useState<string | null>(null);
  const weightText = weightDraft ?? formatWeightInput(targetWeight);
  const parsedWeight = parseWeightInput(weightText);
  const canSaveWeight = parsedWeight !== null && parsedWeight !== targetWeight;

  function stepWeight(direction: 1 | -1) {
    const current = parsedWeight ?? targetWeight;
    setWeightDraft(formatWeightInput(Math.max(0, current + direction * WEIGHT_STEP)));
  }

  function saveWeight() {
    if (!canSaveWeight || parsedWeight === null) return;
    onSetWeight(parsedWeight);
    setWeightDraft(null);
  }

  const canApply =
    (suggestion.kind === 'increase' || suggestion.kind === 'deload') &&
    suggestion.weight !== null &&
    suggestion.weight !== targetWeight;

  const shownWeight = lastWeight ?? targetWeight;
  const delta = series.length >= 2 && lastWeight !== null && firstWeight !== null ? lastWeight - firstWeight : null;

  const history = series
    .map((w, i) => ({ ...w, change: i > 0 ? w.value - series[i - 1].value : null }))
    .slice(-HISTORY_ROWS)
    .reverse();

  return (
    <View className="bg-card rounded-2xl border border-border mb-3 overflow-hidden">
      <TouchableOpacity onPress={onToggle} activeOpacity={0.8} className="p-4">
        <View className="flex-row items-center gap-3">
          <View
            style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: muscle?.color ?? Colors.border }}
          />
          <View className="flex-1">
            <Text className="text-text text-sm font-semibold" numberOfLines={1}>
              {exercise.name}
            </Text>
            <Text className="text-secondary-text text-xs mt-0.5" numberOfLines={1}>
              {progress.sets}x{progress.reps}
              {muscle ? ` · ${muscle.name}` : ''}
              {alsoIn.length > 0 ? ` · também em ${alsoIn.join(', ')}` : ''}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-text text-base font-bold" style={{ fontVariant: ['tabular-nums'] }}>
              {shownWeight > 0 ? formatKg(shownWeight) : '—'}
            </Text>
            {delta !== null && delta !== 0 ? (
              <Text
                className="text-xs font-semibold mt-0.5"
                style={{ color: delta > 0 ? Colors.success : Colors.error }}
              >
                {delta > 0 ? '▲' : '▼'} {formatSignedKg(delta)}
              </Text>
            ) : (
              <Text className="text-secondary-text text-xs mt-0.5">
                {series.length === 0 ? 'configurado' : plural(series.length, 'registro', 'registros')}
              </Text>
            )}
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.secondaryText} />
        </View>

        <View
          className="flex-row items-center gap-2 mt-3 rounded-lg px-3 py-2"
          style={{ backgroundColor: Colors.background }}
        >
          <Ionicons name={info.icon} size={14} color={info.color} />
          <Text className="text-xs font-semibold flex-1" style={{ color: info.color }} numberOfLines={1}>
            {info.short}
          </Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View className="px-4 pb-4 border-t border-border">
          <Text className="text-secondary-text text-sm leading-5 mt-4">{info.detail}</Text>
          {canApply && (
            <TouchableOpacity
              onPress={() => onSetWeight(suggestion.weight!)}
              activeOpacity={0.85}
              className="h-11 rounded-xl items-center justify-center mt-3"
              style={{ backgroundColor: suggestion.kind === 'increase' ? Colors.success : AMBER }}
            >
              <Text className="font-bold text-sm" style={{ color: Colors.white }}>
                Usar {formatKg(suggestion.weight!)} no próximo treino
              </Text>
            </TouchableOpacity>
          )}

          <View className="flex-row gap-2 mt-4">
            <StatTile label="Recorde" value={record !== null ? formatKg(record) : '—'} />
            <StatTile
              label="Evolução"
              value={delta !== null ? formatSignedKg(delta) : '—'}
              hint={series.length > 0 ? `desde ${formatShortDate(series[0].date)}` : undefined}
            />
            <StatTile label="Na carga atual" value={plural(progress.sessionsAtCurrent, 'sessão', 'sessões')} />
          </View>

          <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mt-5 mb-3">
            Carga ao longo do tempo
          </Text>
          <LineChart
            data={series}
            formatValue={formatKg}
            formatTick={(v) => String(Math.round(v))}
            emptyLabel="Conclua o exercício na aba Treino do dia para acompanhar a evolução da carga."
          />

          <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mt-5 mb-2">
            Carga do treino (kg)
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
              <Text className="font-bold text-sm" style={{ color: canSaveWeight ? Colors.white : Colors.secondaryText }}>
                Salvar
              </Text>
            </TouchableOpacity>
          </View>
          <Text className="text-secondary-text mt-1.5" style={{ fontSize: 11 }}>
            Vale para todos os dias em que o exercício aparece. O histórico é registrado ao concluir o exercício.
          </Text>

          {history.length > 0 && (
            <>
              <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mt-5 mb-2">
                Histórico
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
