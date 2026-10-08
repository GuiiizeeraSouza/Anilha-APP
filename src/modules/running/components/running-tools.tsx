import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { SectionCard } from '@/modules/evolution/components/section-card';
import { Colors } from '@/shared/theme/colors';
import { useRunStore } from '@/store/run-store';

import { thisWeekRuns, totalMeters } from '../stats';
import type { Run } from '../types';
import {
  RACE_DISTANCES,
  bestRunForPrediction,
  formatClock,
  formatKm,
  formatPace,
  parseClock,
  parseKm,
  riegelSeconds,
} from '../utils';
import { inputClassName } from './run-row';

// ─── Meta semanal ────────────────────────────────────────────────────────────

export function WeeklyGoalCard({ runs }: { runs: Run[] }) {
  const goalKm = useRunStore((s) => s.weeklyGoalKm);
  const setGoalKm = useRunStore((s) => s.setWeeklyGoalKm);

  const weekRuns = thisWeekRuns(runs);
  const doneMeters = totalMeters(weekRuns);
  const pct = Math.min(100, (doneMeters / 1000 / goalKm) * 100);
  const remainingKm = Math.max(0, goalKm - doneMeters / 1000);

  return (
    <SectionCard title="Meta da semana" aside={`${weekRuns.length} ${weekRuns.length === 1 ? 'corrida' : 'corridas'}`}>
      <View className="flex-row items-end justify-between mb-2">
        <Text className="text-text text-2xl font-bold">
          {formatKm(doneMeters, 1)}
          <Text className="text-secondary-text text-base font-normal"> / {goalKm} km</Text>
        </Text>
        <View className="flex-row items-center gap-2">
          <GoalButton icon="remove" onPress={() => setGoalKm(goalKm - 1)} />
          <GoalButton icon="add" onPress={() => setGoalKm(goalKm + 1)} />
        </View>
      </View>
      <View className="h-2.5 bg-background rounded-full overflow-hidden">
        <View
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? Colors.success : Colors.primary }}
        />
      </View>
      <Text className="text-secondary-text text-xs mt-2">
        {pct >= 100
          ? '✓ Meta batida! Ajuste com − e + se quiser mais desafio.'
          : `Faltam ${String(Math.round(remainingKm * 10) / 10).replace('.', ',')} km. Use − e + para ajustar a meta.`}
      </Text>
    </SectionCard>
  );
}

function GoalButton({ icon, onPress }: { icon: 'add' | 'remove'; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={6}
      className="w-8 h-8 rounded-full bg-background border border-border items-center justify-center"
    >
      <Ionicons name={icon} size={16} color={Colors.text} />
    </TouchableOpacity>
  );
}

// ─── Previsão de provas ──────────────────────────────────────────────────────

export function RacePredictionsCard({ runs, nowMs }: { runs: Run[]; nowMs: number }) {
  const base = bestRunForPrediction(runs, nowMs);
  return (
    <SectionCard title="Previsão de provas" aside="Fórmula de Riegel">
      {!base ? (
        <Text className="text-secondary-text text-sm leading-5">
          Registre uma corrida de pelo menos 3 km para ver quanto tempo você faria em 5 km, 10 km, meia e
          maratona.
        </Text>
      ) : (
        <>
          {RACE_DISTANCES.map((race, i) => {
            const seconds = riegelSeconds(base.distanceMeters, base.durationSeconds, race.meters);
            return (
              <View
                key={race.label}
                className="flex-row items-center py-2.5"
                style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Colors.border }}
              >
                <Text className="text-text text-sm flex-1">{race.label}</Text>
                <Text className="text-text text-sm font-bold" style={{ fontVariant: ['tabular-nums'] }}>
                  {formatClock(seconds)}
                </Text>
                <Text className="text-secondary-text text-xs text-right" style={{ width: 84, fontVariant: ['tabular-nums'] }}>
                  {formatPace(seconds / (race.meters / 1000))} /km
                </Text>
              </View>
            );
          })}
          <Text className="text-secondary-text mt-2" style={{ fontSize: 11 }}>
            Baseado na sua melhor corrida dos últimos 90 dias ({formatKm(base.distanceMeters, 1)} km em{' '}
            {formatClock(base.durationSeconds)}). Para provas longas, só vale com treino de volume.
          </Text>
        </>
      )}
    </SectionCard>
  );
}

// ─── Calculadora de pace ─────────────────────────────────────────────────────

const PRESETS = [
  { label: '5 km', km: '5' },
  { label: '10 km', km: '10' },
  { label: '21 km', km: '21,097' },
  { label: '42 km', km: '42,195' },
];

type CalcMode = 'pace' | 'time';

export function PaceCalculatorCard() {
  const [mode, setMode] = useState<CalcMode>('pace');
  const [km, setKm] = useState('5');
  const [input, setInput] = useState('');

  const meters = parseKm(km);
  const seconds = parseClock(input); // tempo total (modo pace) ou pace por km (modo time)

  let result: { main: string; sub: string } | null = null;
  if (meters !== null && seconds !== null) {
    if (mode === 'pace') {
      const pace = seconds / (meters / 1000);
      result = {
        main: `${formatPace(pace)} /km`,
        sub: `${String((3600 / pace).toFixed(1)).replace('.', ',')} km/h`,
      };
    } else {
      // No modo "tempo", um número sozinho é pace em minutos (ex: "5" = 5:00/km).
      const total = seconds * (meters / 1000);
      result = { main: formatClock(total), sub: `${String((3600 / seconds).toFixed(1)).replace('.', ',')} km/h` };
    }
  }

  return (
    <SectionCard title="Calculadora de pace">
      <View className="flex-row bg-background rounded-xl p-1 mb-4 border border-border">
        {(
          [
            { id: 'pace', label: 'Descobrir pace' },
            { id: 'time', label: 'Descobrir tempo' },
          ] as const
        ).map((m) => {
          const active = m.id === mode;
          return (
            <TouchableOpacity
              key={m.id}
              onPress={() => {
                setMode(m.id);
                setInput('');
              }}
              activeOpacity={0.8}
              className="flex-1 h-8 rounded-lg items-center justify-center"
              style={{ backgroundColor: active ? Colors.card : 'transparent' }}
            >
              <Text className="text-xs font-semibold" style={{ color: active ? Colors.text : Colors.secondaryText }}>
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View className="flex-row gap-2 mb-3">
        {PRESETS.map((p) => {
          const active = km === p.km;
          return (
            <TouchableOpacity
              key={p.label}
              onPress={() => setKm(p.km)}
              activeOpacity={0.8}
              className="flex-1 h-8 rounded-lg items-center justify-center border"
              style={{
                borderColor: active ? Colors.primary : Colors.border,
                backgroundColor: active ? '#D628281F' : 'transparent',
              }}
            >
              <Text className="text-xs font-semibold" style={{ color: active ? Colors.text : Colors.secondaryText }}>
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Text className="text-secondary-text text-xs mb-1.5">Distância (km)</Text>
          <TextInput
            value={km}
            onChangeText={setKm}
            keyboardType="decimal-pad"
            placeholderTextColor="#505050"
            className={inputClassName}
          />
        </View>
        <View className="flex-1">
          <Text className="text-secondary-text text-xs mb-1.5">{mode === 'pace' ? 'Tempo total' : 'Pace (min/km)'}</Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            keyboardType="numbers-and-punctuation"
            placeholder={mode === 'pace' ? '28:30' : '5:30'}
            placeholderTextColor="#505050"
            className={inputClassName}
          />
        </View>
      </View>

      <View className="bg-background rounded-xl p-4 mt-3 items-center">
        {result ? (
          <>
            <Text className="text-text text-2xl font-bold">{result.main}</Text>
            <Text className="text-secondary-text text-xs mt-0.5">{result.sub}</Text>
          </>
        ) : (
          <Text className="text-secondary-text text-xs text-center">
            {mode === 'pace'
              ? 'Informe a distância e o tempo para ver o pace.'
              : 'Informe a distância e o pace para ver o tempo final.'}
          </Text>
        )}
      </View>
    </SectionCard>
  );
}
