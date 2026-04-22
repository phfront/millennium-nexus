import type {
  Food,
  DietLog,
  MacroValues,
  DailyTotals,
  DietPlanMealWithItems,
} from '@/types/nutrition';

/** Nomes de alimento válidos num slot do plano (principal + substituições). */
export function planSlotAllowedFoodNames(
  item: DietPlanMealWithItems['items'][number],
): Set<string> {
  const names = new Set<string>();
  if (item.food?.name) names.add(item.food.name);
  for (const sub of item.substitutions ?? []) {
    const n = sub.substitute_food?.name;
    if (n) names.add(n);
  }
  return names;
}

/**
 * Indica se o log conta para o resumo quando se filtra pelo plano ativo.
 * Extras contam sempre; demais só se baterem num slot (refeição + nome do alimento).
 */
export function dietLogMatchesActivePlan(
  log: DietLog,
  meals: DietPlanMealWithItems[],
): boolean {
  if (log.is_extra) return true;
  const meal = meals.find((m) => m.name === log.meal_name);
  if (!meal) return false;
  return meal.items.some((item) => planSlotAllowedFoodNames(item).has(log.food_name));
}

/**
 * Calcula macros proporcionais à quantidade em gramas.
 */
export function calcMacros(food: Food, quantityG: number): MacroValues {
  const factor = quantityG / 100;
  return {
    kcal: Math.round(food.kcal_per_100g * factor * 100) / 100,
    protein: Math.round(food.protein_per_100g * factor * 100) / 100,
    carbs: Math.round(food.carbs_per_100g * factor * 100) / 100,
    fat: Math.round(food.fat_per_100g * factor * 100) / 100,
  };
}

/** kcal por “escolha” do item: alimento principal ou cada substituição (cada opção exclui as outras). */
function itemSlotKcalOptions(item: DietPlanMealWithItems['items'][number]): number[] {
  if (!item.food) return [0];
  const macros = calcMacros(item.food, item.quantity_g);
  const units = item.quantity_units ?? 1;
  const main = Math.round(macros.kcal * units);
  const subs = item.substitutions ?? [];
  const fromSubs = subs
    .filter((s): s is typeof s & { substitute_food: Food } => Boolean(s.substitute_food))
    .map((s) => {
      const m = calcMacros(s.substitute_food, s.substitute_quantity_g);
      const u = s.substitute_quantity_units ?? 1;
      return Math.round(m.kcal * u);
    });
  return [main, ...fromSubs];
}

/** Soma mínima e máxima de kcal do plano, assumindo em cada item a opção com menos ou mais kcal entre principal e substituições. */
export function sumPlannedKcalRangeFromMeals(meals: DietPlanMealWithItems[]): { min: number; max: number } {
  let minSum = 0;
  let maxSum = 0;
  for (const meal of meals) {
    for (const item of meal.items) {
      const opts = itemSlotKcalOptions(item);
      minSum += Math.min(...opts);
      maxSum += Math.max(...opts);
    }
  }
  return { min: minSum, max: maxSum };
}

/** Soma kcal planejadas do plano ativo (mesma lógica que o builder da dieta). */
export function sumPlannedKcalFromMeals(meals: DietPlanMealWithItems[]): number {
  let kcal = 0;
  for (const meal of meals) {
    for (const item of meal.items) {
      if (!item.food) continue;
      const macros = calcMacros(item.food, item.quantity_g);
      const units = item.quantity_units ?? 1;
      kcal += macros.kcal * units;
    }
  }
  return Math.round(kcal * 100) / 100;
}

/**
 * Totaliza macros de uma lista de logs de dieta.
 * Com `planMeals` não vazio, ignora logs órfãos (removidos do plano mas ainda na BD).
 */
export function calcDailyTotals(
  logs: DietLog[],
  date: string,
  planMeals?: DietPlanMealWithItems[],
): DailyTotals {
  let dayLogs = logs.filter((l) => l.logged_date === date);
  if (planMeals && planMeals.length > 0) {
    dayLogs = dayLogs.filter((l) => dietLogMatchesActivePlan(l, planMeals));
  }
  const totals: DailyTotals = {
    logged_date: date,
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    items_count: dayLogs.length,
    extra_kcal: 0,
  };

  for (const log of dayLogs) {
    totals.kcal += log.kcal;
    totals.protein += log.protein;
    totals.carbs += log.carbs;
    totals.fat += log.fat;
    if (log.is_extra) {
      totals.extra_kcal += log.kcal;
    }
  }

  return totals;
}

/**
 * Calcula percentual de aderência à dieta.
 * planned = kcal totais planejadas, consumed = kcal de logs não-extras.
 */
export function calcAdherencePercent(planned: number, consumed: number): number {
  if (planned <= 0) return 0;
  const ratio = consumed / planned;
  // Aderência = 100% quando consumiu exatamente o planejado
  // Abaixo ou acima diminui a aderência
  const deviation = Math.abs(1 - ratio);
  return Math.max(0, Math.round((1 - deviation) * 100));
}

/**
 * Calcula progresso de hidratação percentual.
 */
export function calcWaterProgress(totalMl: number, targetMl: number): number {
  if (targetMl <= 0) return 0;
  return Math.min(100, Math.round((totalMl / targetMl) * 100));
}

/**
 * Formata data como string ISO (YYYY-MM-DD).
 */
export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Retorna a data de hoje como YYYY-MM-DD.
 */
export function todayISO(): string {
  return formatDateISO(new Date());
}

/**
 * Semana civil local (segunda a domingo) em `YYYY-MM-DD`, usada no buffer de extras.
 * Nova semana = segunda-feira; o consumido do buffer só conta logs com `is_extra` nesta faixa.
 */
export function getCalendarWeekBoundsISO(reference: Date = new Date()): { monday: string; sunday: string } {
  const dayOfWeek = reference.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(reference);
  monday.setDate(reference.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday: formatDateISO(monday), sunday: formatDateISO(sunday) };
}

/**
 * Soma kcal de consumo **extra** (`is_extra`) na semana corrente (segunda a domingo, hora local).
 */
export function calcWeeklyBufferUsed(logs: DietLog[], reference: Date = new Date()): number {
  const { monday, sunday } = getCalendarWeekBoundsISO(reference);
  return logs
    .filter((l) => l.is_extra && l.logged_date >= monday && l.logged_date <= sunday)
    .reduce((sum, l) => sum + l.kcal, 0);
}

/**
 * Formata um número de kcal para exibição (ex: "1.245").
 */
export function formatKcal(value: number): string {
  return Math.round(value).toLocaleString('pt-BR');
}

/**
 * Formata gramas para exibição (ex: "150g").
 */
export function formatGrams(value: number): string {
  return `${Math.round(value)}g`;
}

/**
 * Formata quantidade com unidade dinâmica (ex: "150g" ou "200ml").
 */
export function formatQuantity(value: number, unit: string = 'g'): string {
  return `${Math.round(value)}${unit}`;
}

/**
 * Formata mililitros para exibição (ex: "2.500 ml").
 */
export function formatMl(value: number): string {
  return `${value.toLocaleString('pt-BR')} ml`;
}
