'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import type {
  DietPlan,
  DietPlanMeal,
  DietPlanMealItem,
  FoodSubstitution,
  DietPlanMealWithItems,
} from '@/types/nutrition';

export function useDietPlan() {
  const user = useUserStore((s) => s.user);
  const [plan, setPlan] = useState<DietPlan | null>(null);
  const [meals, setMeals] = useState<DietPlanMealWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivePlan = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const supabase = createClient();

    // 1. Busca plano ativo
    const { data: planData } = await supabase
      .from('diet_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!planData) {
      setPlan(null);
      setMeals([]);
      setIsLoading(false);
      return;
    }

    const activePlan = planData as DietPlan;
    setPlan(activePlan);

    // 2. Busca refeições com items e foods
    const { data: mealsData } = await supabase
      .from('diet_plan_meals')
      .select(`
        *,
        diet_plan_meal_items (
          *,
          foods (*),
          food_substitutions (
            *,
            foods:substitute_food_id (*)
          )
        )
      `)
      .eq('plan_id', activePlan.id)
      .order('sort_order', { ascending: true });

    const parsedMeals: DietPlanMealWithItems[] = ((mealsData ?? []) as DietPlanMeal[]).map((meal) => {
      const raw = meal as DietPlanMeal & {
        diet_plan_meal_items?: (DietPlanMealItem & {
          foods?: Record<string, unknown>;
          food_substitutions?: (FoodSubstitution & { foods?: Record<string, unknown> })[];
        })[];
      };

      const items = (raw.diet_plan_meal_items ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((item) => ({
          ...item,
          food: item.foods as unknown as DietPlanMealWithItems['items'][0]['food'],
          substitutions: (item.food_substitutions ?? []).map((sub) => ({
            ...sub,
            substitute_food: sub.foods as unknown as FoodSubstitution['substitute_food'],
          })),
        }));

      return {
        id: meal.id,
        plan_id: meal.plan_id,
        name: meal.name,
        sort_order: meal.sort_order,
        target_time: meal.target_time,
        meal_reminder_enabled: meal.meal_reminder_enabled ?? true,
        items,
      };
    });

    setMeals(parsedMeals);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchActivePlan();
  }, [fetchActivePlan]);

  // --- Plan CRUD ---
  async function createPlan(name: string) {
    if (!user) throw new Error('Não autenticado');
    const supabase = createClient();

    // Desativa planos anteriores
    await supabase
      .from('diet_plans')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    const { data, error } = await supabase
      .from('diet_plans')
      .insert({ user_id: user.id, name, is_active: true })
      .select()
      .single();
    if (error) throw new Error(error.message);
    setPlan(data as DietPlan);
    setMeals([]);
    return data as DietPlan;
  }

  async function renamePlan(name: string) {
    if (!plan) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('diet_plans')
      .update({ name })
      .eq('id', plan.id);
    if (error) throw new Error(error.message);
    setPlan((prev) => (prev ? { ...prev, name } : null));
  }

  // --- Meal CRUD ---
  async function addMeal(name: string, targetTime?: string) {
    if (!plan) throw new Error('Nenhum plano ativo');
    const supabase = createClient();
    const nextOrder = meals.length;
    const { data, error } = await supabase
      .from('diet_plan_meals')
      .insert({
        plan_id: plan.id,
        name,
        sort_order: nextOrder,
        target_time: targetTime ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const newMeal = data as DietPlanMeal;
    setMeals((prev) => [
      ...prev,
      { ...newMeal, meal_reminder_enabled: newMeal.meal_reminder_enabled ?? true, items: [] },
    ]);
    return newMeal;
  }

  async function updateMeal(
    mealId: string,
    values: Partial<Pick<DietPlanMeal, 'name' | 'target_time' | 'meal_reminder_enabled'>>,
  ) {
    const supabase = createClient();
    const { error } = await supabase
      .from('diet_plan_meals')
      .update(values)
      .eq('id', mealId);
    if (error) throw new Error(error.message);
    setMeals((prev) =>
      prev.map((m) => (m.id === mealId ? { ...m, ...values } : m)),
    );
  }

  async function deleteMeal(mealId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('diet_plan_meals')
      .delete()
      .eq('id', mealId);
    if (error) throw new Error(error.message);
    setMeals((prev) => prev.filter((m) => m.id !== mealId));
  }

  // --- Meal Item CRUD ---
  async function addMealItem(mealId: string, foodId: string, quantityG: number, quantityUnits = 1) {
    const supabase = createClient();
    const meal = meals.find((m) => m.id === mealId);
    const nextOrder = meal ? meal.items.length : 0;

    const { data, error } = await supabase
      .from('diet_plan_meal_items')
      .insert({
        meal_id: mealId,
        food_id: foodId,
        quantity_g: quantityG,
        quantity_units: quantityUnits,
        sort_order: nextOrder,
      })
      .select('*, foods(*)')
      .single();
    if (error) throw new Error(error.message);

    const raw = data as DietPlanMealItem & { foods: Record<string, unknown> };
    const newItem = {
      ...raw,
      food: raw.foods as unknown as DietPlanMealWithItems['items'][0]['food'],
      substitutions: [],
    };

    setMeals((prev) =>
      prev.map((m) =>
        m.id === mealId ? { ...m, items: [...m.items, newItem] } : m,
      ),
    );
    return newItem;
  }

  async function updateMealItem(itemId: string, quantityG: number, quantityUnits: number) {
    const supabase = createClient();
    const { error } = await supabase
      .from('diet_plan_meal_items')
      .update({ quantity_g: quantityG, quantity_units: quantityUnits })
      .eq('id', itemId);
    if (error) throw new Error(error.message);
    setMeals((prev) =>
      prev.map((m) => ({
        ...m,
        items: m.items.map((i) =>
          i.id === itemId ? { ...i, quantity_g: quantityG, quantity_units: quantityUnits } : i,
        ),
      })),
    );
  }

  async function removeMealItem(mealId: string, itemId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('diet_plan_meal_items')
      .delete()
      .eq('id', itemId);
    if (error) throw new Error(error.message);
    setMeals((prev) =>
      prev.map((m) =>
        m.id === mealId
          ? { ...m, items: m.items.filter((i) => i.id !== itemId) }
          : m,
      ),
    );
  }

  // --- Substitutions ---
  async function addSubstitution(
    originalItemId: string,
    substituteFoodId: string,
    substituteQuantityG: number,
    substituteQuantityUnits = 1,
  ) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('food_substitutions')
      .insert({
        original_item_id: originalItemId,
        substitute_food_id: substituteFoodId,
        substitute_quantity_g: substituteQuantityG,
        substitute_quantity_units: substituteQuantityUnits,
      })
      .select('*, foods:substitute_food_id(*)')
      .single();
    if (error) throw new Error(error.message);

    const raw = data as FoodSubstitution & { foods: Record<string, unknown> };
    const newSub = {
      ...raw,
      substitute_food: raw.foods as unknown as FoodSubstitution['substitute_food'],
    };

    setMeals((prev) =>
      prev.map((m) => ({
        ...m,
        items: m.items.map((i) =>
          i.id === originalItemId
            ? { ...i, substitutions: [...(i.substitutions ?? []), newSub] }
            : i,
        ),
      })),
    );
    return newSub;
  }

  async function updateSubstitution(subId: string, quantityG: number, quantityUnits: number) {
    const supabase = createClient();
    const { error } = await supabase
      .from('food_substitutions')
      .update({ substitute_quantity_g: quantityG, substitute_quantity_units: quantityUnits })
      .eq('id', subId);
    if (error) throw new Error(error.message);
    setMeals((prev) =>
      prev.map((m) => ({
        ...m,
        items: m.items.map((i) => ({
          ...i,
          substitutions: (i.substitutions ?? []).map((s) =>
            s.id === subId ? { ...s, substitute_quantity_g: quantityG, substitute_quantity_units: quantityUnits } : s,
          ),
        })),
      })),
    );
  }

  async function removeSubstitution(subId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('food_substitutions')
      .delete()
      .eq('id', subId);
    if (error) throw new Error(error.message);
    setMeals((prev) =>
      prev.map((m) => ({
        ...m,
        items: m.items.map((i) => ({
          ...i,
          substitutions: (i.substitutions ?? []).filter((s) => s.id !== subId),
        })),
      })),
    );
  }

  return {
    plan,
    meals,
    isLoading,
    refetch: fetchActivePlan,
    createPlan,
    renamePlan,
    addMeal,
    updateMeal,
    deleteMeal,
    addMealItem,
    updateMealItem,
    removeMealItem,
    addSubstitution,
    updateSubstitution,
    removeSubstitution,
  };
}
