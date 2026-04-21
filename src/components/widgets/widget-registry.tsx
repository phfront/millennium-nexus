'use client';

import type { DashboardWidgetKey } from '@/lib/widgets/catalog';
import { HealthNutritionWidget } from '@/components/widgets/widgets/HealthNutritionWidget';
import { HealthNutritionSummaryWidget } from '@/components/widgets/widgets/HealthNutritionSummaryWidget';
import { HealthMealsWidget } from '@/components/widgets/widgets/HealthMealsWidget';
import { DailyGoalsSummaryWidget } from '@/components/widgets/widgets/DailyGoalsSummaryWidget';
import { DailyGoalsCarouselWidget } from '@/components/widgets/widgets/DailyGoalsCarouselWidget';
import type { ComponentType } from 'react';

const WIDGET_COMPONENTS: Record<DashboardWidgetKey, ComponentType> = {
  health_nutrition: HealthNutritionWidget,
  health_nutrition_summary: HealthNutritionSummaryWidget,
  health_meals: HealthMealsWidget,
  daily_goals_summary: DailyGoalsSummaryWidget,
  daily_goals_carousel: DailyGoalsCarouselWidget,
};

export function WidgetRenderer({ widgetKey }: { widgetKey: DashboardWidgetKey }) {
  const Component = WIDGET_COMPONENTS[widgetKey];
  return <Component />;
}
