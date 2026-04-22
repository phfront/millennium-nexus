'use client';

import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useUserStore } from '@/store/user-store';
import { useDietHistoryStore } from '@/store/diet-history-store';
import type { DietLog, DietPlanMealWithItems, Food, FoodSubstitution } from '@/types/nutrition';
import {
  calcDailyTotals,
  calcWeeklyBufferUsed,
  getCalendarWeekBoundsISO,
  planSlotAllowedFoodNames,
  todayISO,
} from '@/lib/health/nutrition';

/** Item do plano no checklist (principal + substituições opcionais). */
export type ChecklistPlanItem = {
  food: Food;
  substitutions?: (FoodSubstitution & { substitute_food?: Food })[];
};

export type UseDietHistoryOptions = {
  dateRange?: { from: string; to: string };
  activePlanMeals?: DietPlanMealWithItems[];
};

function normalizeUseDietHistoryArg(
  arg?: UseDietHistoryOptions | { from: string; to: string },
): UseDietHistoryOptions {
  if (!arg) return {};
  if ('dateRange' in arg || 'activePlanMeals' in arg) return arg as UseDietHistoryOptions;
  if ('from' in arg && 'to' in arg) return { dateRange: arg };
  return {};
}

/**
 * Persistência de diet_logs partilhada entre componentes (ex.: checklist + widget de resumo).
 * Aceita `{ from, to }` legado como atalho de `dateRange`.
 */
export function useDietHistory(arg?: UseDietHistoryOptions | { from: string; to: string }) {
  const { dateRange, activePlanMeals } = normalizeUseDietHistoryArg(arg);
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

  const {
    logs,
    isLoading,
    checkMealItem,
    uncheckLog,
    fetchLogs,
    addExtraConsumption,
    clearDietLogsForDate,
  } = useDietHistoryStore(
    useShallow((s) => ({
      logs: s.logs,
      isLoading: s.isLoading,
      checkMealItem: s.checkMealItem,
      uncheckLog: s.uncheckLog,
      fetchLogs: s.fetchLogs,
      addExtraConsumption: s.addExtraConsumption,
      clearDietLogsForDate: s.clearDietLogsForDate,
    })),
  );

  const today = todayISO();
  const planForTotals =
    activePlanMeals && activePlanMeals.length > 0 ? activePlanMeals : undefined;
  const todayLogs = useMemo(() => logs.filter((l) => l.logged_date === today), [logs, today]);
  const todayTotals = useMemo(
    () => calcDailyTotals(logs, today, planForTotals),
    [logs, today, planForTotals],
  );
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
      clearDietLogsForDate,
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
        const allowed = planSlotAllowedFoodNames(
          item as DietPlanMealWithItems['items'][number],
        );
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
      clearDietLogsForDate,
      today,
    ],
  );
}
