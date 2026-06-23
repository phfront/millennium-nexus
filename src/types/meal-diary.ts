/** @deprecated Legado — conclusão é sempre por itens do plano; meta kcal é calculada. */
export type MealDiaryGoalMode = 'kcal' | 'items';

export type MealDiaryFoodSnapshot = {
  food_id: string;
  food_name: string;
  quantity_g: number;
  quantity_units: number;
  serving_unit: string;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
};

export type MealDiaryPlannedSubstitution = MealDiaryFoodSnapshot & {
  id: string;
};

export type MealDiaryPlannedItem = MealDiaryFoodSnapshot & {
  id: string;
  substitutions?: MealDiaryPlannedSubstitution[];
};

export type MealDiaryPlannedMeal = {
  id: string;
  label: string;
  sort_order: number;
  items: MealDiaryPlannedItem[];
};

export type MealDiarySourceConfig = {
  /** @deprecated Ignorado na lógica atual. */
  goal_mode?: MealDiaryGoalMode;
  /** Calorias extras permitidas na semana (refeições fora do plano). */
  weekly_free_kcal: number;
  meals: MealDiaryPlannedMeal[];
};

export type MealDiaryLogEntry = {
  id: string;
  meal_id: string;
  meal_label: string;
  planned_item_id: string | null;
  /** null = alimento principal do slot; id = substituto escolhido. */
  substitution_id?: string | null;
  food_id: string;
  food_name: string;
  quantity_g: number;
  quantity_units: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  logged_at: string;
  is_extra_meal: boolean;
};

export type MealDiaryExtraMeal = {
  id: string;
  label: string;
};

export type MealDiaryLogNote = {
  entries: MealDiaryLogEntry[];
  extra_meals: MealDiaryExtraMeal[];
};

export type MealDiaryPlannedItemStatus = {
  item: MealDiaryPlannedItem;
  meal_id: string;
  meal_label: string;
  consumed_g: number;
  consumed_units: number;
  planned_g: number;
  planned_units: number;
  ratio: number;
  complete: boolean;
  partial: boolean;
};

export type MealDiaryConsumptionOption = MealDiaryFoodSnapshot & {
  substitution_id: string | null;
  option_label: string;
};
