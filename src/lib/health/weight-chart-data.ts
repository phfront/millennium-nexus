import { subDays, subMonths, parseISO, isAfter, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { movingAverage7d } from '@/lib/health/projection';
import type { WeightLog } from '@/types/health';

export type WeightChartPeriod = '30d' | '90d' | '6m' | 'all';

export const WEIGHT_CHART_PERIODS: { id: WeightChartPeriod; label: string }[] = [
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: '6m', label: '6m' },
  { id: 'all', label: 'Tudo' },
];

function getCutoff(period: WeightChartPeriod): Date | null {
  const now = new Date();
  if (period === '30d') return subDays(now, 30);
  if (period === '90d') return subDays(now, 90);
  if (period === '6m') return subMonths(now, 6);
  return null;
}

/** Linhas prontas para `LineChartPanel` (chaves de série alinhadas à legenda em PT). */
export function buildWeightLineChartRows(
  logs: WeightLog[],
  targetWeight: number,
  targetDate: string,
  period: WeightChartPeriod,
): Record<string, string | number | null>[] {
  const sorted = [...logs].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  const cutoff = getCutoff(period);
  const filtered = cutoff ? sorted.filter((l) => isAfter(parseISO(l.logged_at), cutoff)) : sorted;

  if (filtered.length === 0) return [];

  const movAvg = movingAverage7d(filtered);
  const movAvgMap = new Map(movAvg.map((m) => [m.date, m.avg]));

  const currentWeight = filtered[filtered.length - 1].weight;

  const guidePoints = [
    { date: filtered[filtered.length - 1]?.logged_at ?? new Date().toISOString().slice(0, 10), guide: currentWeight },
    { date: targetDate, guide: targetWeight },
  ];

  const guideMap = new Map(guidePoints.map((g) => [g.date, g.guide]));

  const allDates = Array.from(
    new Set([...filtered.map((l) => l.logged_at), ...guidePoints.map((g) => g.date)]),
  ).sort();

  return allDates.map((date) => {
    const log = filtered.find((l) => l.logged_at === date);
    return {
      dateLabel: format(parseISO(date + 'T12:00:00'), 'd MMM', { locale: ptBR }),
      Peso: log?.weight ?? null,
      'Média 7d': movAvgMap.get(date) ?? null,
      Meta: guideMap.get(date) ?? null,
    };
  });
}
