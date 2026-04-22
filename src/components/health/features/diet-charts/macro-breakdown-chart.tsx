'use client';

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import type { DailyTotals } from '@/types/nutrition';

const COLORS = {
  protein: '#60a5fa',
  carbs: '#fbbf24',
  fat: '#f87171',
};

interface MacroBreakdownChartProps {
  totals: DailyTotals;
  /** Título do cartão (ex.: dia selecionado no histórico). */
  title?: string;
}

export function MacroBreakdownChart({ totals, title = 'Macros do dia' }: MacroBreakdownChartProps) {
  const data = [
    { name: 'Proteína', value: Math.round(totals.protein), color: COLORS.protein },
    { name: 'Carboidratos', value: Math.round(totals.carbs), color: COLORS.carbs },
    { name: 'Gordura', value: Math.round(totals.fat), color: COLORS.fat },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-xs text-text-muted">
        Sem dados de macros.
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="p-4 bg-surface-2 rounded-xl border border-border">
      <h3 className="text-sm font-semibold text-text-primary mb-3">{title}</h3>
      <div className="flex items-center gap-4">
        <div className="w-32 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={35}
                outerRadius={55}
                strokeWidth={0}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-surface-3, #1a1a1a)',
                  border: '1px solid var(--color-border, #333)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) => [`${value}g`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-2">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-xs text-text-secondary">{d.name}</span>
              <span className="text-xs font-medium text-text-primary tabular-nums">
                {d.value}g
              </span>
              <span className="text-[10px] text-text-muted tabular-nums">
                ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
