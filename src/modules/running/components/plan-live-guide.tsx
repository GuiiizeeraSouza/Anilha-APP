import { useEffect, useRef } from 'react';
import { Text, Vibration, View } from 'react-native';

import { Colors } from '@/shared/theme/colors';

import { BLOCK_HINTS, BLOCK_LABELS, type PlanSession, blockAt, paceStatus } from '../plan';
import { formatClock, formatKm, formatPace } from '../utils';

interface PlanLiveGuideProps {
  session: PlanSession;
  elapsedSeconds: number; // tempo em movimento
  distanceMeters: number;
  pace: number | null; // pace atual (ou médio) em s/km; null sem GPS
}

const PACE_FEEDBACK = {
  ok: { label: '✓ No ritmo', color: Colors.success },
  fast: { label: 'Rápido demais — desacelere', color: '#D69E2E' },
  slow: { label: 'Devagar — acelere um pouco', color: '#D69E2E' },
} as const;

// Guia do treino da planilha durante a corrida: o que fazer agora (com
// contagem regressiva nos treinos por blocos), quanto falta e se o ritmo está
// dentro da faixa alvo.
export function PlanLiveGuide({ session, elapsedSeconds, distanceMeters, pace }: PlanLiveGuideProps) {
  const current = session.blocks ? blockAt(session.blocks, elapsedSeconds) : null;
  const blocksDone = session.blocks !== null && current === null;
  const blockIndex = current?.index ?? -1;

  // Vibra a cada troca de bloco (não na abertura da tela).
  const lastIndexRef = useRef(blockIndex);
  useEffect(() => {
    if (session.blocks === null) return;
    if (blockIndex !== lastIndexRef.current) Vibration.vibrate([0, 400, 200, 400]);
    lastIndexRef.current = blockIndex;
  }, [blockIndex, session.blocks]);

  const targetMin = current?.block.paceMin ?? (session.blocks ? null : session.paceMin);
  const targetMax = current?.block.paceMax ?? (session.blocks ? null : session.paceMax);
  const status = paceStatus(pace, targetMin, targetMax);

  const distanceDone = session.targetMeters !== null && distanceMeters >= session.targetMeters;
  const distancePct = session.targetMeters ? Math.min(100, (distanceMeters / session.targetMeters) * 100) : 0;

  return (
    <View className="bg-card rounded-2xl border p-4 mb-3" style={{ borderColor: Colors.primary }}>
      <Text className="text-primary text-xs font-bold uppercase tracking-wider">
        Planilha · Semana {session.week} · {session.title}
      </Text>

      {/* Treino por blocos: o que fazer agora */}
      {session.blocks && current && (
        <View className="mt-2">
          <View className="flex-row items-end justify-between">
            <Text className="text-text text-3xl font-bold">{BLOCK_LABELS[current.block.kind]}</Text>
            <Text className="text-text text-3xl font-bold" style={{ fontVariant: ['tabular-nums'] }}>
              {formatClock(current.remaining)}
            </Text>
          </View>
          <Text className="text-secondary-text text-xs mt-0.5">
            {BLOCK_HINTS[current.block.kind]}
            {current.next ? ` · depois: ${BLOCK_LABELS[current.next.kind].toLowerCase()} ${formatClock(current.next.seconds)}` : ''}
          </Text>
          <Text className="text-secondary-text mt-1" style={{ fontSize: 11 }}>
            Etapa {current.index + 1} de {session.blocks.length}
          </Text>
        </View>
      )}

      {/* Treino por distância: quanto falta */}
      {!session.blocks && session.targetMeters !== null && (
        <View className="mt-2">
          <View className="flex-row items-end justify-between mb-1.5">
            <Text className="text-text text-lg font-bold">
              {distanceDone ? '✓ Distância concluída!' : `Faltam ${formatKm(session.targetMeters - distanceMeters)} km`}
            </Text>
            <Text className="text-secondary-text text-xs">meta {formatKm(session.targetMeters, 1)} km</Text>
          </View>
          <View className="h-2 bg-background rounded-full overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{ width: `${distancePct}%`, backgroundColor: distanceDone ? Colors.success : Colors.primary }}
            />
          </View>
        </View>
      )}

      {(blocksDone || distanceDone) && (
        <Text className="text-text text-sm font-semibold mt-3">
          🎉 Treino cumprido! Toque em Encerrar para salvar.
        </Text>
      )}

      {/* Ritmo em relação ao alvo */}
      {targetMin != null && targetMax != null && !blocksDone && (
        <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-border">
          <Text className="text-secondary-text text-xs">
            Pace alvo {formatPace(targetMin)}–{formatPace(targetMax)} /km
          </Text>
          {status ? (
            <Text className="text-xs font-bold" style={{ color: PACE_FEEDBACK[status].color }}>
              {PACE_FEEDBACK[status].label}
            </Text>
          ) : (
            <Text className="text-secondary-text text-xs">{pace === null ? 'sem GPS' : '—'}</Text>
          )}
        </View>
      )}
    </View>
  );
}
