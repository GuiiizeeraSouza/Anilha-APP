import Ionicons from '@expo/vector-icons/Ionicons';
import type { Href } from 'expo-router';
import { Link, Slot, usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Colors } from '@/shared/theme/colors';

// Versão web das abas: usa <Slot /> (renderiza a rota ativa) + <Link />
// (navegação client-side) em vez de NativeTabs (nativo, força reload de
// página inteira no navegador — tira o PWA do modo standalone) ou do
// sistema expo-router/ui Tabs/TabSlot (que passou a depender de
// react-native-screens e quebrou scroll/altura no web).

const TABS: { href: Href; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { href: '/workouts', label: 'Treinos', icon: 'barbell-outline' },
  { href: '/evolution', label: 'Evolução', icon: 'stats-chart-outline' },
  { href: '/home', label: 'Treino do dia', icon: 'flame-outline' },
  { href: '/social', label: 'Social', icon: 'people-outline' },
  { href: '/profile', label: 'Perfil', icon: 'person-circle-outline' },
];

export default function TabsLayoutWeb() {
  const pathname = usePathname();

  return (
    <View style={{ flex: 1, height: '100%', minHeight: 0 }}>
      <View style={{ flex: 1, minHeight: 0 }}>
        <Slot />
      </View>

      <View
        style={{
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          backgroundColor: Colors.card,
          paddingBottom: 'max(6px, env(safe-area-inset-bottom))' as unknown as number,
        }}
      >
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          const color = active ? Colors.primary : Colors.secondaryText;
          return (
            <Link key={tab.label} href={tab.href} asChild replace>
              <Pressable
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}
              >
                <Ionicons name={tab.icon} size={22} color={color} />
                <Text style={{ fontSize: 10, marginTop: 3, color, fontWeight: active ? '700' : '500' }} numberOfLines={1}>
                  {tab.label}
                </Text>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </View>
  );
}
