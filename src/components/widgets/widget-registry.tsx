'use client';

import type { DashboardWidgetKey } from '@/lib/widgets/catalog';
import { HealthNutritionWidget } from '@/components/widgets/widgets/HealthNutritionWidget';
import { HealthNutritionSummaryWidget } from '@/components/widgets/widgets/HealthNutritionSummaryWidget';
import { HealthMealsWidget } from '@/components/widgets/widgets/HealthMealsWidget';
import { HealthCaloriasWidget } from '@/components/widgets/widgets/HealthCaloriasWidget';
import { HealthCaloriasWeekWidget } from '@/components/widgets/widgets/HealthCaloriasWeekWidget';
import { HabitsGoalsSummaryWidget } from '@/components/widgets/widgets/HabitsGoalsSummaryWidget';
import { HabitsGoalsCarouselWidget } from '@/components/widgets/widgets/HabitsGoalsCarouselWidget';
import type { ComponentType } from 'react';

const WIDGET_COMPONENTS: Record<DashboardWidgetKey, ComponentType> = {
  health_nutrition: HealthNutritionWidget,
  health_nutrition_summary: HealthNutritionSummaryWidget,
  health_meals: HealthMealsWidget,
  health_calorias: HealthCaloriasWidget,
  health_calorias_week: HealthCaloriasWeekWidget,
  daily_goals_summary: HabitsGoalsSummaryWidget,
  daily_goals_carousel: HabitsGoalsCarouselWidget,
};

export function WidgetRenderer({ widgetKey }: { widgetKey: DashboardWidgetKey }) {
  const Component = WIDGET_COMPONENTS[widgetKey];
  return <Component />;
}
