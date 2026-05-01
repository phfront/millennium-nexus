import type { CaloriasLog, CaloriasSettings } from '@/types/calorias';
import { formatDateISO, getCalendarWeekBoundsISO } from '@/lib/health/nutrition';

const DAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

/** Parse YYYY-MM-DD as local calendar date (avoids UTC shift). */
export function parseLocalDateISO(dateISO: string): Date {
  const [y, m, d] = dateISO.split('-').map((n) => Number(n));
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

/** Mon = 0 … Sun = 6 */
export function dayIndexMon0Sun6(date: Date): number {
  const js = date.getDay();
  return js === 0 ? 6 : js - 1;
}

/**
 * `Date.getDay()` (0=Dom … 6=Sáb) → bit da máscara `active_days` (Seg=0 … Dom=6).
 * Mesmo mapeamento que `dayIndexMon0Sun6` usa para datas.
 */
export function jsDowToCaloriasMaskBit(dow: number): number {
  if (dow < 0 || dow > 6) return 0;
  return dow === 0 ? 6 : dow - 1;
}

export function toggleActiveDaysMaskJsDow(mask: number, jsDow: number): number {
  const b = jsDowToCaloriasMaskBit(jsDow);
  return (mask & 0x7f) ^ (1 << b);
}

export function isActiveDaysMaskJsDow(mask: number, jsDow: number): boolean {
  const b = jsDowToCaloriasMaskBit(jsDow);
  return ((mask >> b) & 1) === 1;
}

export function popcount7(mask: number): number {
  let n = mask & 0x7f;
  let c = 0;
  while (n > 0) {
    c += n & 1;
    n >>= 1;
  }
  return c;
}

export function weeklyTargetKcal(settings: Pick<CaloriasSettings, 'daily_target_kcal' | 'active_days'>): number {
  const days = popcount7(settings.active_days);
  return settings.daily_target_kcal * days;
}

export function isActiveDay(dateISO: string, activeDaysMask: number): boolean {
  const idx = dayIndexMon0Sun6(parseLocalDateISO(dateISO));
  return ((activeDaysMask >> idx) & 1) === 1;
}

export function dailyTotals(
  logs: CaloriasLog[],
  weekBounds: { monday: string; sunday: string },
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const l of logs) {
    if (l.logged_date < weekBounds.monday || l.logged_date > weekBounds.sunday) continue;
    totals[l.logged_date] = (totals[l.logged_date] ?? 0) + l.amount_kcal;
  }
  return totals;
}

export function weeklyTotal(logs: CaloriasLog[], weekBounds: { monday: string; sunday: string }): number {
  return logs
    .filter((l) => l.logged_date >= weekBounds.monday && l.logged_date <= weekBounds.sunday)
    .reduce((sum, l) => sum + l.amount_kcal, 0);
}

export function weekTotalBeforeDate(
  logs: CaloriasLog[],
  weekBounds: { monday: string; sunday: string },
  dateISO: string,
): number {
  return logs
    .filter(
      (l) =>
        l.logged_date >= weekBounds.monday &&
        l.logged_date < dateISO &&
        l.logged_date <= weekBounds.sunday,
    )
    .reduce((sum, l) => sum + l.amount_kcal, 0);
}

export function effectiveTargetForDay(
  dateISO: string,
  settings: Pick<CaloriasSettings, 'daily_target_kcal' | 'active_days'>,
  logs: CaloriasLog[],
  weekBounds: { monday: string; sunday: string },
): number {
  if (dateISO < weekBounds.monday || dateISO > weekBounds.sunday) return 0;
  const weekly = weeklyTargetKcal(settings);
  if (isActiveDay(dateISO, settings.active_days)) {
    return settings.daily_target_kcal;
  }
  const before = weekTotalBeforeDate(logs, weekBounds, dateISO);
  return Math.max(0, weekly - before);
}

export function weeklyRemainingKcal(weekTotalSoFar: number, settings: Pick<CaloriasSettings, 'daily_target_kcal' | 'active_days'>): number {
  const target = weeklyTargetKcal(settings);
  return Math.max(0, target - weekTotalSoFar);
}

export function formatActiveDaysLabel(mask: number): string {
  const m = mask & 0x7f;
  if (m === 0x7f) return 'Todos os dias';
  if (m === 0) return 'Sem dias ativos';

  const indices: number[] = [];
  for (let i = 0; i < 7; i += 1) {
    if ((m >> i) & 1) indices.push(i);
  }

  const ranges: string[] = [];
  let start = indices[0];
  let prev = indices[0];
  for (let k = 1; k < indices.length; k += 1) {
    const cur = indices[k];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    ranges.push(start === prev ? DAY_SHORT[start] : `${DAY_SHORT[start]}–${DAY_SHORT[prev]}`);
    start = cur;
    prev = cur;
  }
  ranges.push(start === prev ? DAY_SHORT[start] : `${DAY_SHORT[start]}–${DAY_SHORT[prev]}`);
  return ranges.join(', ');
}

export function enumerateWeekDatesISO(monday: string, sunday: string): string[] {
  const out: string[] = [];
  let cur = parseLocalDateISO(monday);
  const end = parseLocalDateISO(sunday);
  while (cur <= end) {
    out.push(formatDateISO(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
  }
  return out;
}

export function calcCaloriasProgress(todayTotal: number, effectiveTarget: number): number {
  if (effectiveTarget <= 0) return todayTotal > 0 ? 100 : 0;
  return Math.min(100, Math.round((todayTotal / effectiveTarget) * 100));
}

export function weekBoundsForReference(reference: Date = new Date()) {
  return getCalendarWeekBoundsISO(reference);
}

/** Soma ou subtrai dias civis a partir de `YYYY-MM-DD` (fuso local). */
export function addDaysISO(dateISO: string, deltaDays: number): string {
  const d = parseLocalDateISO(dateISO);
  d.setDate(d.getDate() + deltaDays);
  return formatDateISO(d);
}

/**
 * Intervalo de leitura na BD: desde a segunda da semana que contém `visibleStart`
 * até `visibleEnd`, para `effectiveTargetForDay` nos dias de rollover ter a semana completa.
 */
export function caloriasHistoryFetchBounds(
  visibleStart: string,
  visibleEnd: string,
): { fetchStart: string; fetchEnd: string } {
  const { monday } = getCalendarWeekBoundsISO(parseLocalDateISO(visibleStart));
  return { fetchStart: monday, fetchEnd: visibleEnd };
}

export type CaloriasHistoryDayRow = {
  dateISO: string;
  logs: CaloriasLog[];
  dayTotal: number;
  effectiveTarget: number;
};

/** Agrupa por dia (só dias com registos) dentro da janela visível; ordenação do mais recente. */
export function buildCaloriasHistoryDayRows(
  fetchedLogs: CaloriasLog[],
  settings: Pick<CaloriasSettings, 'daily_target_kcal' | 'active_days'>,
  visibleStart: string,
  visibleEnd: string,
): CaloriasHistoryDayRow[] {
  const inWindow = fetchedLogs.filter((l) => l.logged_date >= visibleStart && l.logged_date <= visibleEnd);
  const dates = [...new Set(inWindow.map((l) => l.logged_date))].sort((a, b) => b.localeCompare(a));
  const rows: CaloriasHistoryDayRow[] = [];
  for (const dateISO of dates) {
    const logs = fetchedLogs
      .filter((l) => l.logged_date === dateISO)
      .sort((a, b) => b.logged_at.localeCompare(a.logged_at));
    const dayTotal = logs.reduce((s, l) => s + l.amount_kcal, 0);
    const weekBounds = getCalendarWeekBoundsISO(parseLocalDateISO(dateISO));
    const weekLogs = fetchedLogs.filter(
      (l) => l.logged_date >= weekBounds.monday && l.logged_date <= weekBounds.sunday,
    );
    const effectiveTarget = effectiveTargetForDay(dateISO, settings, weekLogs, weekBounds);
    rows.push({ dateISO, logs, dayTotal, effectiveTarget });
  }
  return rows;
}

export type CaloriasHistoryWeekRow = {
  monday: string;
  sunday: string;
  weekTotal: number;
  weeklyTarget: number;
};

/** Semanas ISO (seg–dom) que intersectam a janela e têm pelo menos 1 registo. */
export function buildCaloriasHistoryWeekRows(
  fetchedLogs: CaloriasLog[],
  settings: Pick<CaloriasSettings, 'daily_target_kcal' | 'active_days'>,
  visibleStart: string,
  visibleEnd: string,
): CaloriasHistoryWeekRow[] {
  const weeklyTarget = weeklyTargetKcal(settings);
  const seenMondays = new Set<string>();
  const rows: CaloriasHistoryWeekRow[] = [];
  let cursor = parseLocalDateISO(visibleEnd);
  for (let i = 0; i < 60; i += 1) {
    const { monday, sunday } = getCalendarWeekBoundsISO(cursor);
    if (seenMondays.has(monday)) break;
    seenMondays.add(monday);
    const overlaps = !(sunday < visibleStart || monday > visibleEnd);
    if (overlaps) {
      const weekTotal = weeklyTotal(fetchedLogs, { monday, sunday });
      if (weekTotal > 0) {
        rows.push({ monday, sunday, weekTotal, weeklyTarget });
      }
    }
    if (monday <= visibleStart) break;
    const prevSunday = parseLocalDateISO(monday);
    prevSunday.setDate(prevSunday.getDate() - 1);
    cursor = prevSunday;
  }
  return rows.sort((a, b) => b.monday.localeCompare(a.monday));
}

export type CaloriasHistoryMonthRow = {
  monthKey: string;
  monthTotal: number;
  daysWithLogs: number;
  /** Aproximação: meta semanal × (dias do mês civil / 7). */
  approximateMonthlyTarget: number;
};

function daysInCalendarMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

/** Agrupa por mês civil (YYYY-MM) dentro da janela; só meses com registos. */
export function buildCaloriasHistoryMonthRows(
  fetchedLogs: CaloriasLog[],
  settings: Pick<CaloriasSettings, 'daily_target_kcal' | 'active_days'>,
  visibleStart: string,
  visibleEnd: string,
): CaloriasHistoryMonthRow[] {
  const wTarget = weeklyTargetKcal(settings);
  const inWindow = fetchedLogs.filter((l) => l.logged_date >= visibleStart && l.logged_date <= visibleEnd);
  const byMonth = new Map<string, CaloriasLog[]>();
  for (const l of inWindow) {
    const mk = l.logged_date.slice(0, 7);
    const arr = byMonth.get(mk) ?? [];
    arr.push(l);
    byMonth.set(mk, arr);
  }
  const rows: CaloriasHistoryMonthRow[] = [];
  for (const [monthKey, logs] of byMonth) {
    const dim = daysInCalendarMonth(monthKey);
    const approximateMonthlyTarget = Math.round((wTarget * dim) / 7);
    const monthTotal = logs.reduce((s, l) => s + l.amount_kcal, 0);
    const daysWithLogs = new Set(logs.map((l) => l.logged_date)).size;
    rows.push({ monthKey, monthTotal, daysWithLogs, approximateMonthlyTarget });
  }
  return rows.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}
