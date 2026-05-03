'use client';

import Link from 'next/link';
import { Button, EmptyState, Skeleton } from '@phfront/millennium-ui';
import { CaloriasWeekGrid } from '@/components/health/features/calorias/calorias-week-grid';
import { useCaloriasSettings } from '@/hooks/health/use-calorias-settings';
import { useCaloriasTracker } from '@/hooks/health/use-calorias-tracker';

export function HealthCaloriasWeekWidget() {
  const { settings, isLoading: settingsLoading } = useCaloriasSettings();
  const tracker = useCaloriasTracker(settings);

  if (settingsLoading) {
    return <Skeleton variant="block" className="h-full min-h-0 w-full" />;
  }

  if (!settings) {
    return (
      <EmptyState
        className="h-full min-h-0 justify-center py-6"
        title="Calorias nao configuradas"
        description="Defina a meta diaria e os dias ativos para ver a semana na home."
        action={
          <Link href="/health/calorias/settings">
            <Button variant="secondary" size="sm">
              Configurar
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <CaloriasWeekGrid
      settings={settings}
      logs={tracker.logs}
      weekDates={tracker.weekDates}
      weekBounds={tracker.weekBounds}
      today={tracker.today}
      isLoading={tracker.isLoading}
      addKcal={tracker.addKcal}
      undoLastForDate={tracker.undoLastForDate}
      hasBackground={false}
    />
  );
}
