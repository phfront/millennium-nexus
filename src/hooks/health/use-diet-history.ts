'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import type { DietLog, Food, FoodSubstitution } from '@/types/nutrition';

/** Item do plano no checklist (principal + substituições opcionais). */
export type ChecklistPlanItem = {
  food: Food;
  substitutions?: (FoodSubstitution & { substitute_food?: Food })[];
};
import { calcMacros, todayISO, calcWeeklyBufferUsed, calcDailyTotals } from '@/lib/health/nutrition';

/**
 * Hook para persistência imutável de diet_logs.
 * Snapshots de consumo diário — nunca são alterados retroativamente.
 */
export function useDietHistory(dateRange?: { from: string; to: string }) {
  const user = useUserStore((s) => s.user);
  const [logs, setLogs] = useState<DietLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const today = todayISO();
  const from = dateRange?.from ?? today;
  const to = dateRange?.to ?? today;

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('diet_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('logged_date', from)
      .lte('logged_date', to)
      .order('checked_at', { ascending: true });

    setLogs((data ?? []) as DietLog[]);
    setIsLoading(false);
  }, [user, from, to]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  /**
   * Marca um item da dieta como consumido (cria snapshot).
   * Salva os macros atuais — mudanças futuras no alimento não afetam este registro.
   */
  async function checkMealItem(
    mealName: string,
    food: Food,
    quantityG: number,
    isExtra = false,
    quantityUnits = 1,
    mealTargetTime: string | null = null,
  ) {
    if (!user) throw new Error('Não autenticado');
    const macrosPerUnit = calcMacros(food, quantityG);
    const units = Math.max(1, quantityUnits);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('diet_logs')
      .insert({
        user_id: user.id,
        logged_date: today,
        meal_name: mealName,
        food_name: food.name,
        quantity_g: quantityG,
        quantity_units: units,
        serving_unit: food.serving_unit ?? 'g',
        kcal: macrosPerUnit.kcal * units,
        protein: macrosPerUnit.protein * units,
        carbs: macrosPerUnit.carbs * units,
        fat: macrosPerUnit.fat * units,
        is_extra: isExtra,
        meal_target_time: mealTargetTime,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const newLog = data as DietLog;
    setLogs((prev) => [...prev, newLog]);
    return newLog;
  }

  /**
   * Remove um log de consumo (para corrigir enganos do dia atual).
   */
  async function uncheckLog(logId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('diet_logs')
      .delete()
      .eq('id', logId);
    if (error) throw new Error(error.message);
    setLogs((prev) => prev.filter((l) => l.id !== logId));
  }

  /**
   * Registra consumo extra ("comi algo a mais").
   */
  async function addExtraConsumption(
    food: Food,
    quantityG: number,
    mealName = 'Extra',
  ) {
    return checkMealItem(mealName, food, quantityG, true);
  }

  /**
   * Verifica se um item do plano já foi marcado hoje.
   */
  function isItemCheckedToday(mealName: string, foodName: string): DietLog | undefined {
    return logs.find(
      (l) =>
        l.logged_date === today &&
        l.meal_name === mealName &&
        l.food_name === foodName &&
        !l.is_extra,
    );
  }

  function slotAllowedFoodNames(item: ChecklistPlanItem): Set<string> {
    const names = new Set<string>([item.food.name]);
    for (const sub of item.substitutions ?? []) {
      const n = sub.substitute_food?.name;
      if (n) names.add(n);
    }
    return names;
  }

  /** Log do dia para este “slot” do plano: principal ou qualquer substituição. */
  function findPlanSlotLog(mealName: string, item: ChecklistPlanItem): DietLog | undefined {
    const allowed = slotAllowedFoodNames(item);
    return logs.find(
      (l) =>
        l.logged_date === today &&
        l.meal_name === mealName &&
        !l.is_extra &&
        allowed.has(l.food_name),
    );
  }

  const todayLogs = logs.filter((l) => l.logged_date === today);
  const todayTotals = calcDailyTotals(logs, today);
  const weeklyBufferUsed = calcWeeklyBufferUsed(logs);

  return {
    logs,
    todayLogs,
    todayTotals,
    weeklyBufferUsed,
    isLoading,
    refetch: fetchLogs,
    checkMealItem,
    uncheckLog,
    addExtraConsumption,
    isItemCheckedToday,
    findPlanSlotLog,
  };
}
