import { useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { generateId } from '@/lib/uuid';
import { Colors } from '@/shared/theme/colors';
import { useRunStore } from '@/store/run-store';

import type { RunEffort } from '../types';
import { formatPace, paceOf, parseClock, parseKm } from '../utils';
import { EffortPicker, inputClassName } from './run-row';

const DAYS_BACK = 7;

function dayChips(): { key: number; label: string; date: Date }[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Array.from({ length: DAYS_BACK }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const label =
      i === 0
        ? 'Hoje'
        : i === 1
        ? 'Ontem'
        : date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }).replace('.', '');
    return { key: i, label, date };
  });
}

// Corrida feita sem o app (relógio, esteira da academia, outro app): o usuário
// informa dia, distância e tempo.
export function ManualRunModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const addRun = useRunStore((s) => s.addRun);
  const [dayIndex, setDayIndex] = useState(0);
  const [km, setKm] = useState('');
  const [time, setTime] = useState('');
  const [effort, setEffort] = useState<RunEffort | null>(null);
  const [treadmill, setTreadmill] = useState(false);

  const days = dayChips();
  const meters = parseKm(km);
  const seconds = parseClock(time);
  const valid = meters !== null && seconds !== null;

  function reset() {
    setDayIndex(0);
    setKm('');
    setTime('');
    setEffort(null);
    setTreadmill(false);
  }

  function close() {
    reset();
    onClose();
  }

  function save() {
    if (meters === null || seconds === null) return;
    addRun({
      id: generateId(),
      startedAt: days[dayIndex].date.toISOString(),
      distanceMeters: meters,
      durationSeconds: seconds,
      source: treadmill ? 'treadmill' : 'manual',
      effort,
      splitSeconds: [],
      route: [],
    });
    close();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}>
        <View className="bg-card rounded-t-3xl" style={{ maxHeight: '90%' }}>
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
            <Text className="text-text font-bold text-lg">Registrar corrida</Text>
            <TouchableOpacity
              onPress={close}
              activeOpacity={0.7}
              className="w-8 h-8 rounded-full bg-background items-center justify-center"
            >
              <Text className="text-secondary-text">✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mb-2">Quando</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {days.map((d) => {
                const active = d.key === dayIndex;
                return (
                  <TouchableOpacity
                    key={d.key}
                    onPress={() => setDayIndex(d.key)}
                    activeOpacity={0.8}
                    className="rounded-full px-4 py-2 border"
                    style={{
                      backgroundColor: active ? Colors.primary : Colors.background,
                      borderColor: active ? Colors.primary : Colors.border,
                    }}
                  >
                    <Text className="text-sm font-semibold" style={{ color: active ? Colors.white : Colors.secondaryText }}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View className="flex-row gap-3 mt-5">
              <View className="flex-1">
                <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mb-2">
                  Distância (km)
                </Text>
                <TextInput
                  value={km}
                  onChangeText={setKm}
                  keyboardType="decimal-pad"
                  placeholder="5,0"
                  placeholderTextColor="#505050"
                  className={inputClassName}
                />
              </View>
              <View className="flex-1">
                <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mb-2">
                  Tempo
                </Text>
                <TextInput
                  value={time}
                  onChangeText={setTime}
                  keyboardType="numbers-and-punctuation"
                  placeholder="28:30"
                  placeholderTextColor="#505050"
                  className={inputClassName}
                />
              </View>
            </View>
            <Text className="text-secondary-text mt-1.5" style={{ fontSize: 11 }}>
              Tempo em minutos:segundos (28:30) ou horas:min:seg (1:05:00).
              {valid ? `  Pace: ${formatPace(paceOf(meters, seconds))} /km` : ''}
            </Text>

            <TouchableOpacity
              onPress={() => setTreadmill((v) => !v)}
              activeOpacity={0.8}
              className="flex-row items-center gap-2.5 mt-4"
            >
              <View
                className="w-5 h-5 rounded-md items-center justify-center border"
                style={{
                  backgroundColor: treadmill ? Colors.primary : 'transparent',
                  borderColor: treadmill ? Colors.primary : Colors.border,
                }}
              >
                {treadmill && <Text className="text-white text-xs font-bold">✓</Text>}
              </View>
              <Text className="text-text text-sm">Foi na esteira</Text>
            </TouchableOpacity>

            <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mt-5 mb-2">
              Como foi? (opcional)
            </Text>
            <EffortPicker value={effort} onChange={setEffort} />

            <TouchableOpacity
              onPress={save}
              disabled={!valid}
              activeOpacity={0.85}
              className="h-12 rounded-xl items-center justify-center bg-primary mt-6"
              style={{ opacity: valid ? 1 : 0.4 }}
            >
              <Text className="text-white font-bold">Salvar corrida</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
