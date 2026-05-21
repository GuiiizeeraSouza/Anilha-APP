import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  safe?: boolean;
}

export function Container({ children, className = '', safe = true }: ContainerProps) {
  if (safe) {
    return (
      <SafeAreaView className={`flex-1 bg-background ${className}`}>
        {children}
      </SafeAreaView>
    );
  }

  return (
    <View className={`flex-1 bg-background ${className}`}>{children}</View>
  );
}
