// gps = medida pelo app · treadmill = esteira (distância digitada no fim) ·
// manual = corrida feita em outro lugar, registrada depois.
export type RunSource = 'gps' | 'treadmill' | 'manual';

export type RunEffort = 'leve' | 'moderado' | 'forte';

export interface Run {
  id: string;
  startedAt: string; // ISO
  distanceMeters: number;
  durationSeconds: number; // tempo em movimento (sem pausas)
  source: RunSource;
  effort: RunEffort | null;
  // Tempo de movimento acumulado (s) ao completar cada km.
  splitSeconds: number[];
  // Trajeto simplificado (só corridas com GPS), um trecho por período em movimento.
  route: LatLng[][];
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracy: number | null; // metros
  timestamp: number; // ms
}

// [latitude, longitude]
export type LatLng = [number, number];

// Corrida em andamento — persistida para sobreviver ao app recarregar.
export interface ActiveRun {
  mode: 'gps' | 'treadmill';
  startedAt: number; // ms
  pausedAt: number | null; // ms, quando pausada
  pausedMs: number; // total de tempo pausado já encerrado
  distanceMeters: number;
  lastPoint: GeoPoint | null; // último ponto aceito (null depois de pausar)
  splitSeconds: number[];
  // Trajeto para o mapa, um trecho por período em movimento (pausar começa um
  // novo trecho, para o mapa não ligar onde pausou a onde retomou). Opcional
  // porque corridas em andamento salvas antes do mapa não têm o campo.
  route?: LatLng[][];
  // Treino da planilha que esta corrida está cumprindo (ver plan.ts).
  planSessionId?: string;
}
