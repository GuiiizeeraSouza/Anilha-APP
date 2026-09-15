import Ionicons from '@expo/vector-icons/Ionicons';
import type { Href } from 'expo-router';
import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, Text } from 'react-native';

import { Colors } from '@/shared/theme/colors';

// Versão web das abas: usa expo-router/ui (navegação client-side, via router)
// em vez de NativeTabs — que é uma view nativa e, no navegador, força
// recarregamento de página entre abas (isso tira o PWA do modo "instalado"
// e some com a UI do sistema, mostrando a barra de endereço do navegador).

const TABS: { name: string; href: Href; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { name: 'workouts', href: '/workouts', label: 'Treinos', icon: 'barbell-outline' },
  { name: 'evolution', href: '/evolution', label: 'Evolução', icon: 'stats-chart-outline' },
  { name: 'home', href: '/home', label: 'Treino do dia', icon: 'flame-outline' },
  { name: 'social', href: '/social', label: 'Social', icon: 'people-outline' },
  { name: 'profile', href: '/profile', label: 'Perfil', icon: 'person-circle-outline' },
];

type TabButtonProps = TabTriggerSlotProps & {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

function TabButton({ label, icon, isFocused, ...props }: TabButtonProps) {
  const color = isFocused ? Colors.primary : Colors.secondaryText;
  return (
    <Pressable
      {...props}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
      }}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text style={{ fontSize: 10, marginTop: 3, color, fontWeight: isFocused ? '700' : '500' }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function TabsLayoutWeb() {
  return (
    <Tabs>
      <TabSlot />
      <TabList
        style={{
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          backgroundColor: Colors.card,
          paddingBottom: 'max(6px, env(safe-area-inset-bottom))' as unknown as number,
        }}
      >
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
            <TabButton label={tab.label} icon={tab.icon} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}
