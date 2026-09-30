import { Text, View } from 'react-native';

interface EmptyCardProps {
  icon: string;
  title: string;
  text: string;
}

export function EmptyCard({ icon, title, text }: EmptyCardProps) {
  return (
    <View className="bg-card rounded-2xl p-6 border border-border items-center mb-4">
      <Text style={{ fontSize: 34, marginBottom: 10 }}>{icon}</Text>
      <Text className="text-text font-semibold text-base mb-1">{title}</Text>
      <Text className="text-secondary-text text-sm text-center leading-5">{text}</Text>
    </View>
  );
}
