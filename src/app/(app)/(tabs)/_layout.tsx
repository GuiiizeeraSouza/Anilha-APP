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

      <NativeTabs.Trigger name="social">
        <NativeTabs.Trigger.Label>Social</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="people-outline" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="person-circle-outline" />}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
