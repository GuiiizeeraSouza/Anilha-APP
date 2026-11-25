
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function formatKg(value: number): string {
  return `${String(Math.round(value * 10) / 10).replace('.', ',')} kg`;
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
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

export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const diffToMon = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diffToMon);
  return d;
}
