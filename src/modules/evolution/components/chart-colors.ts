import { Colors } from '@/shared/theme/colors';

// Gráficos de série única: o ponto/coluna em foco usa o destaque (vermelho do
// app) e o resto fica em cinza. Texto nunca usa a cor da série.
export const ChartColors = {
  accent: Colors.primary,
  muted: '#454545',
  grid: '#2E2E2E',
  surface: Colors.card, // anel em volta dos pontos do gráfico de linha
  textStrong: Colors.text,
  textMuted: '#707070',
} as const;
