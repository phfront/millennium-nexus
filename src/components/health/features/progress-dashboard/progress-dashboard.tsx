'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import { DeltaBadge, RangeProgressBar, Skeleton, StatCard } from '@phfront/millennium-ui';
import { ProjectionPanel } from '@/components/health/features/projection-panel/projection-panel';
import { useHealthSummary } from '@/hooks/health/use-health-summary';
import { useWeightLogs } from '@/hooks/health/use-weight-logs';
import { weeklyRate, calcBmi, bmiLabel } from '@/lib/health/projection';
import { formatDatePtBR } from '@/lib/health/projection';

const WeightChart = dynamic(
  () => import('@/components/health/ui/weight-chart/weight-chart').then((m) => ({ default: m.WeightChart })),
  { ssr: false, loading: () => <Skeleton variant="block" className="h-60 w-full" /> },
);

export function ProgressDashboard() {
  const { summary, isLoading: summaryLoading } = useHealthSummary();
  const { logs, isLoading: logsLoading, latestLog, previousLog } = useWeightLogs();

  const isLoading = summaryLoading || logsLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton variant="block" className="h-20 w-full" />
        <Skeleton variant="block" className="h-14 w-full" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} variant="block" className="h-24" />)}
        </div>
        <Skeleton variant="block" className="h-60 w-full" />
      </div>
    );
  }

  if (!summary) return null;

  const diffVsLast =
    latestLog && previousLog ? latestLog.weight - previousLog.weight : null;
  const rate = weeklyRate(logs);
  const bmi =
    summary.current_bmi !== null
      ? `${summary.current_bmi} — ${bmiLabel(summary.current_bmi)}`
      : null;

  return (
    <div className="flex flex-col gap-5 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-text-muted uppercase tracking-wide font-medium">Peso atual</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums text-text-primary">
              {summary.current_weight.toFixed(1)}
            </span>
            <span className="text-lg text-text-muted">kg</span>
          </div>
          <div className="flex items-center gap-2">
            <DeltaBadge delta={diffVsLast} unit="kg" suffix="vs. anterior" invertSemantics />
            <span className="text-xs text-text-muted">{formatDatePtBR(summary.last_logged_at)}</span>
          </div>
        </div>
        <Link
          href="/health/setup"
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
          aria-label="Editar configurações"
        >
          <Settings size={20} />
        </Link>
      </div>

      {/* Barra de Progresso */}
      <RangeProgressBar
        percent={Math.max(0, summary.progress_percent)}
        startLabel={`${summary.start_weight.toFixed(1)} kg`}
        endLabel={`${summary.target_weight.toFixed(1)} kg`}
        currentLabel={`${summary.current_weight.toFixed(1)} kg`}
        formatFooter={(p) => `${p.toFixed(1)}% concluído`}
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Total perdido"
          value={`${summary.total_lost >= 0 ? summary.total_lost.toFixed(1) : '0.0'} kg`}
          valueTone={summary.total_lost > 0 ? 'positive' : 'muted'}
        />
        <StatCard
          label="Faltante"
          value={`${Math.max(0, summary.remaining).toFixed(1)} kg`}
          sub={`Meta: ${summary.target_weight.toFixed(1)} kg`}
        />
        <StatCard
          label="Média semanal"
          value={rate !== null ? `${rate.toFixed(2)} kg` : '—'}
          sub="últimas 4 semanas"
          valueTone={
            rate !== null && rate > 0 ? 'positive' : rate !== null && rate < 0 ? 'negative' : 'muted'
          }
        />
        {bmi ? (
          <StatCard label="IMC" value={String(summary.current_bmi)} sub={bmiLabel(summary.current_bmi!)} />
        ) : (
          <StatCard label="Meta" value={formatDatePtBR(summary.target_date)} sub="data alvo" valueTone="muted" />
        )}
      </div>

      {/* Projeção */}
      <ProjectionPanel
        logs={logs}
        settings={{
          user_id: summary.user_id,
          start_weight: summary.start_weight,
          start_date: summary.start_date,
          target_weight: summary.target_weight,
          target_date: summary.target_date,
          height: summary.height,
          created_at: '',
          updated_at: '',
        }}
        currentWeight={summary.current_weight}
      />

      {/* Gráfico */}
      {logs.length > 0 && (
        <div className="flex flex-col gap-2 p-4 bg-surface-2 rounded-xl border border-border">
          <h2 className="text-sm font-semibold text-text-primary">Evolução do peso</h2>
          <WeightChart
            logs={logs}
            targetWeight={summary.target_weight}
            targetDate={summary.target_date}
          />
        </div>
      )}
    </div>
  );
}
