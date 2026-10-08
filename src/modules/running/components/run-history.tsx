import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { StatTile } from '@/modules/evolution/components/stat-tile';
import { Colors } from '@/shared/theme/colors';
import { useRunStore } from '@/store/run-store';

import type { Run } from '../types';
import {
  EFFORT_LABELS,
  SOURCE_LABELS,
  formatClock,
  formatKm,
  formatPace,
  hasRoute,
  paceOf,
  splitDurations,
} from '../utils';
import { RouteMap } from './route-map';
import { RouteThumbnail } from './route-thumbnail';
import { RunRow } from './run-row';

interface RunHistoryListProps {
  runs: Run[]; // na ordem em que devem aparecer (mais recente primeiro)
  allowDelete?: boolean;
}

// Lista de corridas com mapinha; tocar abre o detalhe com o mapa completo.
export function RunHistoryList({ runs, allowDelete = false }: RunHistoryListProps) {
  const allRuns = useRunStore((s) => s.runs);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Busca na lista completa: a corrida continua aberta mesmo que saia da lista exibida.
  const selected = allRuns.find((r) => r.id === selectedId) ?? null;

  return (
    <>
      {runs.map((run, i) => (
        <RunRow key={run.id} run={run} first={i === 0} onPress={() => setSelectedId(run.id)} />
      ))}
      <RunDetailModal run={selected} allowDelete={allowDelete} onClose={() => setSelectedId(null)} />
    </>
  );
}

function RunDetailModal({ run, allowDelete, onClose }: { run: Run | null; allowDelete: boolean; onClose: () => void }) {
  const removeRun = useRunStore((s) => s.removeRun);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function close() {
    setConfirmDelete(false);
    onClose();
  }

  return (
    <Modal visible={run !== null} transparent animationType="slide" onRequestClose={close}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}>
        {run && (
          <View className="bg-background rounded-t-3xl border-t border-border" style={{ maxHeight: '92%' }}>
            <View className="flex-row items-center px-5 py-4 border-b border-border">
              <View className="flex-1">
                <Text className="text-text font-bold text-lg">
                  {formatKm(run.distanceMeters)} km
                </Text>
                <Text className="text-secondary-text text-xs capitalize">
                  {new Date(run.startedAt).toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                  {run.source === 'gps'
                    ? ` · ${new Date(run.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                    : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={close}
                activeOpacity={0.7}
                className="w-8 h-8 rounded-full bg-card items-center justify-center"
              >
                <Text className="text-secondary-text">✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
              {hasRoute(run.route) ? (
                <RouteMap route={run.route} fit height={280} />
              ) : (
                <View className="bg-card rounded-2xl border border-border p-4 mb-3 flex-row items-center gap-3">
                  <RouteThumbnail run={run} size={44} />
                  <Text className="text-secondary-text text-xs leading-5 flex-1">
                    {run.source === 'gps'
                      ? 'Esta corrida foi salva antes do mapa existir, então não tem trajeto.'
                      : `Corrida ${run.source === 'treadmill' ? 'na esteira' : 'registrada manualmente'} — sem trajeto no mapa.`}
                  </Text>
                </View>
              )}

              <View className="gap-2 mb-3">
                <View className="flex-row gap-2">
                  <StatTile label="Distância" value={`${formatKm(run.distanceMeters)} km`} />
                  <StatTile label="Tempo" value={formatClock(run.durationSeconds)} />
                </View>
                <View className="flex-row gap-2">
                  <StatTile label="Pace médio" value={`${formatPace(paceOf(run.distanceMeters, run.durationSeconds))} /km`} />
                  <StatTile
                    label="Como foi"
                    value={run.effort ? EFFORT_LABELS[run.effort] : '—'}
                    hint={SOURCE_LABELS[run.source]}
                  />
                </View>
              </View>

              {run.splitSeconds.length > 0 && <Splits splitSeconds={run.splitSeconds} />}

              {allowDelete &&
                (confirmDelete ? (
                  <View className="flex-row items-center gap-2 mt-2">
                    <Text className="text-secondary-text text-xs flex-1">Excluir esta corrida de vez?</Text>
                    <TouchableOpacity
                      onPress={() => setConfirmDelete(false)}
                      activeOpacity={0.7}
                      className="h-9 px-3 rounded-lg border border-border items-center justify-center"
                    >
                      <Text className="text-secondary-text text-xs">Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        removeRun(run.id);
                        close();
                      }}
                      activeOpacity={0.85}
                      className="h-9 px-3 rounded-lg items-center justify-center"
                      style={{ backgroundColor: Colors.error }}
                    >
                      <Text className="text-white text-xs font-bold">Excluir</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setConfirmDelete(true)}
                    activeOpacity={0.7}
                    className="flex-row items-center justify-center gap-1.5 mt-2 py-2"
                  >
                    <Ionicons name="trash-outline" size={14} color={Colors.secondaryText} />
                    <Text className="text-secondary-text text-xs">Excluir corrida</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}

function Splits({ splitSeconds }: { splitSeconds: number[] }) {
  const durations = splitDurations(splitSeconds);
  const fastest = Math.min(...durations);
  return (
    <View className="bg-card rounded-2xl border border-border p-4 mb-3">
      <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mb-2">Parciais</Text>
      {durations.map((secs, i) => (
        <View key={i} className="flex-row items-center py-1.5">
          <Text className="text-secondary-text text-sm flex-1">Km {i + 1}</Text>
          {secs === fastest && durations.length > 1 && (
            <Text className="text-xs mr-2" style={{ color: Colors.success }}>
              mais rápido
            </Text>
          )}
          <Text className="text-text text-sm font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
            {formatPace(secs)} /km
          </Text>
        </View>
      ))}
    </View>
  );
}
