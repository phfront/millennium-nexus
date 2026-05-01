'use client';

import { useMemo, useState } from 'react';
import { LineChartPanel, Skeleton } from '@phfront/millennium-ui';
import { TrendingUp } from 'lucide-react';
import type { CaloriasLog, CaloriasSettings } from '@/types/calorias';
import {
  buildCaloriasEvolutionRows,
  CALORIAS_CHART_PERIODS,
  type CaloriasChartPeriod,
} from '@/lib/health/calorias-chart-data';

export type CaloriasEvolutionChartProps = {
  settings: CaloriasSettings;
  logs: CaloriasLog[];
  today: string;
  isLoading: boolean;
};

export function CaloriasEvolutionChart({ settings, logs, today, isLoading }: CaloriasEvolutionChartProps) {
  const [period, setPeriod] = useState<CaloriasChartPeriod>('30d');

  const rows = useMemo(
    () => buildCaloriasEvolutionRows(logs, settings, today, period),
    [logs, settings, today, period],
  );

  if (isLoading) {
    return <Skeleton variant="block" className="h-[300px] w-full rounded-2xl" />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface-2/25 p-4 shadow-sm backdrop-blur-md">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
        <h2 className="text-sm font-semibold text-text-primary">Evolução da queima</h2>
      </div>
      <LineChartPanel
        data={rows}
        xDataKey="dateLabel"
        series={[
          {
            dataKey: 'Queima',
            name: 'Queima (kcal)',
            color: 'var(--color-brand-primary)',
            strokeWidth: 2,
            type: 'monotone',
            dot: { r: 2, fill: 'var(--color-brand-primary)' },
            connectNulls: false,
          },
          {
            dataKey: 'Meta',
            name: 'Meta do dia',
            color: 'var(--color-brand-secondary, #ca8a04)',
            strokeWidth: 2,
            type: 'linear',
            dot: false,
            connectNulls: true,
            strokeDasharray: '5 5',
          },
        ]}
        periods={CALORIAS_CHART_PERIODS}
        selectedPeriodId={period}
        onPeriodChange={(id) => setPeriod(id as CaloriasChartPeriod)}
        emptyContent={
          <div className="flex h-48 items-center justify-center text-sm text-text-muted">
            Sem dados no período.
          </div>
        }
        height={220}
        chartMargin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        showLegend
        className="[&_.recharts-legend-item-text]:text-text-secondary"
      />
    </div>
  );
}
