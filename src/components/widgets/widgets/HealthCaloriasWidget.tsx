'use client';

import Link from 'next/link';
import { Button, EmptyState, Skeleton } from '@phfront/millennium-ui';
import { CaloriasTracker } from '@/components/health/features/calorias/calorias-tracker';
import { useCaloriasSettings } from '@/hooks/health/use-calorias-settings';
import { useCaloriasTracker } from '@/hooks/health/use-calorias-tracker';

export function HealthCaloriasWidget() {
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
        description="Defina a meta diaria e os dias ativos para registar na home."
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
    <CaloriasTracker
      settings={settings}
      logs={tracker.logs}
      isLoading={tracker.isLoading}
      addKcal={tracker.addKcal}
      undoLast={tracker.undoLast}
      today={tracker.today}
      weekTotalKcal={tracker.weekTotalKcal}
      weeklyTargetKcal={tracker.weeklyTargetKcal}
      weeklyRemaining={tracker.weeklyRemaining}
      effectiveTargetToday={tracker.effectiveTargetToday}
      todayTotal={tracker.todayTotal}
      todayRemaining={tracker.todayRemaining}
      progressToday={tracker.progressToday}
      hasBackground={false}
    />
  );
}
