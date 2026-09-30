import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { DatedValue } from '../utils';
import { formatShortDate } from '../utils';
import { ChartColors } from './chart-colors';

// Pontos demais ficam apertados na largura de um celular.
const MAX_POINTS = 12;
const DOT = 10;
const Y_AXIS_WIDTH = 34;

interface LineChartProps {
  data: DatedValue[];
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
  emptyLabel: string;
  plotHeight?: number;
}

// Linha de uma única série (ex: peso ao longo do tempo), com eixo y ajustado ao
// intervalo dos dados — a posição dos pontos é o que importa aqui, então não
// precisa começar do zero (diferente das colunas). Desenhada só com Views:
// cada segmento é uma View de 2px rotacionada entre dois pontos.
export function LineChart({
  data: allData,
  formatValue,
  formatTick,
  emptyLabel,
  plotHeight = 110,
}: LineChartProps) {
  const data = allData.slice(-MAX_POINTS);
  const [width, setWidth] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  if (data.length === 0) {
    return <Text className="text-secondary-text text-sm text-center py-6">{emptyLabel}</Text>;
  }

  // Sem seleção (ou seleção de outro conjunto de dados) → ponto mais recente.
  const selectedIndex = data.findIndex((d) => d.date === selectedDate);
  const activeIndex = selectedIndex >= 0 ? selectedIndex : data.length - 1;
  const active = data[activeIndex];

  const values = data.map((d) => d.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    // Série sem variação: centraliza a linha.
    min -= 5;
    max += 5;
  }
  const pad = (max - min) * 0.15;
  const lo = Math.max(0, min - pad);
  const hi = max + pad;

  const plotWidth = Math.max(width - Y_AXIS_WIDTH, 0);
  const xFor = (i: number) =>
    data.length === 1 ? plotWidth / 2 : DOT / 2 + (i / (data.length - 1)) * (plotWidth - DOT);
  const yFor = (v: number) => plotHeight - ((v - lo) / (hi - lo)) * plotHeight;
  const points = data.map((d, i) => ({ x: xFor(i), y: yFor(d.value) }));
  const ticks = [hi, (hi + lo) / 2, lo];

  return (
    <View>
      {/* Leitura do ponto selecionado */}
      <View className="flex-row items-baseline gap-2 mb-3">
        <Text className="text-text text-lg font-bold">{formatValue(active.value)}</Text>
        <Text className="text-secondary-text text-xs">
          {activeIndex === data.length - 1 ? 'Último registro' : 'Registro'} · {formatShortDate(active.date)}
        </Text>
      </View>

      <View className="flex-row" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {/* Eixo y */}
        <View style={{ width: Y_AXIS_WIDTH, height: plotHeight, justifyContent: 'space-between' }}>
          {ticks.map((t, i) => (
            <Text
              key={i}
              style={{ fontSize: 10, color: ChartColors.textMuted, marginTop: i === 0 ? -6 : 0, marginBottom: i === 2 ? -6 : 0 }}
            >
              {formatTick(t)}
            </Text>
          ))}
        </View>

        {/* Área do gráfico */}
        <View style={{ flex: 1, height: plotHeight }}>
          {ticks.map((t, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: (i / (ticks.length - 1)) * plotHeight,
                height: 1,
                backgroundColor: ChartColors.grid,
              }}
            />
          ))}

          {plotWidth > 0 &&
            points.slice(1).map((p, i) => {
              const prev = points[i];
              const dx = p.x - prev.x;
              const dy = p.y - prev.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
              return (
                <View
                  key={`seg-${i}`}
                  style={{
                    position: 'absolute',
                    left: (prev.x + p.x) / 2 - len / 2,
                    top: (prev.y + p.y) / 2 - 1,
                    width: len,
                    height: 2,
                    borderRadius: 1,
                    backgroundColor: ChartColors.accent,
                    transform: [{ rotate: `${angle}deg` }],
                  }}
                />
              );
            })}

          {plotWidth > 0 &&
            points.map((p, i) => {
              const isActive = i === activeIndex;
              const size = isActive ? DOT + 4 : DOT;
              return (
                <Pressable
                  key={`dot-${i}`}
                  onPress={() => setSelectedDate(data[i].date)}
                  hitSlop={10}
                  style={{
                    position: 'absolute',
                    left: p.x - size / 2 - 2,
                    top: p.y - size / 2 - 2,
                    width: size + 4,
                    height: size + 4,
                    borderRadius: (size + 4) / 2,
                    backgroundColor: ChartColors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                      backgroundColor: isActive ? ChartColors.textStrong : ChartColors.accent,
                    }}
                  />
                </Pressable>
              );
            })}
        </View>
      </View>

      {/* Eixo x: só primeira e última data, para não colidir */}
      <View className="flex-row justify-between mt-2" style={{ paddingLeft: Y_AXIS_WIDTH }}>
        <Text style={{ fontSize: 10, color: ChartColors.textMuted }}>{formatShortDate(data[0].date)}</Text>
        {data.length > 1 && (
          <Text style={{ fontSize: 10, color: ChartColors.textMuted }}>
            {formatShortDate(data[data.length - 1].date)}
          </Text>
        )}
      </View>
    </View>
  );
}
