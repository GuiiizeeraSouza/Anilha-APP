import * as Location from 'expo-location';

import type { GymLocation } from './gym-store';

export const GYM_RADIUS_OPTIONS = [100, 150, 300] as const;
export const DEFAULT_GYM_RADIUS = 150;

// Distância em metros entre dois pontos (fórmula de haversine).
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Está na academia agora? Só consulta o GPS se a permissão já foi dada (ela é
// pedida ao salvar o local) — nunca abre o pedido de permissão do nada.
export async function isAtGym(gym: GymLocation): Promise<boolean> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return false;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return distanceMeters(pos.coords, gym) <= gym.radius;
}
