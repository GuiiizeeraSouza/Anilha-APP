import { Text, View } from 'react-native';

interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
}

export function StatTile({ label, value, hint }: StatTileProps) {
  return (
    <View className="flex-1 bg-background rounded-xl px-3 py-3">
      <Text className="text-secondary-text text-xs" numberOfLines={1}>
        {label}
      </Text>
      <Text className="text-text text-lg font-bold mt-1" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? (
        <Text className="text-secondary-text mt-0.5" style={{ fontSize: 11 }} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
