'use client';

import { Skeleton } from '@phfront/millennium-ui';
import { useCaloriasSettings } from '@/hooks/health/use-calorias-settings';
import { useCaloriasTracker } from '@/hooks/health/use-calorias-tracker';
import { CaloriasEvolutionChart } from './calorias-evolution-chart';
import { CaloriasTracker } from './calorias-tracker';
import { CaloriasWeekGrid } from './calorias-week-grid';

export function CaloriasTrackerClient() {
  const { settings, isLoading: settingsLoading } = useCaloriasSettings();
  const tracker = useCaloriasTracker(settings);

  if (settingsLoading || !settings) {
    return <Skeleton variant="block" className="h-72 w-full max-w-3xl rounded-2xl" />;
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
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
      />
      <CaloriasEvolutionChart
        settings={settings}
        logs={tracker.evolutionLogs}
        today={tracker.today}
        isLoading={tracker.isLoading}
      />
      <CaloriasWeekGrid
        settings={settings}
        logs={tracker.logs}
        weekDates={tracker.weekDates}
        weekBounds={tracker.weekBounds}
        today={tracker.today}
        isLoading={tracker.isLoading}
        addKcal={tracker.addKcal}
        undoLastForDate={tracker.undoLastForDate}
      />
    </div>
  );
}
