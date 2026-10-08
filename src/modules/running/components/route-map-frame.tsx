import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/shared/theme/colors';

interface MapFrameProps {
  height: number;
  hasFix: boolean;
  emptyLabel: string;
  emptyLoading: boolean;
  following: boolean;
  onRecenter: () => void;
  children: React.ReactNode;
}

// Moldura comum às versões web e nativa do mapa: cantos arredondados, aviso
// enquanto o GPS não deu o primeiro ponto e o botão "Centralizar".
export function MapFrame({ height, hasFix, emptyLabel, emptyLoading, following, onRecenter, children }: MapFrameProps) {
  return (
    <View
      className="rounded-2xl border border-border overflow-hidden mb-3"
      style={{ height, backgroundColor: '#1a1a1a' }}
    >
      {children}

      {!hasFix && (
        <View
          className="absolute inset-0 items-center justify-center"
          style={{ backgroundColor: 'rgba(18,18,18,0.75)', pointerEvents: 'none' }}
        >
          {emptyLoading && <ActivityIndicator color={Colors.primary} />}
          <Text className="text-secondary-text text-xs mt-2 text-center px-6">{emptyLabel}</Text>
        </View>
      )}

      {hasFix && !following && (
        <TouchableOpacity
          onPress={onRecenter}
          activeOpacity={0.85}
          className="absolute top-2.5 right-2.5 flex-row items-center gap-1.5 rounded-full px-3 h-8"
          style={{ backgroundColor: 'rgba(18,18,18,0.9)', borderWidth: 1, borderColor: Colors.border }}
        >
          <Ionicons name="locate" size={14} color={Colors.text} />
          <Text className="text-text text-xs font-semibold">Centralizar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
