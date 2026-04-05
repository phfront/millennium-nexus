'use client';

import { useMemo, useState } from 'react';
import { LineChartPanel } from '@phfront/millennium-ui';
import type { WeightLog } from '@/types/health';
import {
  buildWeightLineChartRows,
  WEIGHT_CHART_PERIODS,
  type WeightChartPeriod,
} from '@/lib/health/weight-chart-data';

interface WeightChartProps {
  logs: WeightLog[];
  targetWeight: number;
  targetDate: string;
}

export function WeightChart({ logs, targetWeight, targetDate }: WeightChartProps) {
  const [period, setPeriod] = useState<WeightChartPeriod>('90d');

  const rows = useMemo(
    () => buildWeightLineChartRows(logs, targetWeight, targetDate, period),
    [logs, targetWeight, targetDate, period],
  );

  return (
    <LineChartPanel
      data={rows}
      xDataKey="dateLabel"
      series={[
        {
          dataKey: 'Peso',
          name: 'Peso',
          color: 'var(--color-brand-primary)',
          strokeWidth: 2,
          type: 'monotone',
          dot: { r: 3, fill: 'var(--color-brand-primary)' },
          connectNulls: false,
        },
        {
          dataKey: 'Média 7d',
          name: 'Média 7d',
          color: 'var(--color-brand-secondary, #a855f7)',
          strokeWidth: 2,
          type: 'monotone',
          dot: false,
          connectNulls: true,
        },
        {
          dataKey: 'Meta',
          name: 'Meta',
          color: 'var(--color-text-muted)',
          strokeWidth: 1.5,
          type: 'linear',
          dot: false,
          connectNulls: true,
          strokeDasharray: '5 5',
        },
      ]}
      referenceLines={[
        {
          y: targetWeight,
          stroke: 'var(--color-success)',
          strokeDasharray: '4 4',
          strokeWidth: 1,
        },
      ]}
      periods={WEIGHT_CHART_PERIODS}
      selectedPeriodId={period}
      onPeriodChange={(id) => setPeriod(id as WeightChartPeriod)}
      emptyContent={
        <div className="flex items-center justify-center h-48 text-sm text-text-muted">
          Sem registros no período selecionado.
        </div>
      }
      height={240}
    />
  );
}
