import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChartColors } from './chart-colors';

export type ColumnDatum = {
  key: string;
  label: string; // eixo x (ex: "12/09")
  value: number;
  valueLabel: string; // ex: "52m"
};

interface ColumnChartProps {
  data: ColumnDatum[];
  emptyLabel: string;
  plotHeight?: number;
}

// Acima disso as datas do eixo x não cabem numa tela de celular.
const MAX_COLUMNS = 8;

// Colunas de uma única série, com base em zero, mostrando as 8 mais recentes.
// Toque numa coluna para ver o valor; a última (mais recente) vem selecionada.
// Só a coluna selecionada ganha a cor de destaque e o rótulo de valor — o
// resto fica em cinza.
export function ColumnChart({ data: allData, emptyLabel, plotHeight = 96 }: ColumnChartProps) {
  const data = allData.slice(-MAX_COLUMNS);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  if (data.length === 0) {
    return <Text className="text-secondary-text text-sm text-center py-6">{emptyLabel}</Text>;
  }

  // Seleção que não existe nos dados atuais (ex: trocou o dia de treino) →
  // volta para a coluna mais recente.
  const activeKey = data.some((d) => d.key === selectedKey) ? selectedKey : data[data.length - 1].key;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View>
      <View className="flex-row" style={{ height: plotHeight + 18, alignItems: 'flex-end' }}>
        {data.map((d) => {
          const active = d.key === activeKey;
          const barH = d.value > 0 ? Math.max((d.value / max) * plotHeight, 3) : 0;
          return (
            <Pressable
              key={d.key}
              onPress={() => setSelectedKey(d.key)}
              className="flex-1 items-center justify-end"
              style={{ height: '100%' }}
              hitSlop={{ top: 8, bottom: 8 }}
            >
              {active && (
                <Text className="text-text font-bold mb-1" style={{ fontSize: 11 }} numberOfLines={1}>
                  {d.valueLabel}
                </Text>
              )}
              <View
                style={{
                  width: '60%',
                  maxWidth: 22,
                  height: barH,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  backgroundColor: active ? ChartColors.accent : ChartColors.muted,
                }}
              />
            </Pressable>
          );
        })}
      </View>

      {/* Linha de base + eixo x */}
      <View style={{ height: 1, backgroundColor: ChartColors.grid }} />
      <View className="flex-row mt-1.5">
        {data.map((d) => (
          <Text
            key={d.key}
            className="flex-1 text-center"
            numberOfLines={1}
            style={{
              fontSize: 10,
              color: d.key === activeKey ? ChartColors.textStrong : ChartColors.textMuted,
              fontWeight: d.key === activeKey ? 'bold' : 'normal',
            }}
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
