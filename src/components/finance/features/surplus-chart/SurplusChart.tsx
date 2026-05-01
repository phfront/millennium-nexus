'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMonth, formatMonthChartAxisShort, formatBRL } from '@/lib/finance/format';
import {
  FINANCE_OVERVIEW_CHART_RANGE_LABELS,
  filterSummariesForChartRange,
  normalizeSummaryMonthKey,
  runningSurplusTotalByMonth,
  toMonthDate,
  type FinanceOverviewChartRange,
} from '@/lib/finance/finance';
import type { MonthlySummary } from '@/types/finance';

const RANGE_OPTIONS: FinanceOverviewChartRange[] = ['6m', '12m', '24m', 'ytd', 'all'];

const SERIES = {
  receitas: { label: 'Receitas', color: '#22c55e' },
  despesas: { label: 'Despesas', color: '#f87171' },
  sobra: { label: 'Sobra', color: 'var(--color-brand-primary, #84cc16)' },
  acumulado: { label: 'Acumulado', color: '#a78bfa' },
} as const;

interface SurplusChartProps {
  summaries: MonthlySummary[];
}

type ChartDatum = {
  monthKey: string;
  month: string;
  receitas: number;
  despesas: number;
  sobra: number;
  acumulado: number;
};

function useChartMobileLayout(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return narrow;
}

function ChartRangePicker({
  range,
  setRange,
}: {
  range: FinanceOverviewChartRange;
  setRange: (r: FinanceOverviewChartRange) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 shrink-0">
      {RANGE_OPTIONS.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => setRange(r)}
          className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors cursor-pointer
            ${
              range === r
                ? 'bg-brand-primary/20 border-brand-primary text-brand-primary'
                : 'bg-surface-3 border-border text-text-muted hover:text-text-secondary hover:bg-surface-4'
            }`}
        >
          {FINANCE_OVERVIEW_CHART_RANGE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}

function OverviewTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; dataKey: string; color?: string; payload: ChartDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const title = formatMonth(row.monthKey);
  return (
    <div className="bg-surface-2 border border-border rounded-lg p-3 shadow-lg text-xs space-y-1 max-w-[220px]">
      <p className="font-semibold text-text-primary border-b border-border pb-1 mb-1">{title}</p>
      {payload.map((p) => {
        const key = p.dataKey as keyof typeof SERIES;
        const name = SERIES[key]?.label ?? p.name;
        const isSobra = key === 'sobra';
        const colorClass =
          isSobra && p.value < 0
            ? 'text-red-400'
            : isSobra && p.value > 0
              ? 'text-green-400'
              : 'text-text-secondary';
        return (
          <p key={String(p.dataKey)} className={colorClass} style={p.color ? { color: p.color } : undefined}>
            <span className="text-text-muted">{name}:</span> {formatBRL(p.value)}
          </p>
        );
      })}
    </div>
  );
}

export function SurplusChart({ summaries }: SurplusChartProps) {
  const [range, setRange] = useState<FinanceOverviewChartRange>('12m');
  const narrow = useChartMobileLayout();

  const filtered = useMemo(
    () => filterSummariesForChartRange(summaries, range),
    [summaries, range],
  );

  const data = useMemo((): ChartDatum[] => {
    const anchorKey = toMonthDate(new Date());
    const runningFromCurrentMonth = runningSurplusTotalByMonth(summaries, anchorKey);
    return filtered.map((s) => {
      const monthKey = normalizeSummaryMonthKey(s.month);
      const acumulado =
        monthKey >= anchorKey
          ? (runningFromCurrentMonth.get(monthKey) ?? Number(s.surplus))
          : Number(s.accumulated_surplus);
      return {
        monthKey,
        month: formatMonth(s.month),
        receitas: Number(s.total_income),
        despesas: Number(s.total_expenses) + Number(s.total_one_time),
        sobra: Number(s.surplus),
        acumulado,
      };
    });
  }, [filtered, summaries]);

  if (summaries.length > 0 && data.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-text-muted">Escolhe outro intervalo — não há meses neste período.</p>
          <ChartRangePicker range={range} setRange={setRange} />
        </div>
        <div className="h-[200px] flex items-center justify-center text-sm text-text-muted border border-dashed border-border rounded-lg">
          Sem dados neste intervalo.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-text-muted">
          Barras: receitas, despesas (fixas + pontuais) e sobra do mês. Linha: saldo acumulado (eixo à direita)
          — a partir do mês civil corrente, a linha ignora meses anteriores; antes disso usa o total histórico.
          Em «6 / 12 / 24 m à frente» mostra-se o mês corrente e os meses seguintes (não o passado).
        </p>
        <ChartRangePicker range={range} setRange={setRange} />
      </div>

      <ResponsiveContainer width="100%" height={narrow ? 340 : 300}>
        <ComposedChart
          data={data}
          margin={{
            top: 8,
            right: narrow ? 4 : 8,
            left: narrow ? 0 : 0,
            bottom: narrow ? 6 : 4,
          }}
          barCategoryGap={narrow ? '18%' : '12%'}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="monthKey"
            tickFormatter={(v) => (narrow ? formatMonthChartAxisShort(String(v)) : formatMonth(String(v)))}
            tick={{
              fontSize: narrow ? 8 : 10,
              fill: 'var(--color-text-muted)',
            }}
            axisLine={false}
            tickLine={false}
            angle={narrow ? -38 : 0}
            textAnchor={narrow ? 'end' : 'middle'}
            height={narrow ? 56 : 28}
            interval={
              narrow
                ? data.length > 7
                  ? 1
                  : 0
                : data.length > 14
                  ? 'preserveStartEnd'
                  : 0
            }
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: narrow ? 9 : 10, fill: 'var(--color-text-muted)' }}
            axisLine={false}
            tickLine={false}
            width={narrow ? 36 : 44}
            tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: narrow ? 9 : 10, fill: 'var(--color-text-muted)' }}
            axisLine={false}
            tickLine={false}
            width={narrow ? 36 : 44}
            tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
          <Tooltip content={<OverviewTooltip />} />
          <Legend
            wrapperStyle={{
              fontSize: narrow ? 10 : 11,
              paddingTop: narrow ? 4 : 8,
              color: 'var(--color-text-muted)',
            }}
          />
          <ReferenceLine yAxisId="left" y={0} stroke="var(--color-border)" />
          <Bar
            yAxisId="left"
            dataKey="receitas"
            name={SERIES.receitas.label}
            fill={SERIES.receitas.color}
            radius={[2, 2, 0, 0]}
            maxBarSize={18}
          />
          <Bar
            yAxisId="left"
            dataKey="despesas"
            name={SERIES.despesas.label}
            fill={SERIES.despesas.color}
            radius={[2, 2, 0, 0]}
            maxBarSize={18}
          />
          <Bar
            yAxisId="left"
            dataKey="sobra"
            name={SERIES.sobra.label}
            fill="var(--color-brand-primary, #84cc16)"
            radius={[2, 2, 0, 0]}
            maxBarSize={18}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="acumulado"
            name={SERIES.acumulado.label}
            stroke={SERIES.acumulado.color}
            strokeWidth={2}
            dot={{ r: 2, fill: SERIES.acumulado.color }}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
