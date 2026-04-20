'use client';

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Skeleton } from '@phfront/millennium-ui';
import { useDietChartData } from '@/hooks/health/use-diet-chart-data';

interface AdherenceChartProps {
  days?: number;
}

export function AdherenceChart({ days = 14 }: AdherenceChartProps) {
  const { chartData, isLoading } = useDietChartData(days);

  if (isLoading) {
    return <Skeleton variant="block" className="h-64 w-full" />;
  }

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-text-muted">
        Sem dados de dieta para exibir.
      </div>
    );
  }

  const formatted = chartData.map((d) => ({
    ...d,
    date: `${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`,
  }));

  return (
    <div className="p-4 bg-surface-2 rounded-xl border border-border">
      <h3 className="text-sm font-semibold text-text-primary mb-4">Aderência à dieta</h3>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={formatted} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #333)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--color-text-muted, #888)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="kcal"
            orientation="left"
            tick={{ fontSize: 10, fill: 'var(--color-text-muted, #888)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="pct"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: 'var(--color-text-muted, #888)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface-3, #1a1a1a)',
              border: '1px solid var(--color-border, #333)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: 'var(--color-text-primary, #fff)' }}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px' }}
          />
          <Bar
            yAxisId="kcal"
            dataKey="consumed_kcal"
            name="Consumido"
            fill="#4ade80"
            radius={[4, 4, 0, 0]}
            opacity={0.7}
          />
          <Bar
            yAxisId="kcal"
            dataKey="extra_kcal"
            name="Extra"
            fill="#f87171"
            radius={[4, 4, 0, 0]}
            opacity={0.7}
          />
          <Line
            yAxisId="pct"
            dataKey="adherence_percent"
            name="Aderência %"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={{ r: 3, fill: '#60a5fa' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
