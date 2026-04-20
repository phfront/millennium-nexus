'use client';

import { TrendingUp, Calendar } from 'lucide-react';
import { StatCard, Skeleton } from '@phfront/millennium-ui';
import { useDietChartData } from '@/hooks/health/use-diet-chart-data';

export function ConsistencyStats() {
  const { avg7, avg30, activeDays7, activeDays30, isLoading } = useDietChartData(30);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="block" className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <TrendingUp size={16} className="text-text-muted" />
        <h3 className="text-sm font-semibold text-text-primary">Constância</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Aderência 7 dias"
          value={`${avg7}%`}
          valueTone={avg7 >= 80 ? 'positive' : avg7 >= 50 ? 'muted' : 'negative'}
          sub={`${activeDays7}/7 dias registrados`}
        />
        <StatCard
          label="Aderência 30 dias"
          value={`${avg30}%`}
          valueTone={avg30 >= 80 ? 'positive' : avg30 >= 50 ? 'muted' : 'negative'}
          sub={`${activeDays30}/30 dias registrados`}
        />
        <StatCard
          label="Dias ativos (7d)"
          value={`${activeDays7}`}
          sub="de 7 dias"
          valueTone={activeDays7 >= 5 ? 'positive' : 'muted'}
        />
        <StatCard
          label="Dias ativos (30d)"
          value={`${activeDays30}`}
          sub="de 30 dias"
          valueTone={activeDays30 >= 20 ? 'positive' : 'muted'}
        />
      </div>
    </div>
  );
}
