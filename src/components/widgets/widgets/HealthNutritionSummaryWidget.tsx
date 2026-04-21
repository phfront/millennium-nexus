'use client';

import { DailyNutritionSummaryPanel } from '@/components/health/features/daily-nutrition-summary/daily-nutrition-summary-panel';

export function HealthNutritionSummaryWidget() {
  return (
    <div className="h-full min-h-0">
      <DailyNutritionSummaryPanel hasBackground={false} />
    </div>
  );
}
