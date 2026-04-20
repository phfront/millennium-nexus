import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DietPlan,
  DietPlanMeal,
  DietPlanMealItem,
  DietPlanMealWithItems,
  FoodSubstitution,
} from '@/types/nutrition';

/**
 * Refeições do plano de dieta ativo, com o mesmo parsing que `useDietPlan`.
 * Usado para derivar kcal planejadas sem depender de `diet_settings.daily_kcal_target`.
 */
export async function fetchActiveDietPlanMeals(
  supabase: SupabaseClient,
  userId: string,
): Promise<DietPlanMealWithItems[]> {
  const { data: planData } = await supabase
    .from('diet_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (!planData) return [];

  const activePlan = planData as DietPlan;

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

  return ((mealsData ?? []) as DietPlanMeal[]).map((meal) => {
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
      items,
    };
  });
}
