import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface GymLocation {
  latitude: number;
  longitude: number;
  // Raio da cerca virtual em metros.
  radius: number;
  savedAt: string;
}

interface GymState {
  gym: GymLocation | null;
  // Dia (AAAA-MM-DD local) do último aviso de chegada — no máximo um por dia,
  // já que o GPS pode "entrar" na cerca várias vezes seguidas.
  lastPromptDay: string | null;
  setGym: (gym: GymLocation | null) => void;
  setLastPromptDay: (day: string) => void;
}

// Fica só no aparelho: o geofencing é do celular, não da conta.
export const useGymStore = create<GymState>()(
  persist(
    (set) => ({
      gym: null,
      lastPromptDay: null,
      setGym: (gym) => set({ gym }),
      setLastPromptDay: (day) => set({ lastPromptDay: day }),
    }),
    {
      name: 'gym-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function localDayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
