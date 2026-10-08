import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { Colors } from '@/shared/theme/colors';

import type { LatLng, Run } from '../types';
import { hasRoute } from '../utils';
import { ROUTE_COLOR, START_COLOR } from './route-map-config';

const PADDING = 6;

// Projeta o trajeto num quadrado size×size, mantendo a proporção.
function project(route: LatLng[][], size: number): { x: number; y: number }[][] {
  const points = route.flat();
  const cos = Math.cos((points[0][0] * Math.PI) / 180);
  const xs = points.map(([, lon]) => lon * cos);
  const ys = points.map(([lat]) => -lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const inner = size - PADDING * 2;
  const scale = inner / Math.max(spanX, spanY, 1e-9);
  const offsetX = PADDING + (inner - spanX * scale) / 2;
  const offsetY = PADDING + (inner - spanY * scale) / 2;
  return route.map((segment) =>
    segment.map(([lat, lon]) => ({
      x: offsetX + (lon * cos - minX) * scale,
      y: offsetY + (-lat - minY) * scale,
    })),
  );
}

const SOURCE_ICON: Record<Run['source'], keyof typeof Ionicons.glyphMap> = {
  gps: 'footsteps-outline',
  treadmill: 'speedometer-outline',
  manual: 'create-outline',
};

// "Mapinha" da corrida no histórico: só o desenho do trajeto (sem tiles — um
// mapa de verdade por linha seria pesado demais). Sem trajeto, mostra um ícone.
export function RouteThumbnail({ run, size = 52 }: { run: Run; size?: number }) {
  const frame = {
    width: size,
    height: size,
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: Colors.border,
  } as const;

  if (!hasRoute(run.route)) {
    return (
      <View className="items-center justify-center" style={frame}>
        <Ionicons name={SOURCE_ICON[run.source]} size={size * 0.4} color={Colors.secondaryText} />
      </View>
    );
  }

  const segments = project(
    run.route.filter((s) => s.length >= 2),
    size,
  );
  const start = segments[0][0];
  const lastSegment = segments[segments.length - 1];
  const end = lastSegment[lastSegment.length - 1];

  return (
    <View style={frame}>
      <Svg width={size} height={size}>
        {segments.map((segment, i) => (
          <Polyline
            key={i}
            points={segment.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
            fill="none"
            stroke={ROUTE_COLOR}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <Circle cx={start.x} cy={start.y} r={3} fill={START_COLOR} />
        <Circle cx={end.x} cy={end.y} r={3} fill={Colors.white} />
      </Svg>
    </View>
  );
}
