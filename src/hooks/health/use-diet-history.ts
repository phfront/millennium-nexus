'use client';

import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useUserStore } from '@/store/user-store';
import { useDietHistoryStore } from '@/store/diet-history-store';
import type { DietLog, Food, FoodSubstitution } from '@/types/nutrition';
import {
  calcDailyTotals,
  calcWeeklyBufferUsed,
  getCalendarWeekBoundsISO,
  todayISO,
} from '@/lib/health/nutrition';

/** Item do plano no checklist (principal + substituições opcionais). */
export type ChecklistPlanItem = {
  food: Food;
  substitutions?: (FoodSubstitution & { substitute_food?: Food })[];
};

function slotAllowedFoodNames(item: ChecklistPlanItem): Set<string> {
  const names = new Set<string>([item.food.name]);
  for (const sub of item.substitutions ?? []) {
    const n = sub.substitute_food?.name;
    if (n) names.add(n);
  }
  return names;
}

/**
 * Persistência de diet_logs partilhada entre componentes (ex.: checklist + widget de resumo).
 */
export function useDietHistory(dateRange?: { from: string; to: string }) {
  const user = useUserStore((s) => s.user);
  const { monday: weekMonday, sunday: weekSunday } = getCalendarWeekBoundsISO(new Date());
  const from = dateRange?.from ?? weekMonday;
  const to = dateRange?.to ?? weekSunday;

  useEffect(() => {
    if (!user?.id) {
      useDietHistoryStore.getState().reset();
      return;
    }
    useDietHistoryStore.getState().setScope(user.id, from, to);
    void useDietHistoryStore.getState().fetchLogs();
  }, [user?.id, from, to]);

  const { logs, isLoading, checkMealItem, uncheckLog, fetchLogs, addExtraConsumption } =
    useDietHistoryStore(
      useShallow((s) => ({
        logs: s.logs,
        isLoading: s.isLoading,
        checkMealItem: s.checkMealItem,
        uncheckLog: s.uncheckLog,
        fetchLogs: s.fetchLogs,
        addExtraConsumption: s.addExtraConsumption,
      })),
    );

  const today = todayISO();
  const todayLogs = useMemo(() => logs.filter((l) => l.logged_date === today), [logs, today]);
  const todayTotals = useMemo(() => calcDailyTotals(logs, today), [logs, today]);
  const weeklyBufferUsed = useMemo(() => calcWeeklyBufferUsed(logs), [logs]);

  return useMemo(
    () => ({
      logs,
      todayLogs,
      todayTotals,
      weeklyBufferUsed,
      isLoading,
      refetch: fetchLogs,
      checkMealItem,
      uncheckLog,
      addExtraConsumption,
      isItemCheckedToday(mealName: string, foodName: string): DietLog | undefined {
        return logs.find(
          (l) =>
            l.logged_date === today &&
            l.meal_name === mealName &&
            l.food_name === foodName &&
            !l.is_extra,
        );
      },
      findPlanSlotLog(mealName: string, item: ChecklistPlanItem): DietLog | undefined {
        const allowed = slotAllowedFoodNames(item);
        return logs.find(
          (l) =>
            l.logged_date === today &&
            l.meal_name === mealName &&
            !l.is_extra &&
            allowed.has(l.food_name),
        );
      },
    }),
    [
      logs,
      todayLogs,
      todayTotals,
      weeklyBufferUsed,
      isLoading,
      fetchLogs,
      checkMealItem,
      uncheckLog,
      addExtraConsumption,
      today,
    ],
  );
}
