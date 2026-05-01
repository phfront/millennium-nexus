'use client';

import { useState } from 'react';
import { Skeleton } from '@phfront/millennium-ui';
import { useCaloriasSettings } from '@/hooks/health/use-calorias-settings';
import {
  useCaloriasHistory,
  type CaloriasHistoryPresetDays,
} from '@/hooks/health/use-calorias-history';
import { CaloriasHistory } from './calorias-history';

export function CaloriasHistoryClient() {
  const { settings, isLoading: settingsLoading } = useCaloriasSettings();
  const [presetDays, setPresetDays] = useState<CaloriasHistoryPresetDays>(30);
  const hist = useCaloriasHistory(settings, presetDays);

  if (settingsLoading || !settings) {
    return <Skeleton variant="block" className="h-64 w-full max-w-2xl rounded-2xl" />;
  }

  return (
    <CaloriasHistory
      presetDays={presetDays}
      onPresetDaysChange={setPresetDays}
      dayRows={hist.dayRows}
      weekRows={hist.weekRows}
      monthRows={hist.monthRows}
      isLoading={hist.isLoading}
      removeLog={hist.removeLog}
      addKcal={hist.addKcal}
      visibleStart={hist.visibleStart}
      visibleEnd={hist.visibleEnd}
    />
  );
}
