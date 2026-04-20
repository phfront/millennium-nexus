'use client';

import dynamic from 'next/dynamic';
import { PageHeader, Skeleton } from '@phfront/millennium-ui';
import { ConsistencyStats } from '@/components/health/features/diet-charts/consistency-stats';
import { useDietHistory } from '@/hooks/health/use-diet-history';
import { MacroBreakdownChart } from '@/components/health/features/diet-charts/macro-breakdown-chart';

const AdherenceChart = dynamic(
  () =>
    import('@/components/health/features/diet-charts/adherence-chart').then(
      (m) => ({ default: m.AdherenceChart }),
    ),
  { ssr: false, loading: () => <Skeleton variant="block" className="h-64 w-full" /> },
);

export default function NutritionHistoryPage() {
  const { todayTotals } = useDietHistory();

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <PageHeader title="Tendências" subtitle="Visualize sua performance nutricional." />
      <ConsistencyStats />
      <AdherenceChart days={14} />
      <MacroBreakdownChart totals={todayTotals} />
    </div>
  );
}
