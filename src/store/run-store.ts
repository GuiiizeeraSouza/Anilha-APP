import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import * as runService from '@/lib/run-service';
import type { TrainingPlan } from '@/modules/running/plan';
import type { ActiveRun, GeoPoint, Run } from '@/modules/running/types';
import { applyGpsPoint } from '@/modules/running/utils';
import { useAuthStore } from './auth-store';

const DEFAULT_WEEKLY_GOAL_KM = 15;

interface RunState {
  // true quando o estado persistido terminou de ser lido (ver workout-store).
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  runs: Run[];
  activeRun: ActiveRun | null;
  weeklyGoalKm: number;
  // Planilha de corrida (gerada a partir da corrida de teste). Fica salva no
  // aparelho; se sumir, dá para gerar de novo a partir da mesma corrida.
  plan: TrainingPlan | null;
  setRuns: (runs: Run[]) => void;
  resetStore: () => void;
  addRun: (run: Run) => void;
  removeRun: (id: string) => void;
  setWeeklyGoalKm: (km: number) => void;
  startRun: (mode: ActiveRun['mode'], planSessionId?: string) => void;
  pauseRun: () => void;
  resumeRun: () => void;
  addGpsPoint: (point: GeoPoint) => void;
  clearActiveRun: () => void;
  setPlan: (plan: TrainingPlan | null) => void;
  completePlanSession: (sessionId: string, runId: string | null) => void;
  uncompletePlanSession: (sessionId: string) => void;
}

export const useRunStore = create<RunState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      runs: [],
      activeRun: null,
      weeklyGoalKm: DEFAULT_WEEKLY_GOAL_KM,
      plan: null,

      setRuns: (runs) => set({ runs }),
      resetStore: () => set({ runs: [], activeRun: null, plan: null }),

      addRun: (run) => {
        set((state) => ({
          runs: [...state.runs, run].sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
        }));
        const uid = useAuthStore.getState().user?.id;
        if (uid) runService.insertRun(uid, run).catch(console.error);
      },

      removeRun: (id) => {
        set((state) => ({ runs: state.runs.filter((r) => r.id !== id) }));
        runService.deleteRun(id).catch(console.error);
      },

      setWeeklyGoalKm: (km) => set({ weeklyGoalKm: Math.max(1, Math.round(km)) }),

      startRun: (mode, planSessionId) =>
        set({
          activeRun: {
            mode,
            planSessionId,
            startedAt: Date.now(),
            pausedAt: null,
            pausedMs: 0,
            distanceMeters: 0,
            lastPoint: null,
            splitSeconds: [],
            route: [[]],
          },
        }),

      pauseRun: () => {
        const run = get().activeRun;
        if (!run || run.pausedAt !== null) return;
        set({ activeRun: { ...run, pausedAt: Date.now() } });
      },

      // Ao retomar, o próximo ponto de GPS vira a nova âncora — não liga uma
      // linha reta entre onde pausou e onde retomou.
      resumeRun: () => {
        const run = get().activeRun;
        if (!run || run.pausedAt === null) return;
        set({
          activeRun: {
            ...run,
            pausedAt: null,
            pausedMs: run.pausedMs + (Date.now() - run.pausedAt),
            lastPoint: null,
            route: [...(run.route ?? []), []],
          },
        });
      },

      addGpsPoint: (point) => {
        const run = get().activeRun;
        if (!run || run.mode !== 'gps') return;
        const next = applyGpsPoint(run, point);
        if (next) set({ activeRun: { ...run, ...next } });
      },

      clearActiveRun: () => set({ activeRun: null }),

      setPlan: (plan) => set({ plan }),

      completePlanSession: (sessionId, runId) => {
        const plan = get().plan;
        if (!plan) return;
        set({
          plan: { ...plan, completed: { ...plan.completed, [sessionId]: { runId, at: new Date().toISOString() } } },
        });
      },

      uncompletePlanSession: (sessionId) => {
        const plan = get().plan;
        if (!plan) return;
        const completed = { ...plan.completed };
        delete completed[sessionId];
        set({ plan: { ...plan, completed } });
      },
    }),
    {
      name: 'run-store',
      storage: createJSONStorage(() => AsyncStorage),
      // A corrida em andamento precisa sobreviver a um reload do app (ex: PWA
      // recarregado ao voltar do bloqueio). As corridas salvas vêm do Supabase.
      partialize: (state) => ({ activeRun: state.activeRun, weeklyGoalKm: state.weeklyGoalKm, plan: state.plan }),
      // Marca como hidratado mesmo se a leitura falhar — o _layout espera essa
      // flag para montar as telas, então ela nunca pode ficar presa em false.
      onRehydrateStorage: () => () => {
        useRunStore.setState({ hasHydrated: true });
      },
    },
  ),
);
