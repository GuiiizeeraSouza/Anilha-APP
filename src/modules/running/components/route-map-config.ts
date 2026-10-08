import { Colors } from '@/shared/theme/colors';

import type { LatLng } from '../types';

// Mapa escuro do CARTO (dados do OpenStreetMap) — combina com o tema do app e
// não precisa de chave de API. A atribuição é obrigatória pelos termos de uso.
export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
export const TILE_SUBDOMAINS = 'abcd';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const FOLLOW_ZOOM = 16;
export const ROUTE_COLOR = Colors.primary;
export const START_COLOR = Colors.success;

export interface RouteMapProps {
  route: LatLng[][];
  // Posição atual quando ainda não há trajeto (mapa antes de começar a correr).
  position?: LatLng | null;
  // true = enquadra o trajeto inteiro, sem seguir (detalhe de corrida salva);
  // false = segue a posição atual (corrida ao vivo).
  fit?: boolean;
  height?: number;
  // Texto sobre o mapa enquanto não há nada para mostrar.
  emptyLabel?: string;
  // Mostra o indicador de carregamento junto do emptyLabel (ex: esperando GPS).
  emptyLoading?: boolean;
}

export function allPointsOf(route: LatLng[][]): LatLng[] {
  return route.flat();
}

export function lastPointOf(route: LatLng[][]): LatLng | null {
  for (let i = route.length - 1; i >= 0; i--) {
    const segment = route[i];
    if (segment.length > 0) return segment[segment.length - 1];
  }
  return null;
}

export function firstPointOf(route: LatLng[][]): LatLng | null {
  for (const segment of route) {
    if (segment.length > 0) return segment[0];
  }
  return null;
}
