import type { ActiveRun, GeoPoint, LatLng, Run } from './types';

// ── GPS ──────────────────────────────────────────────────────────────────────

// Pontos com precisão pior que isso são descartados (sinal ruim, ex: entre prédios).
const MAX_ACCURACY_M = 35;
// Deslocamento menor que isso entre dois pontos é tratado como ruído do GPS
// (o ponto "treme" mesmo parado).
const MIN_STEP_M = 3;
// Acima disso não é corrida — salto do GPS (ou carro/ônibus).
const MAX_SPEED_MS = 9; // ~32 km/h
// Distância mínima entre pontos guardados no trajeto do mapa — o suficiente
// para a linha ficar fiel sem guardar um ponto por segundo.
const ROUTE_MIN_STEP_M = 8;

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function movingSeconds(run: Pick<ActiveRun, 'startedAt' | 'pausedAt' | 'pausedMs'>, nowMs: number): number {
  const end = run.pausedAt ?? nowMs;
  return Math.max(0, Math.floor((end - run.startedAt - run.pausedMs) / 1000));
}

// Acrescenta o ponto ao trecho atual do trajeto (se andou o bastante desde o
// último ponto guardado).
function appendToRoute(route: LatLng[][] | undefined, point: GeoPoint): LatLng[][] {
  const segments = route && route.length > 0 ? route : [[]];
  const current = segments[segments.length - 1];
  const prev = current[current.length - 1];
  if (
    prev &&
    haversineMeters(
      { latitude: prev[0], longitude: prev[1], accuracy: null, timestamp: 0 },
      point,
    ) < ROUTE_MIN_STEP_M
  ) {
    return segments;
  }
  return [...segments.slice(0, -1), [...current, [point.latitude, point.longitude]]];
}

// Aplica um novo ponto de GPS à corrida em andamento. Retorna só os campos que
// mudam, ou null se o ponto foi descartado.
export function applyGpsPoint(
  run: ActiveRun,
  point: GeoPoint,
): Pick<ActiveRun, 'distanceMeters' | 'lastPoint' | 'splitSeconds' | 'route'> | null {
  if (run.pausedAt !== null) return null;
  if (point.accuracy !== null && point.accuracy > MAX_ACCURACY_M) return null;

  const last = run.lastPoint;
  if (!last) {
    return {
      distanceMeters: run.distanceMeters,
      lastPoint: point,
      splitSeconds: run.splitSeconds,
      route: appendToRoute(run.route, point),
    };
  }
  if (point.timestamp <= last.timestamp) return null;

  const step = haversineMeters(last, point);
  if (step < MIN_STEP_M) return null;
  const dt = (point.timestamp - last.timestamp) / 1000;
  if (step / dt > MAX_SPEED_MS) return null;

  const distanceMeters = run.distanceMeters + step;
  const splitSeconds = [...run.splitSeconds];
  const completedKm = Math.floor(distanceMeters / 1000);
  while (splitSeconds.length < completedKm) {
    splitSeconds.push(movingSeconds(run, point.timestamp));
  }
  return { distanceMeters, lastPoint: point, splitSeconds, route: appendToRoute(run.route, point) };
}

// ── Simplificação do trajeto (para salvar no histórico) ─────────────────────

// Tolerância do Douglas-Peucker: pontos que desviam menos que isso da reta
// entre os vizinhos são removidos. Num percurso real sobra ~1 ponto a cada
// 20–50 m, sem mudar o desenho.
const SIMPLIFY_TOLERANCE_M = 4;

function simplifySegment(points: LatLng[]): LatLng[] {
  if (points.length <= 2) return points;
  // Projeção local em metros (equiretangular) — suficiente para alguns km.
  const lat0 = (points[0][0] * Math.PI) / 180;
  const xy = points.map(([lat, lon]) => [lon * 111320 * Math.cos(lat0), lat * 110540]);

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = xy[a];
    const [bx, by] = xy[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let maxDist = 0;
    let index = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i];
      const dist = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }
    if (index !== -1 && maxDist > SIMPLIFY_TOLERANCE_M) {
      keep[index] = true;
      stack.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

// Simplifica e arredonda (5 casas ≈ 1 m) — deixa o trajeto leve para guardar.
export function simplifyRoute(route: LatLng[][] | undefined): LatLng[][] {
  const round = (n: number) => Math.round(n * 1e5) / 1e5;
  return (route ?? [])
    .filter((segment) => segment.length >= 2)
    .map((segment) => simplifySegment(segment).map(([lat, lon]): LatLng => [round(lat), round(lon)]));
}

export function hasRoute(route: LatLng[][] | undefined): boolean {
  return (route ?? []).some((segment) => segment.length >= 2);
}

// ── Formatação ───────────────────────────────────────────────────────────────

// Segundos por km → "5:32"
export function formatPace(secondsPerKm: number | null): string {
  if (secondsPerKm === null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '—';
  const total = Math.round(secondsPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function paceOf(distanceMeters: number, durationSeconds: number): number | null {
  // Abaixo de 100 m o pace é só ruído.
  if (distanceMeters < 100 || durationSeconds <= 0) return null;
  return durationSeconds / (distanceMeters / 1000);
}

export function formatKm(meters: number, decimals = 2): string {
  return (meters / 1000).toFixed(decimals).replace('.', ',');
}

// "1:02:05" / "25:10"
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// Aceita "25", "25:30", "1:05:30" → segundos. null se inválido.
export function parseClock(text: string): number | null {
  const parts = text.trim().split(':').map((p) => p.trim());
  if (parts.length === 0 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  const seconds =
    nums.length === 3
      ? nums[0] * 3600 + nums[1] * 60 + nums[2]
      : nums.length === 2
      ? nums[0] * 60 + nums[1]
      : nums[0] * 60; // só um número = minutos
  return seconds > 0 ? seconds : null;
}

// "5,2" / "5.2" → metros
export function parseKm(text: string): number | null {
  const n = parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null;
}

// Durações de cada km a partir dos tempos acumulados.
export function splitDurations(splitSeconds: number[]): number[] {
  return splitSeconds.map((t, i) => t - (i > 0 ? splitSeconds[i - 1] : 0));
}

// ── Previsão de provas (fórmula de Riegel: T2 = T1 × (D2/D1)^1.06) ──────────

export const RACE_DISTANCES = [
  { label: '5 km', meters: 5000 },
  { label: '10 km', meters: 10000 },
  { label: 'Meia maratona', meters: 21097 },
  { label: 'Maratona', meters: 42195 },
];

export function riegelSeconds(baseMeters: number, baseSeconds: number, targetMeters: number): number {
  return baseSeconds * Math.pow(targetMeters / baseMeters, 1.06);
}

// Melhor corrida recente para basear a previsão: a de melhor desempenho
// equivalente (previsão de 5 km mais rápida) entre as corridas de pelo menos
// 3 km nos últimos 90 dias.
export function bestRunForPrediction(runs: Run[], nowMs: number): Run | null {
  const since = nowMs - 90 * 24 * 60 * 60 * 1000;
  let best: { run: Run; fiveK: number } | null = null;
  for (const run of runs) {
    if (run.distanceMeters < 3000 || new Date(run.startedAt).getTime() < since) continue;
    const fiveK = riegelSeconds(run.distanceMeters, run.durationSeconds, 5000);
    if (!best || fiveK < best.fiveK) best = { run, fiveK };
  }
  return best?.run ?? null;
}

export const EFFORT_LABELS: Record<NonNullable<Run['effort']>, string> = {
  leve: 'Leve',
  moderado: 'Moderado',
  forte: 'Forte',
};

export const SOURCE_LABELS: Record<Run['source'], string> = {
  gps: 'GPS',
  treadmill: 'Esteira',
  manual: 'Manual',
};
