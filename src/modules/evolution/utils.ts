const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Sessões inteiras: "52m", "1h 05m"
export function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

// Execuções de um exercício: "45s", "3m 20s"
export function formatExerciseTime(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${m}m`;
}

export function formatKg(value: number): string {
  return `${String(Math.round(value * 10) / 10).replace('.', ',')} kg`;
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function formatRelativeDay(iso: string): string {
  const diff = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(new Date(iso)).getTime()) / DAY_MS,
  );
  if (diff <= 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff < 7) return `Há ${diff} dias`;
  return formatShortDate(iso);
}

export type DatedValue = { date: string; value: number };

// Um ponto por dia (o último registro do dia), em ordem cronológica — salvar o
// peso várias vezes no mesmo treino não deve virar vários pontos no gráfico.
export function lastValuePerDay<T extends { loggedAt: string }>(
  logs: T[],
  getValue: (log: T) => number,
): DatedValue[] {
  const byDay = new Map<string, DatedValue>();
  [...logs]
    .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt))
    .forEach((log) => byDay.set(localDayKey(log.loggedAt), { date: log.loggedAt, value: getValue(log) }));
  return [...byDay.values()];
}

// Dias seguidos com treino concluído, contando de hoje para trás.
export function computeStreak(completedAtList: string[]): number {
  const doneDays = new Set(completedAtList.map((iso) => new Date(iso).toDateString()));
  let count = 0;
  const cursor = startOfDay(new Date());
  while (doneDays.has(cursor.toDateString())) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const diffToMon = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diffToMon);
  return d;
}
