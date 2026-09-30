import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { useAllExercises } from '@/modules/workouts/hooks/use-all-exercises';
import { Colors } from '@/shared/theme/colors';
import { useAuthStore } from '@/store/auth-store';
import { useWorkoutStore } from '@/store/workout-store';

import {
  type AiSuggestion,
  type AiSuggestionKind,
  type CachedSuggestions,
  buildSuggestionsInput,
  currentWeekKey,
  fetchWeeklySuggestions,
  hasEnoughDataForSuggestions,
  loadCachedSuggestions,
  saveCachedSuggestions,
} from '../ai-suggestions';
import { formatKg } from '../utils';
import { SectionCard } from './section-card';

const KIND_STYLE: Record<AiSuggestionKind, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  increase: { icon: 'trending-up', color: Colors.success, label: 'Aumentar carga' },
  maintain: { icon: 'remove', color: Colors.secondaryText, label: 'Manter carga' },
  decrease: { icon: 'trending-down', color: Colors.error, label: 'Reduzir carga' },
  consistency: { icon: 'calendar-outline', color: '#3182CE', label: 'Frequência' },
  recovery: { icon: 'bed-outline', color: '#805AD5', label: 'Recuperação' },
  tip: { icon: 'bulb-outline', color: '#D69E2E', label: 'Dica' },
};

function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function SuggestionRow({ suggestion, first }: { suggestion: AiSuggestion; first: boolean }) {
  const style = KIND_STYLE[suggestion.kind];
  const showWeights =
    suggestion.currentWeightKg !== null &&
    suggestion.suggestedWeightKg !== null &&
    suggestion.suggestedWeightKg > 0;
  return (
    <View
      className="flex-row gap-3 py-3"
      style={{ borderTopWidth: first ? 0 : 1, borderTopColor: Colors.border }}
    >
      <View
        className="w-9 h-9 rounded-full items-center justify-center"
        style={{ backgroundColor: style.color + '22' }}
      >
        <Ionicons name={style.icon} size={18} color={style.color} />
      </View>
      <View className="flex-1">
        <Text className="text-secondary-text uppercase tracking-wider" style={{ fontSize: 10 }}>
          {style.label}
        </Text>
        <Text className="text-text text-sm font-semibold mt-0.5">{suggestion.title}</Text>
        {showWeights && (
          <View className="flex-row items-center gap-1.5 mt-1.5">
            <Text className="text-secondary-text text-xs">{formatKg(suggestion.currentWeightKg!)}</Text>
            <Ionicons name="arrow-forward" size={12} color={Colors.secondaryText} />
            <Text className="text-text text-xs font-bold">{formatKg(suggestion.suggestedWeightKg!)}</Text>
          </View>
        )}
        <Text className="text-secondary-text text-xs leading-5 mt-1">{suggestion.detail}</Text>
      </View>
    </View>
  );
}

// Sugestões de IA para a semana, geradas sob demanda e guardadas no aparelho
// até a semana virar (ou o usuário pedir para atualizar).
export function AiSuggestionsCard() {
  const userId = useAuthStore((s) => s.user?.id);
  const workouts = useWorkoutStore((s) => s.workouts);
  const completedSessions = useWorkoutStore((s) => s.completedSessions);
  const weightLogs = useWorkoutStore((s) => s.weightLogs);
  const timeLogs = useWorkoutStore((s) => s.exerciseTimeLogs);
  const allExercises = useAllExercises();

  const weekKey = currentWeekKey();
  const [result, setResult] = useState<CachedSuggestions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadCachedSuggestions(userId).then((cached) => {
      if (!cancelled && cached?.weekKey === weekKey) setResult(cached);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, weekKey]);

  const enoughData = hasEnoughDataForSuggestions({ completedSessions, weightLogs });

  async function generate() {
    if (!userId || loading) return;
    setLoading(true);
    setError(null);
    try {
      const suggestions = await fetchWeeklySuggestions(
        buildSuggestionsInput({ workouts, completedSessions, weightLogs, timeLogs, allExercises }),
      );
      const value = { weekKey, generatedAt: new Date().toISOString(), suggestions };
      setResult(value);
      saveCachedSuggestions(userId, value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar as sugestões.');
    } finally {
      setLoading(false);
    }
  }

  const current = result?.weekKey === weekKey ? result : null;

  return (
    <SectionCard title="✨ Sugestões da IA" aside="Para esta semana">
      {loading ? (
        <View className="items-center py-6">
          <ActivityIndicator color={Colors.primary} />
          <Text className="text-secondary-text text-sm mt-3">Analisando seus treinos...</Text>
        </View>
      ) : current ? (
        <>
          {current.suggestions.map((s, i) => (
            <SuggestionRow key={`${s.kind}-${s.title}`} suggestion={s} first={i === 0} />
          ))}
          {error && <Text className="text-error text-xs mt-2">{error}</Text>}
          <View className="flex-row items-center justify-between mt-2 pt-3 border-t border-border">
            <Text className="text-secondary-text" style={{ fontSize: 11 }}>
              Gerado em {formatGeneratedAt(current.generatedAt)}
            </Text>
            <TouchableOpacity onPress={generate} activeOpacity={0.7} hitSlop={8} className="flex-row items-center gap-1">
              <Ionicons name="refresh" size={13} color={Colors.primary} />
              <Text className="text-primary text-xs font-semibold">Atualizar</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View className="items-center py-2">
          <Text className="text-secondary-text text-sm text-center leading-5 mb-4">
            {enoughData
              ? 'A IA analisa suas cargas, frequência e histórico e sugere ajustes para esta semana — como quanto aumentar em cada exercício.'
              : 'Conclua alguns treinos e registre as cargas para receber sugestões personalizadas.'}
          </Text>
          {error && <Text className="text-error text-xs text-center mb-3">{error}</Text>}
          <TouchableOpacity
            onPress={generate}
            disabled={!enoughData}
            activeOpacity={0.85}
            className="h-11 rounded-xl bg-primary items-center justify-center px-6 flex-row gap-2"
            style={{ opacity: enoughData ? 1 : 0.4 }}
          >
            <Ionicons name="sparkles" size={16} color={Colors.white} />
            <Text className="text-white font-bold text-sm">{error ? 'Tentar novamente' : 'Gerar sugestões'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {(current || loading) && (
        <Text className="text-secondary-text mt-3" style={{ fontSize: 10 }}>
          Sugestões automáticas com base no seu histórico. Respeite seus limites e a orientação do seu professor.
        </Text>
      )}
    </SectionCard>
  );
}
