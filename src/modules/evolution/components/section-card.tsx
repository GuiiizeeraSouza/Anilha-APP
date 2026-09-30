import { Text, View } from 'react-native';

interface SectionCardProps {
  title: string;
  aside?: string;
  children: React.ReactNode;
}

export function SectionCard({ title, aside, children }: SectionCardProps) {
  return (
    <View className="bg-card rounded-2xl border border-border mb-4 overflow-hidden">
      <View className="flex-row items-center px-4 pt-4 pb-3 border-b border-border">
        <Text className="text-text text-base font-semibold flex-1" numberOfLines={1}>
          {title}
        </Text>
        {aside ? (
          <Text className="text-secondary-text text-xs ml-3" numberOfLines={1}>
            {aside}
          </Text>
        ) : null}
      </View>
      <View className="p-4">{children}</View>
    </View>
  );
}
