import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/shared/theme/colors';

export default function TabsLayout() {
  return (
    <NativeTabs
      backgroundColor={Colors.card}
      iconColor={{ default: Colors.secondaryText, selected: Colors.primary }}
      labelStyle={{
        default: { color: Colors.secondaryText },
        selected: { color: Colors.primary },
      }}
    >
      <NativeTabs.Trigger name="workouts">
        <NativeTabs.Trigger.Label>Treinos</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="barbell-outline" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="evolution">
        <NativeTabs.Trigger.Label>Evolução</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="stats-chart-outline" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Label>Treino do dia</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="flame-outline" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="running">
        <NativeTabs.Trigger.Label>Corrida</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="footsteps-outline" />}
        />
      </NativeTabs.Trigger>

      {/* Perfil fica fora das abas (botão com a foto no cabeçalho) — as abas
          nativas aceitam no máximo 5 itens. */}
      <NativeTabs.Trigger name="social">
        <NativeTabs.Trigger.Label>Social</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="people-outline" />}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
