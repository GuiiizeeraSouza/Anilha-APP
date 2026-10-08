import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/shared/theme/colors';
import { useRunStore } from '@/store/run-store';

import {
  BLOCK_LABELS,
  GOAL_LABELS,
  LEVEL_LABELS,
  type PlanGoal,
  type PlanSession,
  type TrainingPlan,
  availableGoals,
  currentWeek,
  detectLevel,
  generatePlan,
  isValidTestRun,
  nextSession,
  suggestedGoal,
} from '../plan';
import type { Run } from '../types';
import { formatClock, formatKm, formatPace, paceOf } from '../utils';

// ─── 1. Nunca correu: corrida de teste ───────────────────────────────────────

const ONBOARDING_STEPS = [
  {
    icon: 'walk-outline' as const,
    title: 'Corra no seu ritmo',
    text: 'De 10 a 30 minutos, num ritmo em que dá para conversar. Se cansar, caminhe um pouco — tudo bem!',
  },
  {
    icon: 'stats-chart-outline' as const,
    title: 'O app mede tudo',
    text: 'Distância, tempo e pace pelo GPS. No final, conte como foi (leve, moderado ou forte).',
  },
  {
    icon: 'calendar-outline' as const,
    title: 'Receba sua planilha',
    text: '8 semanas de treinos no seu nível, com o pace certo de cada um.',
  },
];

interface StartActions {
  onStartGps: () => void;
  onStartTreadmill: () => void;
  onManual: () => void;
}

export function FirstRunOnboarding({ onStartGps, onStartTreadmill, onManual }: StartActions) {
  return (
    <View className="bg-card rounded-2xl border p-4 mb-4" style={{ borderColor: Colors.primary }}>
      <Text className="text-text text-lg font-bold">🏃 Sua primeira corrida</Text>
      <Text className="text-secondary-text text-sm mt-0.5 mb-4 leading-5">
        Vamos descobrir seu ritmo e montar uma planilha de corrida só sua.
      </Text>

      {ONBOARDING_STEPS.map((step, i) => (
        <View key={step.title} className="flex-row gap-3 mb-3">
          <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
            <Text className="text-white font-bold text-sm">{i + 1}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-text text-sm font-semibold">{step.title}</Text>
            <Text className="text-secondary-text text-xs leading-5">{step.text}</Text>
          </View>
        </View>
      ))}

      <TouchableOpacity
        onPress={onStartGps}
        activeOpacity={0.85}
        className="h-14 rounded-xl bg-primary items-center justify-center flex-row gap-2 mt-2"
      >
        <Ionicons name="navigate" size={18} color={Colors.white} />
        <Text className="text-white font-bold text-base">Começar corrida de teste</Text>
      </TouchableOpacity>
      <View className="flex-row gap-2 mt-2">
        <SecondaryButton icon="speedometer-outline" label="Na esteira" onPress={onStartTreadmill} />
        <SecondaryButton icon="create-outline" label="Já fiz uma corrida" onPress={onManual} />
      </View>
    </View>
  );
}

function SecondaryButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="flex-1 h-11 rounded-xl border border-border items-center justify-center flex-row gap-1.5"
    >
      <Ionicons name={icon} size={15} color={Colors.secondaryText} />
      <Text className="text-secondary-text text-sm font-medium">{label}</Text>
    </TouchableOpacity>
  );
}

// ─── 2. Já correu: montar a planilha ────────────────────────────────────────

const LEVEL_EXPLANATION = {
  iniciante: 'Vamos começar alternando corrida e caminhada e chegar a 30 minutos correndo sem parar.',
  intermediario: 'Você já tem uma base. A planilha mistura rodagens leves, treinos de ritmo e um longão por semana.',
  avancado: 'Você corre bem! A planilha foca em volume, tiros e ritmo para melhorar seu tempo.',
} as const;

const DAY_OPTIONS = [2, 3, 4];

export function PlanSetupCard({ runs, onStartGps }: { runs: Run[]; onStartGps: () => void }) {
  const setPlan = useRunStore((s) => s.setPlan);
  // Base: a corrida válida mais recente (para quem acabou de começar, é a primeira).
  const base = [...runs].reverse().find(isValidTestRun) ?? null;
  const [days, setDays] = useState(3);
  const [pickedGoal, setPickedGoal] = useState<PlanGoal | null>(null);

  if (!base) {
    return (
      <View className="bg-card rounded-2xl border p-4 mb-4" style={{ borderColor: Colors.primary }}>
        <Text className="text-text text-lg font-bold">📋 Quase lá!</Text>
        <Text className="text-secondary-text text-sm mt-1 mb-4 leading-5">
          Sua corrida foi curta demais para avaliar seu ritmo. Faça uma corrida de pelo menos 5 minutos (e 500 m) para
          gerar a planilha.
        </Text>
        <TouchableOpacity
          onPress={onStartGps}
          activeOpacity={0.85}
          className="h-12 rounded-xl bg-primary items-center justify-center flex-row gap-2"
        >
          <Ionicons name="navigate" size={16} color={Colors.white} />
          <Text className="text-white font-bold">Fazer corrida de teste</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const level = detectLevel(base);
  const goals = availableGoals(level);
  const suggested = suggestedGoal(base);
  const goal = pickedGoal && goals.includes(pickedGoal) ? pickedGoal : suggested;

  return (
    <View className="bg-card rounded-2xl border p-4 mb-4" style={{ borderColor: Colors.primary }}>
      <Text className="text-text text-lg font-bold">📋 Monte sua planilha</Text>
      <Text className="text-secondary-text text-sm mt-0.5 mb-3">Com base na sua corrida de teste:</Text>

      <View className="bg-background rounded-xl p-3 mb-4">
        <View className="flex-row">
          <TestStat label="Distância" value={`${formatKm(base.distanceMeters)} km`} />
          <TestStat label="Tempo" value={formatClock(base.durationSeconds)} />
          <TestStat label="Pace" value={`${formatPace(paceOf(base.distanceMeters, base.durationSeconds))}`} />
        </View>
        <View className="flex-row items-center gap-2 mt-3 pt-3 border-t border-border">
          <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: '#D628281F' }}>
            <Text className="text-text text-xs font-bold">Nível: {LEVEL_LABELS[level]}</Text>
          </View>
        </View>
        <Text className="text-secondary-text text-xs leading-5 mt-2">{LEVEL_EXPLANATION[level]}</Text>
      </View>

      <Text className="text-text text-sm font-semibold mb-2">Quantos dias por semana você quer correr?</Text>
      <View className="flex-row gap-2 mb-4">
        {DAY_OPTIONS.map((d) => (
          <Chip key={d} label={`${d}x`} active={d === days} onPress={() => setDays(d)} />
        ))}
      </View>

      <Text className="text-text text-sm font-semibold mb-2">Qual seu objetivo?</Text>
      <View className="gap-2 mb-4">
        {goals.map((g) => (
          <TouchableOpacity
            key={g}
            onPress={() => setPickedGoal(g)}
            activeOpacity={0.8}
            className="flex-row items-center h-11 rounded-xl px-3 border"
            style={{
              backgroundColor: g === goal ? '#D628281F' : Colors.background,
              borderColor: g === goal ? Colors.primary : Colors.border,
            }}
          >
            <Ionicons
              name={g === goal ? 'radio-button-on' : 'radio-button-off'}
              size={16}
              color={g === goal ? Colors.primary : Colors.secondaryText}
            />
            <Text className="text-text text-sm ml-2 flex-1">{GOAL_LABELS[g]}</Text>
            {g === suggested && <Text className="text-secondary-text text-xs">sugerido</Text>}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={() => setPlan(generatePlan(base, goal, days, new Date()))}
        activeOpacity={0.85}
        className="h-14 rounded-xl bg-primary items-center justify-center flex-row gap-2"
      >
        <Ionicons name="sparkles" size={18} color={Colors.white} />
        <Text className="text-white font-bold text-base">Gerar minha planilha</Text>
      </TouchableOpacity>
      <Text className="text-secondary-text text-center mt-2" style={{ fontSize: 11 }}>
        Quer refazer o teste? É só fazer outra corrida — a planilha usa a mais recente.
      </Text>
    </View>
  );
}

function TestStat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-text text-base font-bold">{value}</Text>
      <Text className="text-secondary-text" style={{ fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="flex-1 h-11 rounded-xl items-center justify-center border"
      style={{
        backgroundColor: active ? Colors.primary : Colors.background,
        borderColor: active ? Colors.primary : Colors.border,
      }}
    >
      <Text className="font-bold text-sm" style={{ color: active ? Colors.white : Colors.secondaryText }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── 3. Tem planilha: próximo treino e semanas ──────────────────────────────

const KIND_ICON: Record<PlanSession['kind'], keyof typeof Ionicons.glyphMap> = {
  runwalk: 'walk-outline',
  easy: 'leaf-outline',
  tempo: 'speedometer-outline',
  intervals: 'flash-outline',
  long: 'trail-sign-outline',
  test: 'flag-outline',
};

export function PlanCard({ plan, onStartSession }: { plan: TrainingPlan; onStartSession: (s: PlanSession, mode: 'gps' | 'treadmill') => void }) {
  const setPlan = useRunStore((s) => s.setPlan);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const next = nextSession(plan);
  const doneCount = Object.keys(plan.completed).length;
  const total = plan.sessions.length;
  const weekNow = currentWeek(plan, new Date());
  const openWeek = expandedWeek ?? next?.week ?? weekNow;
  const openSession = plan.sessions.find((s) => s.id === openSessionId) ?? null;

  return (
    <View className="bg-card rounded-2xl border p-4 mb-4" style={{ borderColor: Colors.primary }}>
      <View className="flex-row items-center">
        <Text className="text-text text-lg font-bold flex-1">📋 Sua planilha</Text>
        <Text className="text-secondary-text text-xs">Semana {weekNow} de {plan.weeks}</Text>
      </View>
      <Text className="text-secondary-text text-xs mt-0.5">
        {GOAL_LABELS[plan.goal]} · {plan.daysPerWeek}x por semana · {LEVEL_LABELS[plan.level]}
      </Text>

      <View className="flex-row items-center gap-2 mt-3">
        <View className="flex-1 h-2 bg-background rounded-full overflow-hidden">
          <View className="h-full bg-primary rounded-full" style={{ width: `${(doneCount / total) * 100}%` }} />
        </View>
        <Text className="text-secondary-text text-xs">
          {doneCount}/{total} treinos
        </Text>
      </View>

      {/* Próximo treino */}
      {next ? (
        <View className="bg-background rounded-xl p-3.5 mt-4">
          <Text className="text-primary text-xs font-bold uppercase tracking-wider">
            Próximo treino · Semana {next.week}
            {next.week < weekNow ? ' (atrasado)' : ''}
          </Text>
          <View className="flex-row items-center gap-2.5 mt-2">
            <Ionicons name={KIND_ICON[next.kind]} size={20} color={Colors.text} />
            <View className="flex-1">
              <Text className="text-text text-base font-bold">{next.title}</Text>
              <Text className="text-secondary-text text-xs">{next.summary}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => onStartSession(next, 'gps')}
            activeOpacity={0.85}
            className="h-12 rounded-xl bg-primary items-center justify-center flex-row gap-2 mt-3"
          >
            <Ionicons name="play" size={16} color={Colors.white} />
            <Text className="text-white font-bold">Iniciar este treino</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setOpenSessionId(next.id)} activeOpacity={0.7} className="items-center pt-2.5">
            <Text className="text-secondary-text text-xs">Ver como fazer · outras opções</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="bg-background rounded-xl p-4 mt-4 items-center">
          <Text style={{ fontSize: 32 }}>🏁</Text>
          <Text className="text-text font-bold text-base mt-1">Planilha concluída!</Text>
          <Text className="text-secondary-text text-xs text-center mt-1 mb-3 leading-5">
            Parabéns! Gere uma nova planilha — ela vai usar sua corrida mais recente como base.
          </Text>
          <TouchableOpacity
            onPress={() => setPlan(null)}
            activeOpacity={0.85}
            className="h-11 rounded-xl bg-primary items-center justify-center px-5"
          >
            <Text className="text-white font-bold text-sm">Gerar nova planilha</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Semanas */}
      <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mt-5 mb-1">
        Todas as semanas
      </Text>
      {Array.from({ length: plan.weeks }, (_, i) => i + 1).map((week) => {
        const sessions = plan.sessions.filter((s) => s.week === week);
        const weekDone = sessions.filter((s) => plan.completed[s.id]).length;
        const open = week === openWeek;
        return (
          <View key={week} className="border-t border-border">
            <TouchableOpacity
              onPress={() => setExpandedWeek(open ? 0 : week)}
              activeOpacity={0.7}
              className="flex-row items-center py-2.5"
            >
              <Text className="text-text text-sm font-semibold flex-1">
                Semana {week}
                {week === 4 && plan.level !== 'iniciante' ? ' · recuperação' : ''}
                {week === plan.weeks ? ' · teste final' : ''}
              </Text>
              <Text
                className="text-xs mr-2"
                style={{ color: weekDone === sessions.length ? Colors.success : Colors.secondaryText }}
              >
                {weekDone}/{sessions.length}
              </Text>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.secondaryText} />
            </TouchableOpacity>
            {open &&
              sessions.map((s) => {
                const done = !!plan.completed[s.id];
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setOpenSessionId(s.id)}
                    activeOpacity={0.75}
                    className="flex-row items-center gap-3 py-2 pl-1"
                  >
                    <View
                      className="w-6 h-6 rounded-full items-center justify-center border"
                      style={{
                        backgroundColor: done ? Colors.success : 'transparent',
                        borderColor: done ? Colors.success : s.id === next?.id ? Colors.primary : Colors.border,
                      }}
                    >
                      {done ? (
                        <Ionicons name="checkmark" size={14} color={Colors.white} />
                      ) : (
                        <Text className="text-secondary-text" style={{ fontSize: 10 }}>{s.order}</Text>
                      )}
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-sm"
                        style={{ color: done ? Colors.secondaryText : Colors.text, fontWeight: s.id === next?.id ? '700' : '500' }}
                      >
                        {s.title}
                      </Text>
                      <Text className="text-secondary-text text-xs" numberOfLines={1}>{s.summary}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={Colors.secondaryText} />
                  </TouchableOpacity>
                );
              })}
          </View>
        );
      })}

      {/* Refazer */}
      <View className="border-t border-border pt-3 mt-1">
        {confirmReset ? (
          <View className="flex-row items-center gap-2">
            <Text className="text-secondary-text text-xs flex-1">Apagar esta planilha e montar outra?</Text>
            <TouchableOpacity
              onPress={() => setConfirmReset(false)}
              activeOpacity={0.7}
              className="h-8 px-3 rounded-lg border border-border items-center justify-center"
            >
              <Text className="text-secondary-text text-xs">Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPlan(null)}
              activeOpacity={0.85}
              className="h-8 px-3 rounded-lg items-center justify-center bg-primary"
            >
              <Text className="text-white text-xs font-bold">Refazer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setConfirmReset(true)} activeOpacity={0.7} className="items-center">
            <Text className="text-secondary-text text-xs">Refazer planilha</Text>
          </TouchableOpacity>
        )}
      </View>

      <SessionModal
        plan={plan}
        session={openSession}
        onClose={() => setOpenSessionId(null)}
        onStart={(mode) => {
          if (!openSession) return;
          setOpenSessionId(null);
          onStartSession(openSession, mode);
        }}
      />
    </View>
  );
}

// Detalhe de um treino: como fazer, etapas, pace alvo e ações.
function SessionModal({
  plan,
  session,
  onClose,
  onStart,
}: {
  plan: TrainingPlan;
  session: PlanSession | null;
  onClose: () => void;
  onStart: (mode: 'gps' | 'treadmill') => void;
}) {
  const completePlanSession = useRunStore((s) => s.completePlanSession);
  const uncompletePlanSession = useRunStore((s) => s.uncompletePlanSession);
  const done = session ? !!plan.completed[session.id] : false;

  // Etapas agrupadas para leitura: "7× Corra 1:30 / Caminhe 1:30" vira uma lista curta.
  const steps = session?.blocks?.reduce<{ label: string; seconds: number; count: number }[]>((acc, b) => {
    const label = BLOCK_LABELS[b.kind];
    const prev = acc[acc.length - 1];
    const prevPrev = acc[acc.length - 2];
    // Padrão alternado (corra/caminhe, forte/recupere): conta repetições do par.
    if (prevPrev && prevPrev.label === label && prevPrev.seconds === b.seconds && prev) {
      prevPrev.count++;
      return acc;
    }
    if (prev && prev.label === label && prev.seconds === b.seconds) {
      prev.count++;
      return acc;
    }
    acc.push({ label, seconds: b.seconds, count: 1 });
    return acc;
  }, []);

  return (
    <Modal visible={session !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}>
        {session && (
          <View className="bg-card rounded-t-3xl" style={{ maxHeight: '88%' }}>
            <View className="flex-row items-center px-5 py-4 border-b border-border">
              <View className="flex-1">
                <Text className="text-secondary-text text-xs">
                  Semana {session.week} · Treino {session.order}
                  {done ? ' · ✓ feito' : ''}
                </Text>
                <Text className="text-text font-bold text-lg">{session.title}</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.7}
                className="w-8 h-8 rounded-full bg-background items-center justify-center"
              >
                <Text className="text-secondary-text">✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text className="text-text text-base font-semibold">{session.summary}</Text>
              <Text className="text-secondary-text text-sm leading-5 mt-2">{session.description}</Text>

              {steps && steps.length > 0 && (
                <View className="bg-background rounded-xl p-3 mt-4">
                  <Text className="text-secondary-text text-xs font-semibold uppercase tracking-wider mb-2">
                    Etapas
                  </Text>
                  {steps.map((step, i) => (
                    <View key={i} className="flex-row items-center py-1">
                      <Text className="text-text text-sm flex-1">
                        {step.count > 1 ? `${step.count}× ` : ''}
                        {step.label}
                      </Text>
                      <Text className="text-secondary-text text-sm" style={{ fontVariant: ['tabular-nums'] }}>
                        {formatClock(step.seconds)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {session.paceMin !== null && session.paceMax !== null && (
                <Text className="text-secondary-text text-xs mt-3">
                  Pace alvo: <Text className="text-text font-semibold">{formatPace(session.paceMin)}–{formatPace(session.paceMax)} /km</Text>
                  {' '}— o app avisa durante a corrida se você estiver fora.
                </Text>
              )}

              <View className="gap-2 mt-5">
                <TouchableOpacity
                  onPress={() => onStart('gps')}
                  activeOpacity={0.85}
                  className="h-12 rounded-xl bg-primary items-center justify-center flex-row gap-2"
                >
                  <Ionicons name="navigate" size={16} color={Colors.white} />
                  <Text className="text-white font-bold">{done ? 'Fazer de novo (GPS)' : 'Iniciar com GPS'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onStart('treadmill')}
                  activeOpacity={0.8}
                  className="h-11 rounded-xl border border-border items-center justify-center flex-row gap-2"
                >
                  <Ionicons name="speedometer-outline" size={15} color={Colors.secondaryText} />
                  <Text className="text-secondary-text text-sm font-medium">Fazer na esteira</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (done) uncompletePlanSession(session.id);
                    else completePlanSession(session.id, null);
                    onClose();
                  }}
                  activeOpacity={0.7}
                  className="items-center py-2"
                >
                  <Text className="text-secondary-text text-xs">
                    {done ? 'Desmarcar como feito' : 'Já fiz este treino — marcar como feito'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}
