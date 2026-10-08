import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/shared/theme/colors';

import type { Run, RunEffort } from '../types';
import { EFFORT_LABELS, SOURCE_LABELS, formatClock, formatKm, formatPace, paceOf } from '../utils';
import { RouteThumbnail } from './route-thumbnail';

export function formatRunDate(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${date}`;
}

interface RunRowProps {
  run: Run;
  first?: boolean;
  onPress?: () => void;
}

// Uma corrida do histórico: mapinha do trajeto, distância, tempo e pace.
// Tocar abre o detalhe (mapa completo, parciais e excluir).
export function RunRow({ run, first = false, onPress }: RunRowProps) {
  const pace = paceOf(run.distanceMeters, run.durationSeconds);
  const meta = [SOURCE_LABELS[run.source], run.effort ? EFFORT_LABELS[run.effort] : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
      className="flex-row items-center gap-3 py-3"
      style={{ borderTopWidth: first ? 0 : 1, borderTopColor: Colors.border }}
    >
      <RouteThumbnail run={run} />
      <View className="flex-1">
        <Text className="text-text text-sm font-semibold">
          {formatKm(run.distanceMeters)} km
          <Text className="text-secondary-text font-normal"> · {formatClock(run.durationSeconds)}</Text>
        </Text>
        <Text className="text-secondary-text text-xs mt-0.5" numberOfLines={1}>
          {formatRunDate(run.startedAt)} · {meta}
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-text text-sm font-bold" style={{ fontVariant: ['tabular-nums'] }}>
          {formatPace(pace)}
        </Text>
        <Text className="text-secondary-text" style={{ fontSize: 10 }}>min/km</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color={Colors.secondaryText} />}
    </TouchableOpacity>
  );
}

const EFFORTS: RunEffort[] = ['leve', 'moderado', 'forte'];

export function EffortPicker({ value, onChange }: { value: RunEffort | null; onChange: (e: RunEffort | null) => void }) {
  return (
    <View className="flex-row gap-2">
      {EFFORTS.map((effort) => {
        const active = value === effort;
        return (
          <TouchableOpacity
            key={effort}
            onPress={() => onChange(active ? null : effort)}
            activeOpacity={0.8}
            className="flex-1 h-10 rounded-xl items-center justify-center border"
            style={{
              backgroundColor: active ? '#D628281F' : Colors.background,
              borderColor: active ? Colors.primary : Colors.border,
            }}
          >
            <Text className="text-sm font-semibold" style={{ color: active ? Colors.text : Colors.secondaryText }}>
              {EFFORT_LABELS[effort]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const inputClassName = 'h-12 bg-background rounded-xl px-3.5 text-text border border-border';
