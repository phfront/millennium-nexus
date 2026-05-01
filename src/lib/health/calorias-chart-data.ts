import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CaloriasLog, CaloriasSettings } from '@/types/calorias';
import {
  addDaysISO,
  effectiveTargetForDay,
  parseLocalDateISO,
} from '@/lib/health/calorias';
import { formatDateISO, getCalendarWeekBoundsISO } from '@/lib/health/nutrition';

export type CaloriasChartPeriod = '7d' | '30d' | '90d';

export const CALORIAS_CHART_PERIODS: { id: CaloriasChartPeriod; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
];

function periodDayCount(period: CaloriasChartPeriod): number {
  switch (period) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    default:
      return 30;
  }
}

/** Linhas para `LineChartPanel`: queima diária vs meta efectiva (inclui rollover). */
export function buildCaloriasEvolutionRows(
  logs: CaloriasLog[],
  settings: Pick<CaloriasSettings, 'daily_target_kcal' | 'active_days'>,
  today: string,
  period: CaloriasChartPeriod,
): Record<string, string | number | null>[] {
  const n = periodDayCount(period);
  const visibleEnd = today;
  const visibleStart = addDaysISO(today, -(n - 1));

  const byDay = new Map<string, number>();
  for (const l of logs) {
    if (l.logged_date < visibleStart || l.logged_date > visibleEnd) continue;
    byDay.set(l.logged_date, (byDay.get(l.logged_date) ?? 0) + l.amount_kcal);
  }

  const rows: Record<string, string | number | null>[] = [];
  let cur = parseLocalDateISO(visibleStart);
  const endD = parseLocalDateISO(visibleEnd);
  while (cur <= endD) {
    const dateISO = formatDateISO(cur);
    const wb = getCalendarWeekBoundsISO(cur);
    const dayTotal = byDay.get(dateISO) ?? 0;
    const meta = effectiveTargetForDay(dateISO, settings, logs, wb);
    rows.push({
      dateLabel: format(cur, 'd MMM', { locale: ptBR }),
      Queima: dayTotal,
      Meta: meta,
    });
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
  }
  return rows;
}
