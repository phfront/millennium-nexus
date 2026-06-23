import type { Food } from '@/types/nutrition';
import type {
  MealDiaryConsumptionOption,
  MealDiaryExtraMeal,
  MealDiaryFoodSnapshot,
  MealDiaryLogEntry,
  MealDiaryLogNote,
  MealDiaryPlannedItem,
  MealDiaryPlannedItemStatus,
  MealDiaryPlannedMeal,
  MealDiaryPlannedSubstitution,
  MealDiarySourceConfig,
} from '@/types/meal-diary';

export function createMealId() {
  return `meal-${crypto.randomUUID().slice(0, 8)}`;
}

export function createPlannedItemId() {
  return `item-${crypto.randomUUID().slice(0, 8)}`;
}

export function createSubstitutionId() {
  return `sub-${crypto.randomUUID().slice(0, 8)}`;
}

export function createLogEntryId() {
  return `log-${crypto.randomUUID().slice(0, 8)}`;
}

export function defaultMealDiaryConfig(): MealDiarySourceConfig {
  return {
    weekly_free_kcal: 0,
    meals: [
      { id: createMealId(), label: 'Café da manhã', sort_order: 0, items: [] },
      { id: createMealId(), label: 'Almoço', sort_order: 1, items: [] },
      { id: createMealId(), label: 'Jantar', sort_order: 2, items: [] },
    ],
  };
}

export function parseMealDiaryConfig(raw: unknown): MealDiarySourceConfig {
  if (!raw || typeof raw !== 'object') return defaultMealDiaryConfig();
  const obj = raw as Partial<MealDiarySourceConfig>;
  const meals = Array.isArray(obj.meals)
    ? obj.meals
        .filter((m): m is MealDiaryPlannedMeal => !!m && typeof m === 'object' && typeof m.label === 'string')
        .map((m, index) => ({
          id: m.id || createMealId(),
          label: m.label.trim(),
          sort_order: m.sort_order ?? index,
          items: Array.isArray(m.items)
            ? m.items
                .filter((i): i is MealDiaryPlannedItem => !!i && typeof i.food_id === 'string')
                .map((i) => normalizePlannedItem(i))
            : [],
        }))
        .sort((a, b) => a.sort_order - b.sort_order)
    : defaultMealDiaryConfig().meals;

  const weeklyFree =
    typeof obj.weekly_free_kcal === 'number' && Number.isFinite(obj.weekly_free_kcal)
      ? Math.max(0, Math.round(obj.weekly_free_kcal))
      : 0;

  return {
    weekly_free_kcal: weeklyFree,
    meals: meals.length > 0 ? meals : defaultMealDiaryConfig().meals,
  };
}

export function plannedDailyKcal(config: MealDiarySourceConfig): number {
  let total = 0;
  for (const meal of config.meals) {
    for (const item of meal.items) {
      total += macrosFromPlannedItem(item, item.quantity_g, item.quantity_units).kcal;
    }
  }
  return Math.round(total);
}

export function plannedKcalForMeal(meal: MealDiaryPlannedMeal): number {
  return Math.round(
    meal.items.reduce(
      (sum, item) => sum + macrosFromPlannedItem(item, item.quantity_g, item.quantity_units).kcal,
      0,
    ),
  );
}

export function extraKcalFromEntries(entries: MealDiaryLogEntry[]): number {
  return Math.round(entries.filter((e) => e.is_extra_meal).reduce((sum, e) => sum + e.kcal, 0));
}

export function weeklyExtraKcalUsed(weekLogs: { note?: string | null }[]): number {
  let total = 0;
  for (const log of weekLogs) {
    total += extraKcalFromEntries(parseMealDiaryLogNote(log.note).entries);
  }
  return Math.round(total);
}

export function parseMealDiaryLogNote(note: string | null | undefined): MealDiaryLogNote {
  if (!note) return { entries: [], extra_meals: [] };
  try {
    const parsed = JSON.parse(note) as Partial<MealDiaryLogNote>;
    return {
      entries: Array.isArray(parsed.entries)
        ? parsed.entries.filter((e): e is MealDiaryLogEntry => !!e && typeof e.food_id === 'string')
        : [],
      extra_meals: Array.isArray(parsed.extra_meals)
        ? parsed.extra_meals.filter((m): m is MealDiaryExtraMeal => !!m && typeof m.label === 'string')
        : [],
    };
  } catch {
    return { entries: [], extra_meals: [] };
  }
}

export function macrosFromFood(
  food: Pick<
    Food,
    'kcal_per_100g' | 'protein_per_100g' | 'carbs_per_100g' | 'fat_per_100g' | 'serving_unit'
  >,
  quantity_g: number,
  quantity_units: number,
) {
  const gramsPerServing = quantity_g > 0 ? quantity_g : 100;
  const factor =
    quantity_units > 0
      ? (gramsPerServing / 100) * quantity_units
      : gramsPerServing / 100;
  return {
    kcal: Math.round(food.kcal_per_100g * factor * 10) / 10,
    protein: Math.round(food.protein_per_100g * factor * 10) / 10,
    carbs: Math.round(food.carbs_per_100g * factor * 10) / 10,
    fat: Math.round(food.fat_per_100g * factor * 10) / 10,
  };
}

export function macrosFromPlannedItem(item: MealDiaryPlannedItem, quantity_g: number, quantity_units: number) {
  return macrosFromFood(item, quantity_g, quantity_units);
}

export function consumedForPlannedItem(entries: MealDiaryLogEntry[], plannedItemId: string) {
  let consumed_g = 0;
  let consumed_units = 0;
  for (const entry of entries) {
    if (entry.planned_item_id !== plannedItemId) continue;
    consumed_g += entry.quantity_g;
    consumed_units += entry.quantity_units;
  }
  return { consumed_g, consumed_units };
}

function itemCompletionRatio(
  planned: MealDiaryPlannedItem,
  consumed_g: number,
  consumed_units: number,
): number {
  const plannedUnits = plannedPortionCount(planned);
  if (plannedUnits > 0) {
    return Math.min(1, consumed_units / plannedUnits);
  }
  if (planned.quantity_g <= 0) return consumed_units > 0 || consumed_g > 0 ? 1 : 0;
  return Math.min(1, consumed_g / planned.quantity_g);
}

export function plannedItemStatuses(
  config: MealDiarySourceConfig,
  entries: MealDiaryLogEntry[],
): MealDiaryPlannedItemStatus[] {
  const statuses: MealDiaryPlannedItemStatus[] = [];
  for (const meal of config.meals) {
    for (const item of meal.items) {
      const { consumed_g, consumed_units } = consumedForPlannedItem(entries, item.id);
      const ratio = itemCompletionRatio(item, consumed_g, consumed_units);
      statuses.push({
        item,
        meal_id: meal.id,
        meal_label: meal.label,
        consumed_g,
        consumed_units,
        planned_g: item.quantity_g,
        planned_units: item.quantity_units,
        ratio,
        complete: ratio >= 1,
        partial: ratio > 0 && ratio < 1,
      });
    }
  }
  return statuses;
}

export function totalPlannedItems(config: MealDiarySourceConfig): number {
  return config.meals.reduce((sum, meal) => sum + meal.items.length, 0);
}

export function completedPlannedItems(statuses: MealDiaryPlannedItemStatus[]): number {
  return statuses.filter((s) => s.complete).length;
}

export function pendingPlannedItems(statuses: MealDiaryPlannedItemStatus[]): MealDiaryPlannedItemStatus[] {
  return statuses.filter((s) => !s.complete);
}

export function sumLogMacros(entries: MealDiaryLogEntry[]) {
  return entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function mealDiaryProgressPct(config: MealDiarySourceConfig, entries: MealDiaryLogEntry[]): number {
  const total = totalPlannedItems(config);
  if (total <= 0) return 0;
  return Math.min(
    100,
    Math.round((completedPlannedItems(plannedItemStatuses(config, entries)) / total) * 100),
  );
}

export function mealDiaryAdherenceRatio(
  config: MealDiarySourceConfig,
  entries: MealDiaryLogEntry[],
): number {
  const total = totalPlannedItems(config);
  if (total <= 0) return 0;
  const statuses = plannedItemStatuses(config, entries);
  return statuses.reduce((sum, status) => sum + status.ratio, 0) / total;
}

export function isMealDiaryGoalMet(config: MealDiarySourceConfig, entries: MealDiaryLogEntry[]): boolean {
  const total = totalPlannedItems(config);
  if (total <= 0) return false;
  return completedPlannedItems(plannedItemStatuses(config, entries)) >= total;
}

export function mealDiaryLogValue(config: MealDiarySourceConfig, entries: MealDiaryLogEntry[]): number {
  return completedPlannedItems(plannedItemStatuses(config, entries));
}

/** Meta diária em kcal derivada do plano (para exibição e goal_value persistido). */
export function mealDiaryEffectiveDailyKcalGoal(config: MealDiarySourceConfig): number {
  return plannedDailyKcal(config);
}

export function serializeMealDiaryLog(note: MealDiaryLogNote): string {
  return JSON.stringify(note);
}

export function foodUsesGrams(food: Pick<Food, 'serving_unit'>): boolean {
  return food.serving_unit === 'g' || !food.serving_unit;
}

/** Porções planejadas (ex.: 2 pães). */
export function plannedPortionCount(item: Pick<MealDiaryPlannedItem, 'quantity_units'>): number {
  return item.quantity_units > 0 ? item.quantity_units : 1;
}

/** Gramas (ou ml) por porção — fixo no plano, não editado pelo usuário. */
export function gramsPerPortion(item: Pick<MealDiaryPlannedItem, 'quantity_g'>): number {
  return item.quantity_g > 0 ? item.quantity_g : 100;
}

function normalizeSubstitution(raw: MealDiaryPlannedSubstitution): MealDiaryPlannedSubstitution {
  return {
    ...raw,
    quantity_g: gramsPerPortion(raw),
    quantity_units: plannedPortionCount(raw),
  };
}

function normalizePlannedItem(item: MealDiaryPlannedItem): MealDiaryPlannedItem {
  const substitutions = Array.isArray(item.substitutions)
    ? item.substitutions
        .filter((s): s is MealDiaryPlannedSubstitution => !!s && typeof s.food_id === 'string')
        .map((s) => normalizeSubstitution({ ...s, id: s.id || createSubstitutionId() }))
    : [];

  return {
    ...item,
    quantity_g: gramsPerPortion(item),
    quantity_units: plannedPortionCount(item),
    substitutions,
  };
}

export function foodSnapshotFromFood(food: Food, quantity_g: number, quantity_units: number): MealDiaryFoodSnapshot {
  return {
    food_id: food.id,
    food_name: food.name,
    quantity_g,
    quantity_units,
    serving_unit: food.serving_unit ?? 'g',
    kcal_per_100g: food.kcal_per_100g,
    protein_per_100g: food.protein_per_100g,
    carbs_per_100g: food.carbs_per_100g,
    fat_per_100g: food.fat_per_100g,
  };
}

export function itemConsumptionOptions(item: MealDiaryPlannedItem): MealDiaryConsumptionOption[] {
  const main: MealDiaryConsumptionOption = {
    substitution_id: null,
    option_label: item.food_name,
    food_id: item.food_id,
    food_name: item.food_name,
    quantity_g: gramsPerPortion(item),
    quantity_units: plannedPortionCount(item),
    serving_unit: item.serving_unit,
    kcal_per_100g: item.kcal_per_100g,
    protein_per_100g: item.protein_per_100g,
    carbs_per_100g: item.carbs_per_100g,
    fat_per_100g: item.fat_per_100g,
  };

  const subs = (item.substitutions ?? []).map((sub) => ({
    substitution_id: sub.id,
    option_label: sub.food_name,
    food_id: sub.food_id,
    food_name: sub.food_name,
    quantity_g: gramsPerPortion(sub),
    quantity_units: plannedPortionCount(sub),
    serving_unit: sub.serving_unit,
    kcal_per_100g: sub.kcal_per_100g,
    protein_per_100g: sub.protein_per_100g,
    carbs_per_100g: sub.carbs_per_100g,
    fat_per_100g: sub.fat_per_100g,
  }));

  return [main, ...subs];
}

export function findConsumptionOption(
  item: MealDiaryPlannedItem,
  substitutionId: string | null | undefined,
): MealDiaryConsumptionOption {
  const options = itemConsumptionOptions(item);
  return options.find((o) => o.substitution_id === (substitutionId ?? null)) ?? options[0];
}

export function defaultQuantityForFood(_food: Pick<Food, 'serving_unit'>) {
  return { quantity_g: 100, quantity_units: 1 };
}

export function formatPortionCount(units: number): string {
  if (!Number.isFinite(units)) return '';
  const rounded = Math.round(units * 1_000_000) / 1_000_000;
  if (Number.isInteger(rounded)) return String(rounded);
  // Ponto decimal — seguro para <input type="number"> (vírgula quebra o valor).
  return String(rounded);
}

export function parsePortionCountInput(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 1_000_000) / 1_000_000;
}

export function buildPlannedItemFromFood(food: Food, quantity_g: number, quantity_units: number): MealDiaryPlannedItem {
  return {
    id: createPlannedItemId(),
    ...foodSnapshotFromFood(food, quantity_g, quantity_units),
    substitutions: [],
  };
}

export function buildSubstitutionFromFood(
  food: Food,
  quantity_g: number,
  quantity_units: number,
): MealDiaryPlannedSubstitution {
  return {
    id: createSubstitutionId(),
    ...foodSnapshotFromFood(food, quantity_g, quantity_units),
  };
}

function formatGramsWithQuantity(
  quantity_g: number,
  quantity_units: number,
  serving_unit?: string | null,
): string {
  const unit = serving_unit || 'g';
  const gramsValue = quantity_g > 0 ? quantity_g : 100;
  const units = quantity_units > 0 ? quantity_units : 1;
  const qtyStr = formatPortionCount(units);
  const portionStr = `${Math.round(gramsValue)}${unit}`;

  if (units === 1) return `${portionStr} · 1`;

  const totalGrams = Math.round(gramsValue * units * 10) / 10;
  const totalStr = `${formatPortionCount(totalGrams)}${unit}`;
  return `${totalStr} · ${portionStr} · ${qtyStr}`;
}

export function formatItemQuantity(
  item:
    | Pick<MealDiaryPlannedItem, 'quantity_g' | 'quantity_units' | 'serving_unit'>
    | Pick<MealDiaryLogEntry, 'quantity_g' | 'quantity_units'>,
) {
  const units = item.quantity_units ?? 0;
  const grams = item.quantity_g ?? 0;
  const unit = 'serving_unit' in item ? item.serving_unit || 'g' : 'g';
  if (units > 0 && grams > 0) {
    return formatGramsWithQuantity(grams, units, unit);
  }
  if (units > 0) return formatPortionCount(units);
  if (grams > 0) return `${Math.round(grams)}${unit}`;
  return '—';
}

export function formatPortionSize(item: Pick<MealDiaryPlannedItem, 'quantity_g' | 'serving_unit'>): string {
  return `${Math.round(gramsPerPortion(item))}${item.serving_unit || 'g'}`;
}

export function formatPortionWithQuantity(
  item: Pick<MealDiaryPlannedItem, 'quantity_g' | 'quantity_units' | 'serving_unit'>,
): string {
  return formatGramsWithQuantity(gramsPerPortion(item), plannedPortionCount(item), item.serving_unit);
}

export function remainingQuantityForItem(status: MealDiaryPlannedItemStatus) {
  const plannedUnits = plannedPortionCount({ quantity_units: status.planned_units });
  const remaining = Math.max(0, plannedUnits - status.consumed_units);
  return {
    quantity_g: status.planned_g,
    quantity_units: Math.round(remaining * 1000) / 1000,
  };
}

