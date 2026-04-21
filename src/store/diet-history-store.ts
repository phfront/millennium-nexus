'use client';

import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import type { DietLog, Food } from '@/types/nutrition';
import {
  calcMacros,
  todayISO,
} from '@/lib/health/nutrition';

type DietHistoryScope = {
  userId: string | null;
  from: string;
  to: string;
};

type DietHistoryStore = DietHistoryScope & {
  logs: DietLog[];
  isLoading: boolean;
  reset: () => void;
  setScope: (userId: string, from: string, to: string) => void;
  fetchLogs: () => Promise<void>;
  checkMealItem: (
    mealName: string,
    food: Food,
    quantityG: number,
    isExtra?: boolean,
    quantityUnits?: number,
    mealTargetTime?: string | null,
  ) => Promise<DietLog>;
  uncheckLog: (logId: string) => Promise<void>;
  addExtraConsumption: (food: Food, quantityG: number, mealName?: string) => Promise<DietLog>;
};

const emptyScope: DietHistoryScope = {
  userId: null,
  from: '',
  to: '',
};

export const useDietHistoryStore = create<DietHistoryStore>((set, get) => ({
  ...emptyScope,
  logs: [],
  isLoading: true,

  reset: () =>
    set({
      ...emptyScope,
      logs: [],
      isLoading: false,
    }),

  setScope: (userId, from, to) => {
    const s = get();
    if (s.userId === userId && s.from === from && s.to === to) return;
    set({
      userId,
      from,
      to,
      isLoading: true,
      logs: s.userId !== userId ? [] : s.logs,
    });
  },

  fetchLogs: async () => {
    const { userId, from, to } = get();
    if (!userId) {
      set({ logs: [], isLoading: false });
      return;
    }
    set({ isLoading: true });
    const supabase = createClient();
    const { data } = await supabase
      .from('diet_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_date', from)
      .lte('logged_date', to)
      .order('checked_at', { ascending: true });

    set({ logs: (data ?? []) as DietLog[], isLoading: false });
  },

  checkMealItem: async (
    mealName,
    food,
    quantityG,
    isExtra = false,
    quantityUnits = 1,
    mealTargetTime = null,
  ) => {
    const { userId } = get();
    if (!userId) throw new Error('Não autenticado');
    const today = todayISO();
    const macrosPerUnit = calcMacros(food, quantityG);
    const units = Math.max(1, quantityUnits);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('diet_logs')
      .insert({
        user_id: userId,
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
    set((state) => ({ logs: [...state.logs, newLog] }));
    return newLog;
  },

  uncheckLog: async (logId) => {
    const supabase = createClient();
    const { error } = await supabase.from('diet_logs').delete().eq('id', logId);
    if (error) throw new Error(error.message);
    set((state) => ({ logs: state.logs.filter((l) => l.id !== logId) }));
  },

  addExtraConsumption: async (food, quantityG, mealName = 'Extra') => {
    return get().checkMealItem(mealName, food, quantityG, true);
  },
}));
