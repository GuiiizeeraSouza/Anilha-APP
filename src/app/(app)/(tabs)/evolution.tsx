import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { OverviewEvolution } from '@/modules/evolution/components/overview-evolution';
import { WorkoutEvolution } from '@/modules/evolution/components/workout-evolution';
import { Colors } from '@/shared/theme/colors';
import { Container } from '@/shared/components/container';

type Tab = 'workouts' | 'overview';

const TABS: { id: Tab; label: string }[] = [
  { id: 'workouts', label: 'Por treino' },
  { id: 'overview', label: 'Visão geral' },
];

export default function EvolutionScreen() {
  const [tab, setTab] = useState<Tab>('workouts');

  return (
    <Container safe={false}>
      <View className="px-5 pt-14 pb-4 border-b border-border">
        <Text className="text-text text-lg font-bold">Evolução</Text>
        <Text className="text-secondary-text text-xs">Seu progresso em cada treino</Text>

        <View className="flex-row bg-card rounded-xl p-1 mt-4 border border-border">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setTab(t.id)}
                activeOpacity={0.8}
                className="flex-1 h-9 rounded-lg items-center justify-center"
                style={{ backgroundColor: active ? Colors.primary : 'transparent' }}
              >
                <Text className="text-sm font-semibold" style={{ color: active ? Colors.white : Colors.secondaryText }}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'workouts' ? <WorkoutEvolution /> : <OverviewEvolution />}
      </ScrollView>
    </Container>
  );
}
