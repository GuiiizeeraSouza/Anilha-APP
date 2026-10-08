import Ionicons from '@expo/vector-icons/Ionicons';
import { useIsFocused } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { SectionCard } from '@/modules/evolution/components/section-card';
import { LiveRun } from '@/modules/running/components/live-run';
import { ManualRunModal } from '@/modules/running/components/manual-run-modal';
import { RouteMap } from '@/modules/running/components/route-map';
import { RunHistoryList } from '@/modules/running/components/run-history';
import { FirstRunOnboarding, PlanCard, PlanSetupCard } from '@/modules/running/components/running-plan';
import {
  PaceCalculatorCard,
  RacePredictionsCard,
  WeeklyGoalCard,
} from '@/modules/running/components/running-tools';
import type { LatLng } from '@/modules/running/types';
import { type CurrentPosition, useCurrentPosition } from '@/modules/running/use-current-position';
import { Container } from '@/shared/components/container';
import { ProfileButton } from '@/shared/components/profile-button';
import { Colors } from '@/shared/theme/colors';
import { useRunStore } from '@/store/run-store';

const RECENT_RUNS = 5;
const NO_ROUTE: LatLng[][] = [];

function gpsReadiness({ status, accuracy }: CurrentPosition): { label: string; color: string } {
  if (status === 'denied') return { label: 'Localização bloqueada', color: Colors.error };
  if (status === 'error') return { label: 'GPS indisponível', color: Colors.error };
  if (status === 'searching') return { label: 'Procurando sinal…', color: Colors.secondaryText };
  if (accuracy !== null && accuracy > 35) {
    return { label: `Sinal fraco (±${Math.round(accuracy)} m) — espere um pouco`, color: '#D69E2E' };
  }
  return { label: `GPS pronto${accuracy !== null ? ` · ±${Math.round(accuracy)} m` : ''}`, color: Colors.success };
}

export default function RunningScreen() {
  const runs = useRunStore((s) => s.runs);
  const activeRun = useRunStore((s) => s.activeRun);
  const plan = useRunStore((s) => s.plan);
  const startRun = useRunStore((s) => s.startRun);
  const [showManual, setShowManual] = useState(false);

  // GPS antes de começar: só com a aba na tela e sem corrida em andamento
  // (durante a corrida quem usa o GPS é o LiveRun).
  const isFocused = useIsFocused();
  const current = useCurrentPosition(isFocused && !activeRun);
  const readiness = gpsReadiness(current);

  const isFirstTime = runs.length === 0 && !plan;
  const recent = runs.slice(-RECENT_RUNS).reverse();

  return (
    <Container safe={false}>
      <View className="flex-row items-center px-5 pt-14 pb-4 border-b border-border">
        <View className="flex-1">
          <Text className="text-text text-lg font-bold">Corrida</Text>
          <Text className="text-secondary-text text-xs">
            {activeRun ? 'Corrida em andamento' : 'Corra, registre e acompanhe seu ritmo'}
          </Text>
        </View>
        <ProfileButton />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeRun ? (
          <LiveRun />
        ) : (
          <>
            {/* Mapa com a posição atual */}
            <RouteMap
              route={NO_ROUTE}
              position={current.position}
              height={isFirstTime ? 160 : 200}
              emptyLoading={current.status === 'searching'}
              emptyLabel={
                current.status === 'denied'
                  ? 'Permita o acesso à localização (nas configurações do celular ou do navegador) para ver o mapa e medir suas corridas.'
                  : current.status === 'error'
                  ? 'Não foi possível obter sua localização.'
                  : 'Procurando sua localização…'
              }
            />
            <View className="flex-row items-center justify-end gap-1.5 -mt-1 mb-3">
              <Ionicons name="navigate" size={11} color={readiness.color} />
              <Text style={{ fontSize: 11, color: readiness.color }}>{readiness.label}</Text>
            </View>

            {/* Primeira vez: corrida de teste → planilha */}
            {isFirstTime ? (
              <FirstRunOnboarding
                onStartGps={() => startRun('gps')}
                onStartTreadmill={() => startRun('treadmill')}
                onManual={() => setShowManual(true)}
              />
            ) : plan ? (
              <PlanCard plan={plan} onStartSession={(session, mode) => startRun(mode, session.id)} />
            ) : (
              <PlanSetupCard runs={runs} onStartGps={() => startRun('gps')} />
            )}

            {/* Corrida livre (fora da planilha) */}
            {!isFirstTime && (
              <View className="bg-card rounded-2xl border border-border p-4 mb-4">
                <Text className="text-text text-base font-bold">Corrida livre</Text>
                <Text className="text-secondary-text text-xs mt-0.5 mb-3 leading-5">
                  Fora da planilha. O GPS mede distância, pace e parciais e desenha o trajeto no mapa.
                </Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => startRun('gps')}
                    activeOpacity={0.85}
                    className="flex-1 h-11 rounded-xl bg-background border border-border items-center justify-center flex-row gap-1.5"
                  >
                    <Ionicons name="navigate" size={15} color={Colors.text} />
                    <Text className="text-text text-sm font-semibold">Correr</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => startRun('treadmill')}
                    activeOpacity={0.8}
                    className="flex-1 h-11 rounded-xl border border-border items-center justify-center flex-row gap-1.5"
                  >
                    <Ionicons name="speedometer-outline" size={15} color={Colors.secondaryText} />
                    <Text className="text-secondary-text text-sm font-medium">Esteira</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowManual(true)}
                    activeOpacity={0.8}
                    className="flex-1 h-11 rounded-xl border border-border items-center justify-center flex-row gap-1.5"
                  >
                    <Ionicons name="create-outline" size={15} color={Colors.secondaryText} />
                    <Text className="text-secondary-text text-sm font-medium">Já corri</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {runs.length > 0 && (
              <>
                <WeeklyGoalCard runs={runs} />

                <SectionCard title="Últimas corridas" aside={`${runs.length} no total`}>
                  <RunHistoryList runs={recent} allowDelete />
                </SectionCard>

                <RacePredictionsCard runs={runs} nowMs={new Date().getTime()} />
              </>
            )}
            <PaceCalculatorCard />
          </>
        )}
      </ScrollView>

      <ManualRunModal visible={showManual} onClose={() => setShowManual(false)} />
    </Container>
  );
}
