import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import type { LatLng } from './types';

export type PositionStatus = 'searching' | 'ok' | 'denied' | 'error';

export interface CurrentPosition {
  status: PositionStatus;
  position: LatLng | null;
  accuracy: number | null; // metros
}

const INITIAL: CurrentPosition = { status: 'searching', position: null, accuracy: null };

// Acompanha a posição do usuário enquanto `enabled` (ex: aba Corrida aberta e
// sem corrida em andamento) — para mostrar o mapa e a qualidade do sinal antes
// de começar. Desligado, para de usar o GPS.
export function useCurrentPosition(enabled: boolean): CurrentPosition {
  const [state, setState] = useState<CurrentPosition>(INITIAL);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync().catch(() => null);
      if (cancelled) return;
      if (!permission || permission.status !== 'granted') {
        setState({ status: 'denied', position: null, accuracy: null });
        return;
      }
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 5 },
        (location) => {
          setState({
            status: 'ok',
            position: [location.coords.latitude, location.coords.longitude],
            accuracy: location.coords.accuracy,
          });
        },
        () => setState((prev) => ({ ...prev, status: prev.position ? prev.status : 'error' })),
      ).catch(() => {
        setState((prev) => ({ ...prev, status: prev.position ? prev.status : 'error' }));
        return null;
      });
      if (cancelled) subscription?.remove();
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);

  return state;
}
