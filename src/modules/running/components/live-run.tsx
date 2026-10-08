import Ionicons from '@expo/vector-icons/Ionicons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';

import { generateId } from '@/lib/uuid';
import { Colors } from '@/shared/theme/colors';
import { useRunStore } from '@/store/run-store';

import type { RunEffort } from '../types';
import {
  formatClock,
  formatKm,
  formatPace,
  movingSeconds,
  paceOf,
  parseKm,
  simplifyRoute,
  splitDurations,
} from '../utils';
import { findSession } from '../plan';
import { PlanLiveGuide } from './plan-live-guide';
import { RouteMap } from './route-map';
import { EffortPicker, inputClassName } from './run-row';

type GpsStatus =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'ok'; accuracy: number | null }
  | { kind: 'denied' }
  | { kind: 'error'; message: string };

// Janela para o "pace atual" (ritmo dos últimos segundos, não a média da corrida).
const CURRENT_PACE_WINDOW_MS = 30_000;
const KEEP_AWAKE_TAG = 'anilha-run';

type Sample = { t: number; d: number };

// Fora do componente: o lint do React Compiler trata Date.now() dentro do
// componente como impuro, mesmo em handlers.
function currentTime(): number {
  return Date.now();
}

export function LiveRun() {
  const activeRun = useRunStore((s) => s.activeRun);
  const plan = useRunStore((s) => s.plan);
  const pauseRun = useRunStore((s) => s.pauseRun);
  const resumeRun = useRunStore((s) => s.resumeRun);
  const addGpsPoint = useRunStore((s) => s.addGpsPoint);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [gps, setGps] = useState<GpsStatus>({ kind: 'idle' });
  const [samples, setSamples] = useState<Sample[]>([]);
  const [showFinish, setShowFinish] = useState(false);

  const isGps = activeRun?.mode === 'gps';
  const isPaused = activeRun?.pausedAt != null;
  const runKey = activeRun?.startedAt;

  // Relógio da tela (o tempo em si vem dos timestamps salvos no store).
  useEffect(() => {
    if (!runKey || isPaused) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [runKey, isPaused]);

  // Tela sempre ligada durante a corrida — no PWA o GPS para quando a tela bloqueia.
  useEffect(() => {
    if (!runKey) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [runKey]);

  // GPS: só enquanto a corrida está rodando (pausada = sem rastrear).
  useEffect(() => {
    if (!runKey || !isGps || isPaused) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync().catch(() => null);
      if (cancelled) return;
      if (!permission || permission.status !== 'granted') {
        setGps({ kind: 'denied' });
        return;
      }
      setGps({ kind: 'searching' });
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 },
        (location) => {
          const before = useRunStore.getState().activeRun?.splitSeconds.length ?? 0;
          addGpsPoint({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            timestamp: location.timestamp,
          });
          const run = useRunStore.getState().activeRun;
          if (!run) return;
          // Vibra a cada km completo (Android e navegadores que suportam).
          if (run.splitSeconds.length > before) Vibration.vibrate([0, 300, 150, 300]);
          setGps({ kind: 'ok', accuracy: location.coords.accuracy });
          const now = Date.now();
          setSamples((prev) =>
            [...prev, { t: now, d: run.distanceMeters }].filter((s) => now - s.t <= CURRENT_PACE_WINDOW_MS),
          );
        },
        (reason) => setGps({ kind: 'error', message: reason }),
      ).catch((err: unknown) => {
        setGps({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
        return null;
      });
      if (cancelled) subscription?.remove();
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [runKey, isGps, isPaused, addGpsPoint]);

  // Pausar também zera a janela do pace atual — senão a pausa entra no cálculo.
  function pause() {
    pauseRun();
    setSamples([]);
  }

  function resume() {
    resumeRun();
    setNowMs(currentTime());
  }

  if (!activeRun) return null;

  const elapsed = movingSeconds(activeRun, nowMs);
  const avgPace = paceOf(activeRun.distanceMeters, elapsed);
  const oldest = samples[0];
  const newest = samples[samples.length - 1];
  const currentPace =
    !isPaused && oldest && newest && newest.d - oldest.d >= 30
      ? (newest.t - oldest.t) / 1000 / ((newest.d - oldest.d) / 1000)
      : null;
  const splits = splitDurations(activeRun.splitSeconds);
  const planSession = findSession(plan, activeRun.planSessionId);

  return (
    <View>
      {/* Status */}
      <View className="flex-row items-center gap-2 mb-4">
        <View className="w-2 h-2 rounded-full" style={{ backgroundColor: isPaused ? Colors.secondaryText : Colors.primary }} />
        <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider flex-1">
          {isPaused ? 'Pausada' : 'Correndo'} · {isGps ? 'GPS' : 'Esteira'}
        </Text>
        {isGps && <GpsBadge status={gps} paused={isPaused} />}
      </View>

      {/* Treino da planilha: o que fazer agora */}
      {planSession && (
        <PlanLiveGuide
          session={planSession}
          elapsedSeconds={elapsed}
          distanceMeters={activeRun.distanceMeters}
          pace={isGps ? (currentPace ?? avgPace) : null}
        />
      )}

      {/* Trajeto */}
      {isGps && <RouteMap route={activeRun.route ?? []} />}

      {/* Números principais */}
      <View className="bg-card rounded-2xl border border-border p-5 mb-3 items-center">
        <Text className="text-secondary-text text-xs uppercase tracking-wider">
          {isGps ? 'Distância (km)' : 'Tempo'}
        </Text>
        <Text className="text-text font-bold" style={{ fontSize: 64, lineHeight: 72, fontVariant: ['tabular-nums'] }}>
          {isGps ? formatKm(activeRun.distanceMeters) : formatClock(elapsed)}
        </Text>

        <View className="flex-row mt-4 w-full">
          {isGps && <LiveStat label="Tempo" value={formatClock(elapsed)} />}
          {isGps && <LiveStat label="Pace médio" value={formatPace(avgPace)} unit="/km" />}
          {isGps && <LiveStat label="Pace atual" value={formatPace(currentPace)} unit="/km" />}
          {!isGps && (
            <Text className="text-secondary-text text-xs text-center flex-1 leading-5">
              Na esteira o GPS não funciona — você informa a distância ao encerrar.
            </Text>
          )}
        </View>
      </View>

      {/* Avisos de GPS */}
      {isGps && gps.kind === 'denied' && (
        <Notice
          icon="location-outline"
          text="Sem permissão de localização. Libere o acesso à localização para o Anilha nas configurações do celular (ou do navegador) e retome a corrida."
        />
      )}
      {isGps && gps.kind === 'error' && <Notice icon="warning-outline" text={`Erro no GPS: ${gps.message}`} />}
      {isGps && !isPaused && (
        <Text className="text-secondary-text text-center mb-3" style={{ fontSize: 11 }}>
          Mantenha o app aberto — a tela fica ligada durante a corrida.
        </Text>
      )}

      {/* Controles */}
      <View className="flex-row gap-3 mb-5">
        <TouchableOpacity
          onPress={isPaused ? resume : pause}
          activeOpacity={0.85}
          className="flex-1 h-14 rounded-xl items-center justify-center flex-row gap-2 border"
          style={{
            backgroundColor: isPaused ? Colors.primary : 'transparent',
            borderColor: isPaused ? Colors.primary : Colors.border,
          }}
        >
          <Ionicons name={isPaused ? 'play' : 'pause'} size={18} color={isPaused ? Colors.white : Colors.text} />
          <Text className="font-bold text-base" style={{ color: isPaused ? Colors.white : Colors.text }}>
            {isPaused ? 'Retomar' : 'Pausar'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (!isPaused) pause();
            setShowFinish(true);
          }}
          activeOpacity={0.85}
          className="flex-1 h-14 rounded-xl items-center justify-center flex-row gap-2 bg-card border border-border"
        >
          <Ionicons name="stop" size={18} color={Colors.primary} />
          <Text className="font-bold text-base text-text">Encerrar</Text>
        </TouchableOpacity>
      </View>

      {/* Parciais por km */}
      {splits.length > 0 && (
        <View className="bg-card rounded-2xl border border-border p-4">
          <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mb-2">
            Parciais
          </Text>
          {splits.map((secs, i) => (
            <View key={i} className="flex-row items-center py-1.5">
              <Text className="text-secondary-text text-sm flex-1">Km {i + 1}</Text>
              <Text className="text-text text-sm font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
                {formatPace(secs)} /km
              </Text>
            </View>
          ))}
        </View>
      )}

      <FinishRunModal visible={showFinish} onClose={() => setShowFinish(false)} />
    </View>
  );
}

function LiveStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-text text-xl font-bold" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
        {unit && value !== '—' ? <Text className="text-secondary-text text-xs font-normal">{unit}</Text> : null}
      </Text>
      <Text className="text-secondary-text mt-0.5" style={{ fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function GpsBadge({ status, paused }: { status: GpsStatus; paused: boolean }) {
  if (paused) return null;
  const { label, color } =
    status.kind === 'ok'
      ? status.accuracy !== null && status.accuracy > 35
        ? { label: `Sinal fraco · ±${Math.round(status.accuracy)} m`, color: '#D69E2E' }
        : { label: `GPS ok${status.accuracy !== null ? ` · ±${Math.round(status.accuracy)} m` : ''}`, color: Colors.success }
      : status.kind === 'searching' || status.kind === 'idle'
      ? { label: 'Procurando sinal…', color: Colors.secondaryText }
      : { label: 'Sem GPS', color: Colors.error };
  return (
    <View className="flex-row items-center gap-1.5">
      <Ionicons name="navigate" size={11} color={color} />
      <Text style={{ fontSize: 11, color }}>{label}</Text>
    </View>
  );
}

function Notice({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="flex-row gap-2.5 bg-card rounded-xl border p-3 mb-3" style={{ borderColor: Colors.error }}>
      <Ionicons name={icon} size={18} color={Colors.error} />
      <Text className="text-secondary-text text-xs leading-5 flex-1">{text}</Text>
    </View>
  );
}

// ─── Encerrar corrida ────────────────────────────────────────────────────────

function FinishRunModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const activeRun = useRunStore((s) => s.activeRun);
  const addRun = useRunStore((s) => s.addRun);
  const clearActiveRun = useRunStore((s) => s.clearActiveRun);
  const completePlanSession = useRunStore((s) => s.completePlanSession);

  // Distância editável: a do GPS vem preenchida, mas dá para corrigir (ou
  // informar, no caso da esteira). Rascunho atrelado à corrida atual.
  const [draft, setDraft] = useState<{ runKey: number; km: string; effort: RunEffort | null } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  if (!activeRun) return null;

  const gpsKm = activeRun.mode === 'gps' && activeRun.distanceMeters > 0 ? formatKm(activeRun.distanceMeters) : '';
  const current = draft?.runKey === activeRun.startedAt ? draft : { runKey: activeRun.startedAt, km: gpsKm, effort: null };
  const meters = parseKm(current.km);
  // O modal só abre com a corrida pausada (ver "Encerrar"), então o tempo
  // está congelado em pausedAt.
  const duration = movingSeconds(activeRun, activeRun.pausedAt ?? activeRun.startedAt);

  function close() {
    setConfirmDiscard(false);
    onClose();
  }

  function save() {
    if (!activeRun || meters === null) return;
    const runId = generateId();
    addRun({
      id: runId,
      startedAt: new Date(activeRun.startedAt).toISOString(),
      distanceMeters: meters,
      durationSeconds: duration,
      source: activeRun.mode,
      effort: current.effort,
      // Parciais só fazem sentido se a distância não foi corrigida na mão.
      splitSeconds: activeRun.mode === 'gps' && current.km === gpsKm ? activeRun.splitSeconds : [],
      route: activeRun.mode === 'gps' ? simplifyRoute(activeRun.route) : [],
    });
    // Corrida iniciada a partir de um treino da planilha → marca como feito.
    if (activeRun.planSessionId) completePlanSession(activeRun.planSessionId, runId);
    clearActiveRun();
    setDraft(null);
    close();
  }

  function discard() {
    clearActiveRun();
    setDraft(null);
    close();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
        <ScrollView
          style={{ width: '100%', maxWidth: 480, flexGrow: 0 }}
          contentContainerStyle={{ flexGrow: 0 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="bg-card rounded-2xl p-5 border border-border">
            <Text className="text-text font-bold text-lg mb-1">Encerrar corrida</Text>
            <Text className="text-secondary-text text-sm mb-4">
              Tempo em movimento: <Text className="text-text font-semibold">{formatClock(duration)}</Text>
              {meters !== null ? (
                <>
                  {' · '}Pace: <Text className="text-text font-semibold">{formatPace(paceOf(meters, duration))} /km</Text>
                </>
              ) : null}
            </Text>

            <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mb-2">
              Distância (km)
            </Text>
            <TextInput
              value={current.km}
              onChangeText={(km) => setDraft({ ...current, km })}
              keyboardType="decimal-pad"
              placeholder="Ex: 5,2"
              placeholderTextColor="#505050"
              className={inputClassName}
              style={{ fontSize: 18 }}
            />
            {activeRun.mode === 'gps' && (
              <Text className="text-secondary-text mt-1.5" style={{ fontSize: 11 }}>
                Medido pelo GPS. Corrija se o relógio ou o app de corrida marcou diferente.
              </Text>
            )}

            <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mt-4 mb-2">
              Como foi? (opcional)
            </Text>
            <EffortPicker value={current.effort} onChange={(effort) => setDraft({ ...current, effort })} />

            <View className="gap-2 mt-5">
              <TouchableOpacity
                onPress={save}
                disabled={meters === null}
                activeOpacity={0.85}
                className="h-12 rounded-xl items-center justify-center bg-primary"
                style={{ opacity: meters === null ? 0.4 : 1 }}
              >
                <Text className="text-white font-bold">Salvar corrida</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={close}
                activeOpacity={0.7}
                className="h-12 rounded-xl items-center justify-center border border-border"
              >
                <Text className="text-secondary-text font-medium">Voltar à corrida</Text>
              </TouchableOpacity>
              {confirmDiscard ? (
                <TouchableOpacity onPress={discard} activeOpacity={0.6} className="items-center pt-2">
                  <Text style={{ color: Colors.error, fontSize: 13, fontWeight: '600' }}>
                    Toque de novo para descartar sem salvar
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setConfirmDiscard(true)} activeOpacity={0.6} className="items-center pt-2">
                  <Text style={{ color: '#707070', fontSize: 13 }}>Descartar corrida</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
