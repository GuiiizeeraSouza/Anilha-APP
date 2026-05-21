import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

interface HeaderProps {
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export function Header({ showBack = false, rightAction }: HeaderProps) {
  const router = useRouter();

  return (
    <View className="h-14 flex-row items-center px-4 mt-8 border-b border-border bg-background">
      {showBack && (
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3 w-10 h-10 items-center justify-center rounded-xl bg-card"
        >
          <Text className="text-primary text-lg font-bold">‹</Text>
        </TouchableOpacity>
      )}
      {rightAction != null && <View>{rightAction}</View>}
    </View>
  );
}
