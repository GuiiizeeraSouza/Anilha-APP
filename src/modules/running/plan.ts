import type { Run } from './types';
import { formatClock, formatKm, formatPace, paceOf, riegelSeconds } from './utils';

// ─── Planilha de corrida gerada a partir da corrida de teste ────────────────
//
// Regras fixas (nada de IA): o mesmo teste sempre gera a mesma planilha.
// 8 semanas; a semana 4 é de recuperação e a 8 termina com um teste final.

export const PLAN_WEEKS = 8;

export type PlanGoal = 'start' | '5k' | '10k';
export type PlanLevel = 'iniciante' | 'intermediario' | 'avancado';
export type SessionKind = 'runwalk' | 'easy' | 'tempo' | 'intervals' | 'long' | 'test';
export type BlockKind = 'warmup' | 'run' | 'walk' | 'fast' | 'recover' | 'steady' | 'cooldown';

export interface PlanBlock {
  kind: BlockKind;
  seconds: number;
  paceMin?: number; // s/km — faixa alvo do bloco (mais rápido)
  paceMax?: number; // s/km — (mais lento)
}

export interface PlanSession {
  id: string;
  week: number;
  order: number; // posição na semana (1 = primeiro treino)
  kind: SessionKind;
  title: string;
  summary: string; // linha curta: "4 km · 6:30–7:00 /km"
  description: string; // o que fazer, em português simples
  targetMeters: number | null;
  targetSeconds: number | null;
  paceMin: number | null;
  paceMax: number | null;
  blocks: PlanBlock[] | null; // guia passo a passo durante a corrida
}

export interface TrainingPlan {
  createdAt: string;
  startDate: string; // segunda-feira da semana em que foi criada
  goal: PlanGoal;
  level: PlanLevel;
  daysPerWeek: number;
  weeks: number;
  base: { runId: string; meters: number; seconds: number; paceSec: number };
  sessions: PlanSession[];
  completed: Record<string, { runId: string | null; at: string }>;
}

export const GOAL_LABELS: Record<PlanGoal, string> = {
  start: 'Correr 30 min sem parar',
  '5k': 'Correr 5 km',
  '10k': 'Correr 10 km',
};

export const LEVEL_LABELS: Record<PlanLevel, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

export const BLOCK_LABELS: Record<BlockKind, string> = {
  warmup: 'Aquecimento',
  run: 'Corra',
  walk: 'Caminhe',
  fast: 'Forte',
  recover: 'Recupere',
  steady: 'No ritmo',
  cooldown: 'Desaquecimento',
};

export const BLOCK_HINTS: Record<BlockKind, string> = {
  warmup: 'caminhe rápido ou trote bem leve',
  run: 'ritmo confortável, dá para conversar',
  walk: 'caminhe e recupere o fôlego',
  fast: 'acelere — forte, mas sem se acabar',
  recover: 'trote bem leve ou caminhe',
  steady: 'ritmo firme e constante',
  cooldown: 'caminhe ou trote bem leve',
};

// ── Avaliação da corrida de teste ───────────────────────────────────────────

const MIN_TEST_METERS = 500;
const MIN_TEST_SECONDS = 5 * 60;

export function isValidTestRun(run: Run): boolean {
  return run.distanceMeters >= MIN_TEST_METERS && run.durationSeconds >= MIN_TEST_SECONDS;
}

export function detectLevel(run: Run): PlanLevel {
  const pace = paceOf(run.distanceMeters, run.durationSeconds) ?? Infinity;
  if (run.durationSeconds < 15 * 60 || run.distanceMeters < 2000 || pace > 8 * 60) return 'iniciante';
  if (run.distanceMeters >= 6000 && pace <= 5 * 60 + 45) return 'avancado';
  return 'intermediario';
}

// Objetivos que fazem sentido para cada nível (iniciante não pula direto para 10 km).
export function availableGoals(level: PlanLevel): PlanGoal[] {
  return level === 'iniciante' ? ['start', '5k'] : ['5k', '10k'];
}

export function suggestedGoal(run: Run): PlanGoal {
  const level = detectLevel(run);
  if (level === 'iniciante') return 'start';
  if (level === 'avancado' || run.distanceMeters >= 4000) return '10k';
  return '5k';
}

// ── Zonas de pace ───────────────────────────────────────────────────────────

const round5 = (s: number) => Math.round(s / 5) * 5;
const roundHalfKm = (m: number) => Math.max(500, Math.round(m / 500) * 500);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// Pace de referência: o do teste, corrigido pelo esforço relatado (quem correu
// "leve" aguenta mais; quem foi "forte" estava no limite).
function referencePace(run: Run): number {
  const pace = paceOf(run.distanceMeters, run.durationSeconds) ?? 7 * 60;
  const factor = run.effort === 'leve' ? 0.97 : run.effort === 'forte' ? 1.03 : 1;
  return pace * factor;
}

function zones(ref: number) {
  const z = (a: number, b: number): [number, number] => [round5(ref * a), round5(ref * b)];
  return {
    easy: z(1.1, 1.2),
    long: z(1.15, 1.25),
    tempo: z(0.96, 1.0),
    fast: z(0.87, 0.92),
  };
}

const mid = ([a, b]: [number, number]) => (a + b) / 2;
const paceRange = ([a, b]: [number, number]) => `${formatPace(a)}–${formatPace(b)} /km`;

// ── Iniciante: corrida + caminhada ──────────────────────────────────────────

// Degraus de progressão: [corrida (s), caminhada (s), repetições]
const RUNWALK_STEPS: [number, number, number][] = [
  [60, 90, 8],
  [90, 90, 7],
  [120, 60, 6],
  [180, 60, 5],
  [300, 60, 4],
  [480, 60, 3],
  [720, 60, 2],
  [1200, 0, 1],
  [1500, 0, 1],
  [1800, 0, 1],
];
// Semana → quanto avançou (a semana 4 repete a 3: recuperação).
const WEEK_PROGRESS = [0, 1, 2, 2, 3, 4, 5, 6];
const WARMUP = 5 * 60;
const COOLDOWN = 5 * 60;

// 60 → "1 min", 90 → "1min30s", 45 → "45s"
function durationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m} min` : `${m}min${s}s`;
}

function runwalkSession(week: number, order: number, stepIndex: number, easy: [number, number]): PlanSession {
  const [run, walk, reps] = RUNWALK_STEPS[stepIndex];
  const blocks: PlanBlock[] = [{ kind: 'warmup', seconds: WARMUP }];
  for (let i = 0; i < reps; i++) {
    blocks.push({ kind: 'run', seconds: run, paceMin: easy[0], paceMax: easy[1] });
    if (walk > 0 && i < reps - 1) blocks.push({ kind: 'walk', seconds: walk });
  }
  blocks.push({ kind: 'cooldown', seconds: COOLDOWN });
  const total = blocks.reduce((acc, b) => acc + b.seconds, 0);
  const continuous = walk === 0;
  return {
    id: `${week}-${order}`,
    week,
    order,
    kind: 'runwalk',
    title: continuous ? 'Corrida contínua' : 'Corrida + caminhada',
    summary: continuous
      ? `${durationLabel(run)} correndo sem parar`
      : `${reps}× (${durationLabel(run)} correndo + ${durationLabel(walk)} caminhando)`,
    description: continuous
      ? `5 min de aquecimento caminhando, ${durationLabel(run)} correndo em ritmo confortável (dá para conversar) e 5 min caminhando no final.`
      : `5 min de aquecimento caminhando. Depois alterne ${reps} vezes: corra ${durationLabel(run)} em ritmo confortável e caminhe ${durationLabel(walk)} para recuperar. Termine com 5 min caminhando. O app avisa (e vibra) a cada troca.`,
    targetMeters: null,
    targetSeconds: total,
    paceMin: easy[0],
    paceMax: easy[1],
    blocks,
  };
}

function beginnerPlan(run: Run, goal: PlanGoal, days: number, z: ReturnType<typeof zones>): PlanSession[] {
  const minutes = run.durationSeconds / 60;
  const start = minutes < 6 ? 0 : minutes < 10 ? 1 : minutes < 14 ? 2 : 3;
  // Sobe um degrau por semana (sem semana de recuperação — a progressão já é
  // gradual) até 25 min contínuos; os 30 min ficam para o teste final.
  const target = RUNWALK_STEPS.length - 2;
  const sessions: PlanSession[] = [];
  for (let week = 1; week <= PLAN_WEEKS; week++) {
    const step = Math.min(target, Math.round(start + ((week - 1) * (target - start)) / (PLAN_WEEKS - 1)));
    for (let order = 1; order <= days; order++) {
      const isFinal = week === PLAN_WEEKS && order === days;
      if (isFinal) {
        sessions.push(finalTest(week, order, goal === '5k' ? 5000 : null, z, run));
      } else {
        sessions.push(runwalkSession(week, order, step, z.easy));
      }
    }
  }
  return sessions;
}

// ── Intermediário / avançado ────────────────────────────────────────────────

function easySession(week: number, order: number, meters: number, easy: [number, number]): PlanSession {
  return {
    id: `${week}-${order}`,
    week,
    order,
    kind: 'easy',
    title: 'Rodagem leve',
    summary: `${formatKm(meters, 1)} km · ${paceRange(easy)}`,
    description:
      'Corrida em ritmo confortável, em que dá para conversar. É o treino que constrói sua base — não acelere.',
    targetMeters: meters,
    targetSeconds: null,
    paceMin: easy[0],
    paceMax: easy[1],
    blocks: null,
  };
}

function longSession(week: number, order: number, meters: number, long: [number, number]): PlanSession {
  return {
    id: `${week}-${order}`,
    week,
    order,
    kind: 'long',
    title: 'Longão',
    summary: `${formatKm(meters, 1)} km · ${paceRange(long)}`,
    description:
      'A corrida mais longa da semana, bem devagar. O objetivo é ficar mais tempo correndo, não ir rápido. Pode caminhar 1 min se precisar.',
    targetMeters: meters,
    targetSeconds: null,
    paceMin: long[0],
    paceMax: long[1],
    blocks: null,
  };
}

function intervalsSession(
  week: number,
  order: number,
  repMeters: number,
  reps: number,
  z: ReturnType<typeof zones>,
): PlanSession {
  const fastSeconds = Math.round((repMeters / 1000) * mid(z.fast));
  const recover = repMeters <= 400 ? 90 : 120;
  const blocks: PlanBlock[] = [{ kind: 'warmup', seconds: 10 * 60, paceMin: z.easy[0], paceMax: z.easy[1] }];
  for (let i = 0; i < reps; i++) {
    blocks.push({ kind: 'fast', seconds: fastSeconds, paceMin: z.fast[0], paceMax: z.fast[1] });
    if (i < reps - 1) blocks.push({ kind: 'recover', seconds: recover });
  }
  blocks.push({ kind: 'cooldown', seconds: COOLDOWN });
  return {
    id: `${week}-${order}`,
    week,
    order,
    kind: 'intervals',
    title: 'Intervalado',
    summary: `${reps}× ${repMeters} m forte · ${paceRange(z.fast)}`,
    description: `10 min de trote leve para aquecer. Depois ${reps} tiros de ${repMeters} m (≈${formatClock(fastSeconds)}) em ritmo forte, com ${recover}s de trote leve ou caminhada entre eles. Termine com 5 min leves. O app guia cada tiro.`,
    targetMeters: null,
    targetSeconds: blocks.reduce((acc, b) => acc + b.seconds, 0),
    paceMin: z.fast[0],
    paceMax: z.fast[1],
    blocks,
  };
}

function tempoSession(week: number, order: number, meters: number, z: ReturnType<typeof zones>): PlanSession {
  const steadySeconds = Math.round((meters / 1000) * mid(z.tempo));
  const blocks: PlanBlock[] = [
    { kind: 'warmup', seconds: 10 * 60, paceMin: z.easy[0], paceMax: z.easy[1] },
    { kind: 'steady', seconds: steadySeconds, paceMin: z.tempo[0], paceMax: z.tempo[1] },
    { kind: 'cooldown', seconds: COOLDOWN },
  ];
  return {
    id: `${week}-${order}`,
    week,
    order,
    kind: 'tempo',
    title: 'Ritmo',
    summary: `${formatKm(meters, 1)} km no ritmo · ${paceRange(z.tempo)}`,
    description: `10 min de trote leve, depois ${formatKm(meters, 1)} km (≈${formatClock(steadySeconds)}) em ritmo firme e constante — puxado, mas sustentável. Termine com 5 min leves.`,
    targetMeters: null,
    targetSeconds: blocks.reduce((acc, b) => acc + b.seconds, 0),
    paceMin: z.tempo[0],
    paceMax: z.tempo[1],
    blocks,
  };
}

function finalTest(
  week: number,
  order: number,
  meters: number | null,
  z: ReturnType<typeof zones>,
  run: Run,
): PlanSession {
  if (meters === null) {
    return {
      id: `${week}-${order}`,
      week,
      order,
      kind: 'test',
      title: 'Teste final: 30 min',
      summary: '30 min correndo sem parar',
      description: 'O objetivo da planilha! Aqueça 5 min caminhando e corra 30 minutos sem parar, em ritmo confortável.',
      targetMeters: null,
      targetSeconds: 40 * 60,
      paceMin: z.easy[0],
      paceMax: z.easy[1],
      blocks: [
        { kind: 'warmup', seconds: WARMUP },
        { kind: 'run', seconds: 30 * 60, paceMin: z.easy[0], paceMax: z.easy[1] },
        { kind: 'cooldown', seconds: COOLDOWN },
      ],
    };
  }
  // Pace alvo da prova: previsão de Riegel a partir do teste, ~3% melhor
  // (8 semanas de treino).
  const predicted = riegelSeconds(run.distanceMeters, run.durationSeconds, meters) * 0.97;
  const pace = predicted / (meters / 1000);
  const range: [number, number] = [round5(pace * 0.98), round5(pace * 1.03)];
  return {
    id: `${week}-${order}`,
    week,
    order,
    kind: 'test',
    title: `Teste final: ${formatKm(meters, 0)} km`,
    summary: `${formatKm(meters, 0)} km · meta ≈ ${formatClock(predicted)}`,
    description: `O objetivo da planilha! Aqueça 10 min trotando e corra ${formatKm(meters, 0)} km mirando ${paceRange(range)} (≈${formatClock(predicted)} no total). Comece controlado e acelere no final se estiver sobrando.`,
    targetMeters: meters,
    targetSeconds: null,
    paceMin: range[0],
    paceMax: range[1],
    blocks: null,
  };
}

function trainedPlan(run: Run, goal: PlanGoal, days: number, z: ReturnType<typeof zones>): PlanSession[] {
  const goalMeters = goal === '10k' ? 10000 : 5000;
  const longMax = goal === '10k' ? 12000 : 7000;
  const longStart = clamp(run.distanceMeters * 1.1, 3000, longMax * 0.75);
  const repMeters = goal === '10k' ? 800 : 400;
  const sessions: PlanSession[] = [];

  for (let week = 1; week <= PLAN_WEEKS; week++) {
    const progress = WEEK_PROGRESS[week - 1] / 6; // 0 → 1
    const recovery = week === 4;
    const long = roundHalfKm((longStart + (longMax - longStart) * progress) * (recovery ? 0.8 : 1));
    const easy = roundHalfKm(clamp(long * 0.6, 2000, 8000));
    const quality: 'intervals' | 'tempo' = week % 2 === 1 ? 'intervals' : 'tempo';

    const kinds: SessionKind[] =
      days === 2 ? ['easy', 'long'] : days === 3 ? ['easy', quality, 'long'] : ['easy', quality, 'easy', 'long'];

    kinds.forEach((kind, i) => {
      const order = i + 1;
      const isFinal = week === PLAN_WEEKS && order === kinds.length;
      if (isFinal) return sessions.push(finalTest(week, order, goalMeters, z, run));
      // Semana de recuperação e semana do teste: sem treino de qualidade.
      if ((recovery || week === PLAN_WEEKS) && (kind === 'intervals' || kind === 'tempo')) {
        return sessions.push(easySession(week, order, roundHalfKm(easy * 0.8), z.easy));
      }
      if (kind === 'easy') {
        return sessions.push(easySession(week, order, week === PLAN_WEEKS ? roundHalfKm(easy * 0.7) : easy, z.easy));
      }
      if (kind === 'long') return sessions.push(longSession(week, order, long, z.long));
      if (kind === 'intervals') {
        const reps = Math.round((repMeters === 400 ? 5 : 3) + progress * 3);
        return sessions.push(intervalsSession(week, order, repMeters, reps, z));
      }
      const tempoMeters = roundHalfKm((goal === '10k' ? 3000 : 1500) + progress * (goal === '10k' ? 3000 : 2500));
      return sessions.push(tempoSession(week, order, tempoMeters, z));
    });
  }
  return sessions;
}

// ── Geração ─────────────────────────────────────────────────────────────────

function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + (d.getDay() === 0 ? -6 : 1 - d.getDay()));
  return d;
}

export function generatePlan(run: Run, goal: PlanGoal, daysPerWeek: number, now: Date): TrainingPlan {
  const level = detectLevel(run);
  const z = zones(referencePace(run));
  const sessions =
    level === 'iniciante' || goal === 'start'
      ? beginnerPlan(run, goal, daysPerWeek, z)
      : trainedPlan(run, goal, daysPerWeek, z);
  return {
    createdAt: now.toISOString(),
    startDate: mondayOf(now).toISOString(),
    goal,
    level,
    daysPerWeek,
    weeks: PLAN_WEEKS,
    base: {
      runId: run.id,
      meters: run.distanceMeters,
      seconds: run.durationSeconds,
      paceSec: paceOf(run.distanceMeters, run.durationSeconds) ?? 0,
    },
    sessions,
    completed: {},
  };
}

// ── Consultas ───────────────────────────────────────────────────────────────

export function nextSession(plan: TrainingPlan): PlanSession | null {
  return plan.sessions.find((s) => !plan.completed[s.id]) ?? null;
}

export function currentWeek(plan: TrainingPlan, now: Date): number {
  const weeks = Math.floor((now.getTime() - new Date(plan.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000));
  return clamp(weeks + 1, 1, plan.weeks);
}

export function findSession(plan: TrainingPlan | null, id: string | undefined): PlanSession | null {
  if (!plan || !id) return null;
  return plan.sessions.find((s) => s.id === id) ?? null;
}

// Bloco em andamento numa sessão guiada, a partir do tempo em movimento.
export function blockAt(
  blocks: PlanBlock[],
  elapsedSeconds: number,
): { index: number; block: PlanBlock; remaining: number; next: PlanBlock | null } | null {
  let start = 0;
  for (let i = 0; i < blocks.length; i++) {
    const end = start + blocks[i].seconds;
    if (elapsedSeconds < end) {
      return { index: i, block: blocks[i], remaining: end - elapsedSeconds, next: blocks[i + 1] ?? null };
    }
    start = end;
  }
  return null; // terminou todos os blocos
}

// Ritmo em relação à faixa alvo (com 10 s/km de tolerância).
export function paceStatus(pace: number | null, min?: number | null, max?: number | null): 'fast' | 'ok' | 'slow' | null {
  if (pace === null || min == null || max == null) return null;
  if (pace < min - 10) return 'fast';
  if (pace > max + 10) return 'slow';
  return 'ok';
}
