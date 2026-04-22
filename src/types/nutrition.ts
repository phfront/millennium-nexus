// === Nutrition & Diet Types ===

export type Food = {
  id: string;
  user_id: string | null; // null = global (admin-managed)
  name: string;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  serving_unit: string; // 'g' | 'ml'
  created_at: string;
};

export type DietSettings = {
  user_id: string;
  weekly_extra_buffer: number;
  daily_water_target_ml: number;
  /** Lembretes push por horário das refeições do plano ativo. */
  meal_reminder_push_enabled: boolean;
  /** Minutos antes do target_time (5–120). */
  meal_reminder_lead_minutes: number;
  created_at: string;
  updated_at: string;
};

export type DietPlan = {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type DietPlanMeal = {
  id: string;
  plan_id: string;
  name: string;
  sort_order: number;
  target_time: string | null;
  /** Incluir esta refeição nos lembretes push (requer target_time). */
  meal_reminder_enabled: boolean;
};

export type DietPlanMealItem = {
  id: string;
  meal_id: string;
  food_id: string;
  quantity_g: number;
  quantity_units: number;
  sort_order: number;
  food?: Food;
};

export type FoodSubstitution = {
  id: string;
  original_item_id: string;
  substitute_food_id: string;
  substitute_quantity_g: number;
  substitute_quantity_units: number;
  substitute_food?: Food;
};

export type DietLog = {
  id: string;
  user_id: string;
  logged_date: string;
  meal_name: string;
  food_name: string;
  quantity_g: number;
  quantity_units: number;
  serving_unit: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  is_extra: boolean;
  meal_target_time: string | null;
  checked_at: string;
};

export type WaterLog = {
  id: string;
  user_id: string;
  logged_date: string;
  amount_ml: number;
  logged_at: string;
};

/** Macros calculados para uma quantidade específica */
export type MacroValues = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** Refeição do plano com items expandidos (joins) */
export type DietPlanMealWithItems = DietPlanMeal & {
  items: (DietPlanMealItem & { food: Food; substitutions?: FoodSubstitution[] })[];
};

/** Totais diários de consumo */
export type DailyTotals = MacroValues & {
  logged_date: string;
  items_count: number;
  extra_kcal: number;
};

/** Dados de aderência para gráficos */
export type AdherenceDay = {
  date: string;
  planned_kcal: number;
  consumed_kcal: number;
  extra_kcal: number;
  adherence_percent: number;
};
