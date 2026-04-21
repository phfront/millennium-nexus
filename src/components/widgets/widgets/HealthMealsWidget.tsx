'use client';

import { UtensilsCrossed } from 'lucide-react';
import { DailyChecklist } from '@/components/health/features/daily-checklist/daily-checklist';
import { WidgetSectionHeader } from '@/components/widgets/WidgetSectionHeader';

export function HealthMealsWidget() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <WidgetSectionHeader
        className="shrink-0 px-3 pt-3"
        variant="amber"
        icon={<UtensilsCrossed className="h-3 w-3" aria-hidden />}
        title="Refeições do dia"
        subtitle="Marque o que já comeu conforme o plano e registe extras."
      />
      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
        <DailyChecklist hideDailySummary />
      </div>
    </div>
  );
}
