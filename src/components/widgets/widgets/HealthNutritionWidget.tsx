'use client';

import { Skeleton } from '@phfront/millennium-ui';
import { useDietSettings } from '@/hooks/health/use-diet-settings';
import { WaterTracker } from '@/components/health/features/water-tracker/water-tracker';

export function HealthNutritionWidget() {
  const { settings, isLoading: settingsLoading } = useDietSettings();
  const targetFromSettings = settings?.daily_water_target_ml;

  if (settingsLoading) {
    return <Skeleton variant="block" className="h-full min-h-0 w-full" />;
  }

  return <WaterTracker targetMl={targetFromSettings} hasBackground={false} />;
}
