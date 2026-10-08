import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Text, TouchableOpacity } from 'react-native';

import { Colors } from '@/shared/theme/colors';
import { useAuthStore } from '@/store/auth-store';

const SIZE = 36;

// Foto do usuário no canto do cabeçalho das abas — abre o Perfil (que saiu da
// barra de abas para caber a aba Corrida).
export function ProfileButton() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const name = (user?.user_metadata?.name as string | undefined) ?? 'U';

  return (
    <TouchableOpacity
      onPress={() => router.push('/profile')}
      activeOpacity={0.8}
      hitSlop={6}
      accessibilityLabel="Abrir perfil"
      className="items-center justify-center ml-3"
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        borderWidth: 2,
        borderColor: Colors.primary,
        backgroundColor: Colors.primary,
        overflow: 'hidden',
      }}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={{ width: SIZE, height: SIZE }} contentFit="cover" cachePolicy="memory-disk" />
      ) : (
        <Text className="text-white font-bold text-sm">{name[0]?.toUpperCase()}</Text>
      )}
    </TouchableOpacity>
  );
}
