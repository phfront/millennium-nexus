'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, ArrowLeftRight } from 'lucide-react';
import { Button, Input } from '@phfront/millennium-ui';
import { FoodSearch } from '@/components/health/features/food-manager/food-search';
import {
  buildPlannedItemFromFood,
  buildSubstitutionFromFood,
  createMealId,
  defaultQuantityForFood,
  formatPortionCount,
  formatPortionWithQuantity,
  gramsPerPortion,
  macrosFromFood,
  parsePortionCountInput,
  plannedDailyKcal,
  plannedKcalForMeal,
  plannedPortionCount,
  totalPlannedItems,
} from '@/lib/habits-goals/meal-diary';
import type { MealDiaryPlannedItem, MealDiaryPlannedMeal, MealDiarySourceConfig } from '@/types/meal-diary';
import type { Food } from '@/types/nutrition';

type MealDiaryGoalConfigProps = {
  config: MealDiarySourceConfig;
  onChange: (config: MealDiarySourceConfig) => void;
};

function PortionQuantityInput({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
  onChange: (quantity_units: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    setDraft(null);
  }, [value]);

  function handleChange(raw: string) {
    setDraft(raw);
    const parsed = parsePortionCountInput(raw);
    if (parsed != null) onChange(parsed);
  }

  function handleBlur() {
    const parsed = parsePortionCountInput(draft ?? formatPortionCount(value));
    if (parsed != null) onChange(parsed);
    setDraft(null);
  }

  return (
    <>
      <Input
        type="text"
        inputMode="decimal"
        aria-label={`Qtd. ${label}`}
        className="w-[4.75rem] shrink-0"
        value={draft ?? formatPortionCount(value)}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
      />
      <span className="w-8 shrink-0 text-[10px] text-text-muted">Qtd.</span>
    </>
  );
}

function PlannedItemRow({
  item,
  onPortionsChange,
  onSubstitutionPortionsChange,
  onAddSubstitution,
  onRemoveSubstitution,
  onRemove,
}: {
  item: MealDiaryPlannedItem;
  onPortionsChange: (quantity_units: number) => void;
  onSubstitutionPortionsChange: (substitutionId: string, quantity_units: number) => void;
  onAddSubstitution: (food: Food) => void;
  onRemoveSubstitution: (substitutionId: string) => void;
  onRemove: () => void;
}) {
  const portions = plannedPortionCount(item);
  const gramsPer = gramsPerPortion(item);
  const itemKcal = Math.round(macrosFromFood(item, gramsPer, portions).kcal);
  const [addingSub, setAddingSub] = useState(false);
  const subs = item.substitutions ?? [];

  return (
    <div className="space-y-1 rounded-lg bg-white/[0.03] px-2 py-1.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-text-primary">{item.food_name}</p>
          <p className="text-[10px] tabular-nums text-text-muted">
            {itemKcal} kcal · {formatPortionWithQuantity(item)} cada
            {subs.length > 0 ? ` · ${subs.length} subst.` : ''}
          </p>
        </div>
        <PortionQuantityInput
          value={portions}
          label={item.food_name}
          onChange={onPortionsChange}
        />
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded p-1 text-text-muted hover:text-red-400"
          aria-label="Remover alimento"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {subs.map((sub) => {
        const subPortions = plannedPortionCount(sub);
        const subKcal = Math.round(
          macrosFromFood(sub, gramsPerPortion(sub), subPortions).kcal,
        );
        return (
          <div
            key={sub.id}
            className="ml-3 flex items-center gap-2 border-l border-emerald-400/20 pl-2"
          >
            <ArrowLeftRight size={10} className="shrink-0 text-text-muted" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] text-text-secondary">{sub.food_name}</p>
              <p className="text-[10px] tabular-nums text-text-muted">
                {subKcal} kcal · {formatPortionWithQuantity(sub)} cada
              </p>
            </div>
            <PortionQuantityInput
              value={subPortions}
              label={sub.food_name}
              onChange={(quantity_units) => onSubstitutionPortionsChange(sub.id, quantity_units)}
            />
            <button
              type="button"
              onClick={() => onRemoveSubstitution(sub.id)}
              className="shrink-0 rounded p-1 text-text-muted hover:text-red-400"
              aria-label={`Remover substituto ${sub.food_name}`}
            >
              <Trash2 size={11} />
            </button>
          </div>
        );
      })}

      {addingSub ? (
        <div className="ml-3 space-y-2 border-l border-emerald-400/20 pl-2 pt-1">
          <FoodSearch
            onSelect={(food) => {
              onAddSubstitution(food);
              setAddingSub(false);
            }}
            placeholder="Buscar substituto..."
          />
          <Button type="button" size="sm" variant="ghost" onClick={() => setAddingSub(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddingSub(true)}
          className="ml-3 text-[10px] font-medium text-emerald-300/90 hover:text-emerald-200"
        >
          + substituição
        </button>
      )}
    </div>
  );
}

export function MealDiaryGoalConfig({ config, onChange }: MealDiaryGoalConfigProps) {
  const [expandedMealId, setExpandedMealId] = useState<string | null>(config.meals[0]?.id ?? null);
  const [addingFoodMealId, setAddingFoodMealId] = useState<string | null>(null);

  const plannedKcal = useMemo(() => plannedDailyKcal(config), [config]);
  const plannedItems = useMemo(() => totalPlannedItems(config), [config]);

  function updateMeals(meals: MealDiaryPlannedMeal[]) {
    onChange({ ...config, meals: meals.map((m, i) => ({ ...m, sort_order: i })) });
  }

  function addMeal() {
    const meal: MealDiaryPlannedMeal = {
      id: createMealId(),
      label: `Refeição ${config.meals.length + 1}`,
      sort_order: config.meals.length,
      items: [],
    };
    updateMeals([...config.meals, meal]);
    setExpandedMealId(meal.id);
  }

  function removeMeal(mealId: string) {
    updateMeals(config.meals.filter((m) => m.id !== mealId));
    if (addingFoodMealId === mealId) setAddingFoodMealId(null);
  }

  function updateMealLabel(mealId: string, label: string) {
    updateMeals(config.meals.map((m) => (m.id === mealId ? { ...m, label } : m)));
  }

  function addFoodToMeal(mealId: string, food: Food) {
    const defaults = defaultQuantityForFood(food);
    updateMeals(
      config.meals.map((m) =>
        m.id === mealId
          ? {
              ...m,
              items: [...m.items, buildPlannedItemFromFood(food, defaults.quantity_g, defaults.quantity_units)],
            }
          : m,
      ),
    );
    setAddingFoodMealId(null);
  }

  function updateItemPortions(mealId: string, itemId: string, quantity_units: number) {
    updateMeals(
      config.meals.map((m) =>
        m.id === mealId
          ? {
              ...m,
              items: m.items.map((i) => (i.id === itemId ? { ...i, quantity_units } : i)),
            }
          : m,
      ),
    );
  }

  function addSubstitution(mealId: string, itemId: string, food: Food) {
    const defaults = defaultQuantityForFood(food);
    const parentItem = config.meals.flatMap((m) => m.items).find((i) => i.id === itemId);
    const initialUnits = parentItem ? plannedPortionCount(parentItem) : defaults.quantity_units;
    const sub = buildSubstitutionFromFood(food, defaults.quantity_g, initialUnits);
    updateMeals(
      config.meals.map((m) =>
        m.id === mealId
          ? {
              ...m,
              items: m.items.map((i) =>
                i.id === itemId
                  ? { ...i, substitutions: [...(i.substitutions ?? []), sub] }
                  : i,
              ),
            }
          : m,
      ),
    );
  }

  function updateSubstitutionPortions(
    mealId: string,
    itemId: string,
    substitutionId: string,
    quantity_units: number,
  ) {
    updateMeals(
      config.meals.map((m) =>
        m.id === mealId
          ? {
              ...m,
              items: m.items.map((i) =>
                i.id === itemId
                  ? {
                      ...i,
                      substitutions: (i.substitutions ?? []).map((s) =>
                        s.id === substitutionId ? { ...s, quantity_units } : s,
                      ),
                    }
                  : i,
              ),
            }
          : m,
      ),
    );
  }

  function removeSubstitution(mealId: string, itemId: string, substitutionId: string) {
    updateMeals(
      config.meals.map((m) =>
        m.id === mealId
          ? {
              ...m,
              items: m.items.map((i) =>
                i.id === itemId
                  ? { ...i, substitutions: (i.substitutions ?? []).filter((s) => s.id !== substitutionId) }
                  : i,
              ),
            }
          : m,
      ),
    );
  }

  function removeItem(mealId: string, itemId: string) {
    updateMeals(
      config.meals.map((m) =>
        m.id === mealId ? { ...m, items: m.items.filter((i) => i.id !== itemId) } : m,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-2/50 p-4">
      <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 px-3 py-2.5">
        <p className="text-xs font-medium text-emerald-200/90">Meta diária (calculada)</p>
        <p className="mt-0.5 text-sm tabular-nums text-text-primary">
          {plannedKcal.toLocaleString('pt-BR')} kcal · {plannedItems} itens no plano
        </p>
        <p className="mt-1 text-[11px] text-text-muted">
          Qtd. aceita decimais (ex.: 0,1 ou 1,25). Substitutos contam para o mesmo item do plano.
        </p>
      </div>

      <Input
        label="Calorias livres na semana"
        type="number"
        min={0}
        value={String(config.weekly_free_kcal)}
        onChange={(e) =>
          onChange({
            ...config,
            weekly_free_kcal: Math.max(0, Math.round(Number(e.target.value) || 0)),
          })
        }
        placeholder="Ex: 1500"
      />
      <p className="-mt-2 text-xs text-text-muted">
        Orçamento semanal para refeições extras fora do plano. O card mostra quanto já foi usado na semana.
      </p>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-text-primary">Plano do dia</p>
          <Button type="button" size="sm" variant="secondary" leftIcon={<Plus size={14} />} onClick={addMeal}>
            Refeição
          </Button>
        </div>

        {config.meals.map((meal) => {
          const expanded = expandedMealId === meal.id;
          const mealKcal = plannedKcalForMeal(meal);
          return (
            <div key={meal.id} className="rounded-lg border border-white/10 bg-black/20">
              <div className="flex items-center gap-2 p-2.5">
                <button
                  type="button"
                  className="shrink-0 rounded p-1 text-text-muted hover:bg-white/5"
                  onClick={() => setExpandedMealId(expanded ? null : meal.id)}
                  aria-label={expanded ? 'Recolher' : 'Expandir'}
                >
                  {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <Input
                  value={meal.label}
                  onChange={(e) => updateMealLabel(meal.id, e.target.value)}
                  aria-label="Nome da refeição"
                />
                <span className="shrink-0 text-[10px] tabular-nums text-text-muted">
                  {meal.items.length} · {mealKcal} kcal
                </span>
                <button
                  type="button"
                  disabled={config.meals.length <= 1}
                  onClick={() => removeMeal(meal.id)}
                  className="shrink-0 rounded p-1.5 text-text-muted hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
                  aria-label="Remover refeição"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {expanded && (
                <div className="space-y-2 border-t border-white/8 px-2.5 pb-2.5 pt-2">
                  {meal.items.map((item) => (
                    <PlannedItemRow
                      key={item.id}
                      item={item}
                      onPortionsChange={(quantity_units) =>
                        updateItemPortions(meal.id, item.id, quantity_units)
                      }
                      onSubstitutionPortionsChange={(subId, quantity_units) =>
                        updateSubstitutionPortions(meal.id, item.id, subId, quantity_units)
                      }
                      onAddSubstitution={(food) => addSubstitution(meal.id, item.id, food)}
                      onRemoveSubstitution={(subId) => removeSubstitution(meal.id, item.id, subId)}
                      onRemove={() => removeItem(meal.id, item.id)}
                    />
                  ))}

                  {addingFoodMealId === meal.id ? (
                    <div className="space-y-2 rounded-lg border border-emerald-400/25 bg-emerald-500/5 p-2">
                      <FoodSearch
                        onSelect={(food) => addFoodToMeal(meal.id, food)}
                        placeholder="Buscar alimento..."
                      />
                      <Button type="button" size="sm" variant="ghost" onClick={() => setAddingFoodMealId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      leftIcon={<Plus size={14} />}
                      onClick={() => setAddingFoodMealId(meal.id)}
                    >
                      Adicionar alimento
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
