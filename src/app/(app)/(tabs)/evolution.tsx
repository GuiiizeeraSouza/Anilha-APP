import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { OverviewEvolution } from '@/modules/evolution/components/overview-evolution';
import { RunningEvolution } from '@/modules/evolution/components/running-evolution';
import { WorkoutEvolution } from '@/modules/evolution/components/workout-evolution';
import { Container } from '@/shared/components/container';
import { ProfileButton } from '@/shared/components/profile-button';
import { Colors } from '@/shared/theme/colors';

type Tab = 'overview' | 'workouts' | 'running';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'workouts', label: 'Por treino' },
  { id: 'running', label: 'Corrida' },
];

export default function EvolutionScreen() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <Container safe={false}>
      <View className="px-5 pt-14 pb-4 border-b border-border">
        <View className="flex-row items-center">
          <View className="flex-1">
            <Text className="text-text text-lg font-bold">Evolução</Text>
            <Text className="text-secondary-text text-xs">Seu progresso nos treinos e corridas</Text>
          </View>
          <ProfileButton />
        </View>

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
        {tab === 'overview' ? (
          <OverviewEvolution />
        ) : tab === 'workouts' ? (
          <WorkoutEvolution />
        ) : (
          <RunningEvolution />
        )}
      </ScrollView>
    </Container>
  );
}
