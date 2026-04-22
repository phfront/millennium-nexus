'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { PageHeader, Skeleton } from '@phfront/millennium-ui';
import { ConsistencyStats } from '@/components/health/features/diet-charts/consistency-stats';
import { DietHistoryCalendarSection } from '@/components/health/features/diet-charts/diet-history-calendar-section';
import { MacroBreakdownChart } from '@/components/health/features/diet-charts/macro-breakdown-chart';
import { useDietHistory } from '@/hooks/health/use-diet-history';
import { useDietPlan } from '@/hooks/health/use-diet-plan';
import { calcDailyTotals, formatDateISO } from '@/lib/health/nutrition';

const HISTORY_RANGE_DAYS = 450;

function historyDateRange(): { from: string; to: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - HISTORY_RANGE_DAYS);
  return { from: formatDateISO(start), to: formatDateISO(end) };
}

const AdherenceChart = dynamic(
  () =>
    import('@/components/health/features/diet-charts/adherence-chart').then(
      (m) => ({ default: m.AdherenceChart }),
    ),
  { ssr: false, loading: () => <Skeleton variant="block" className="h-64 w-full" /> },
);

export default function NutritionHistoryPage() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const dateRange = useMemo(() => historyDateRange(), []);
  const { meals, isLoading: planLoading } = useDietPlan();
  const { logs, todayTotals, isLoading: logsLoading } = useDietHistory({
    dateRange,
    activePlanMeals: meals,
  });

  const macroTotals = useMemo(() => {
    if (!selectedDate) return todayTotals;
    return calcDailyTotals(logs, selectedDate, meals.length > 0 ? meals : undefined);
  }, [selectedDate, logs, meals, todayTotals]);

  const isLoading = planLoading || logsLoading;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title="Tendências" subtitle="Visualize sua performance nutricional." />
      <ConsistencyStats />
      <AdherenceChart days={14} />
      <MacroBreakdownChart
        totals={macroTotals}
        title={selectedDate ? 'Macros do dia selecionado' : 'Macros de hoje'}
      />
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text-primary">Histórico por dia</h2>
        <p className="text-xs text-text-muted">
          Selecione um dia no calendário para ver o consumo registado e os totais.
        </p>
        <DietHistoryCalendarSection
          logs={logs}
          meals={meals}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          isLoading={isLoading}
        />
      </section>
    </div>
  );
}
