'use client';

import { useMemo, useState } from 'react';
import { ArrowRightLeft, Check, CheckCircle2, ChevronDown, Hash, RotateCcw, Undo2 } from 'lucide-react';
import { Button, Input, Modal } from '@phfront/millennium-ui';
import { FoodSearch } from '@/components/health/features/food-manager/food-search';
import { MealDiaryPlateReactor } from '@/components/habits-goals/features/tracker-card/meal-diary-plate-reactor';
import {
  createLogEntryId,
  createMealId,
  formatItemQuantity,
  formatPortionCount,
  formatPortionWithQuantity,
  formatPortionSize,
  gramsPerPortion,
  isMealDiaryGoalMet,
  itemConsumptionOptions,
  macrosFromFood,
  mealDiaryLogValue,
  mealDiaryProgressPct,
  parseMealDiaryConfig,
  parseMealDiaryLogNote,
  parsePortionCountInput,
  plannedDailyKcal,
  plannedItemStatuses,
  plannedKcalForMeal,
  remainingQuantityForItem,
  serializeMealDiaryLog,
  sumLogMacros,
  weeklyExtraKcalUsed,
  plannedPortionCount,
} from '@/lib/habits-goals/meal-diary';
import type {
  MealDiaryConsumptionOption,
  MealDiaryLogEntry,
  MealDiaryLogNote,
  MealDiaryPlannedItem,
  MealDiaryPlannedItemStatus,
  MealDiaryPlannedMeal,
} from '@/types/meal-diary';
import type { Food } from '@/types/nutrition';
import type { Tracker } from '@/types/habits-goals';

type TrackerMealDiaryDashboardControlProps = {
  tracker: Tracker;
  note: string | null | undefined;
  weekLogs?: { note?: string | null }[];
  readonly?: boolean;
  onSaveNote: (note: string, value: number) => void;
};

type PlannedLogModalState = {
  kind: 'planned';
  mealId: string;
  mealLabel: string;
  plannedItem: MealDiaryPlannedItem;
  plannedItemId: string;
  options: MealDiaryConsumptionOption[];
  selectedOption: MealDiaryConsumptionOption;
};

type ExtraLogModalState = {
  kind: 'extra';
  mealId: string;
  mealLabel: string;
  item: MealDiaryPlannedItem;
  plannedItemId: null;
};

type LogModalState = PlannedLogModalState | ExtraLogModalState | null;
type ListTab = 'pending' | 'consumed';

const actionBtnClass =
  'flex h-9 min-w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 text-emerald-100/80 transition-colors hover:border-emerald-400/18 hover:bg-emerald-500/[0.08] disabled:opacity-35';

function loggedFoodLabel(status: MealDiaryPlannedItemStatus, entries: MealDiaryLogEntry[]): string {
  const related = entries.filter(
    (e) => e.planned_item_id === status.item.id && !e.is_extra_meal,
  );
  if (related.length === 0) return status.item.food_name;
  return [...new Set(related.map((e) => e.food_name))].join(' · ');
}

function consumedQuantityLabel(status: MealDiaryPlannedItemStatus): string {
  return formatItemQuantity({
    quantity_g: status.planned_g,
    quantity_units: status.consumed_units,
    serving_unit: status.item.serving_unit,
  });
}

export function TrackerMealDiaryDashboardControl({
  tracker,
  note,
  weekLogs = [],
  readonly = false,
  onSaveNote,
}: TrackerMealDiaryDashboardControlProps) {
  const config = parseMealDiaryConfig(tracker.source_config);
  const logNote = parseMealDiaryLogNote(note);
  const plannedKcal = plannedDailyKcal(config);
  const macros = sumLogMacros(logNote.entries);
  const statuses = plannedItemStatuses(config, logNote.entries);
  const progress = mealDiaryProgressPct(config, logNote.entries);
  const goalMet = isMealDiaryGoalMet(config, logNote.entries);
  const completedItems = statuses.filter((s) => s.complete).length;
  const totalItems = statuses.length;
  const weeklyFreeBudget = config.weekly_free_kcal;
  const weeklyFreeUsed = weeklyExtraKcalUsed(weekLogs);
  const weeklyFreeRemaining = Math.max(0, weeklyFreeBudget - weeklyFreeUsed);
  const weeklyFreeOver = weeklyFreeBudget > 0 && weeklyFreeUsed > weeklyFreeBudget;

  const [listTab, setListTab] = useState<ListTab>('pending');
  const [logModal, setLogModal] = useState<LogModalState>(null);
  const [extraPickMealId, setExtraPickMealId] = useState<string | null>(null);
  const [qtyPortions, setQtyPortions] = useState('1');
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(
    () => new Set(config.meals.map((m) => m.id)),
  );

  const pendingStatuses = useMemo(() => statuses.filter((s) => !s.complete), [statuses]);
  const consumedStatuses = useMemo(() => statuses.filter((s) => s.complete), [statuses]);

  const mealBands = useMemo(
    () =>
      config.meals.map((meal) => {
        const mealStatuses = statuses.filter((s) => s.meal_id === meal.id);
        const ratio =
          mealStatuses.length > 0
            ? mealStatuses.reduce((sum, s) => sum + s.ratio, 0) / mealStatuses.length
            : 0;
        return { label: meal.label, ratio };
      }),
    [config.meals, statuses],
  );

  function persist(next: MealDiaryLogNote) {
    onSaveNote(serializeMealDiaryLog(next), mealDiaryLogValue(config, next.entries));
  }

  function appendPlannedEntry(
    mealId: string,
    mealLabel: string,
    plannedItemId: string,
    option: MealDiaryConsumptionOption,
    portions: number,
  ) {
    const gramsPer = gramsPerPortion(option);
    const macro = macrosFromFood(option, gramsPer, portions);
    addEntry({
      id: createLogEntryId(),
      meal_id: mealId,
      meal_label: mealLabel,
      planned_item_id: plannedItemId,
      substitution_id: option.substitution_id,
      food_id: option.food_id,
      food_name: option.food_name,
      quantity_g: gramsPer,
      quantity_units: portions,
      ...macro,
      logged_at: new Date().toISOString(),
      is_extra_meal: false,
    });
  }

  function addEntry(entry: MealDiaryLogEntry) {
    persist({ ...logNote, entries: [...logNote.entries, entry] });
  }

  function openQtyModal(
    mealId: string,
    mealLabel: string,
    item: MealDiaryPlannedItem,
    plannedItemId: string,
  ) {
    const status = statuses.find((s) => s.item.id === plannedItemId);
    const remaining = status
      ? remainingQuantityForItem(status)
      : { quantity_g: item.quantity_g, quantity_units: item.quantity_units };
    const options = itemConsumptionOptions(item);
    setQtyPortions(formatPortionCount(remaining.quantity_units || plannedPortionCount(item)));
    setLogModal({
      kind: 'planned',
      mealId,
      mealLabel,
      plannedItem: item,
      plannedItemId,
      options,
      selectedOption: options[0],
    });
  }

  function markItemComplete(
    mealId: string,
    mealLabel: string,
    item: MealDiaryPlannedItem,
    plannedItemId: string,
  ) {
    if ((item.substitutions?.length ?? 0) > 0) {
      openQtyModal(mealId, mealLabel, item, plannedItemId);
      return;
    }

    const status = statuses.find((s) => s.item.id === plannedItemId);
    if (!status) return;
    const remaining = remainingQuantityForItem(status);
    if (remaining.quantity_units <= 0) return;
    appendPlannedEntry(
      mealId,
      mealLabel,
      plannedItemId,
      itemConsumptionOptions(item)[0],
      remaining.quantity_units,
    );
  }

  function handleLogSave() {
    if (!logModal) return;
    const portions = parsePortionCountInput(qtyPortions);
    if (!portions) return;

    if (logModal.kind === 'extra') {
      const gramsPer = gramsPerPortion(logModal.item);
      const macro = macrosFromFood(logModal.item, gramsPer, portions);
      addEntry({
        id: createLogEntryId(),
        meal_id: logModal.mealId,
        meal_label: logModal.mealLabel,
        planned_item_id: null,
        substitution_id: null,
        food_id: logModal.item.food_id,
        food_name: logModal.item.food_name,
        quantity_g: gramsPer,
        quantity_units: portions,
        ...macro,
        logged_at: new Date().toISOString(),
        is_extra_meal: true,
      });
    } else {
      appendPlannedEntry(
        logModal.mealId,
        logModal.mealLabel,
        logModal.plannedItemId,
        logModal.selectedOption,
        portions,
      );
    }

    setLogModal(null);
    setExtraPickMealId(null);
  }

  function addExtraMeal() {
    const label = `Extra ${logNote.extra_meals.length + 1}`;
    const id = createMealId();
    persist({
      ...logNote,
      extra_meals: [...logNote.extra_meals, { id, label }],
    });
    setExtraPickMealId(id);
  }

  function handleExtraFoodSelect(food: Food) {
    if (!extraPickMealId) return;
    const extra = logNote.extra_meals.find((m) => m.id === extraPickMealId);
    if (!extra) return;

    const item: MealDiaryPlannedItem = {
      id: food.id,
      food_id: food.id,
      food_name: food.name,
      quantity_g: 100,
      quantity_units: 1,
      serving_unit: food.serving_unit ?? 'g',
      kcal_per_100g: food.kcal_per_100g,
      protein_per_100g: food.protein_per_100g,
      carbs_per_100g: food.carbs_per_100g,
      fat_per_100g: food.fat_per_100g,
      substitutions: [],
    };

    setQtyPortions('1');
    setLogModal({
      kind: 'extra',
      mealId: extra.id,
      mealLabel: extra.label,
      item,
      plannedItemId: null,
    });
  }

  function markMealComplete(
    mealId: string,
    mealLabel: string,
    pendingInMeal: MealDiaryPlannedItemStatus[],
  ) {
    const newEntries = [...logNote.entries];
    for (const status of pendingInMeal) {
      const remaining = remainingQuantityForItem(status);
      if (remaining.quantity_units <= 0) continue;
      const option = itemConsumptionOptions(status.item)[0];
      const gramsPer = gramsPerPortion(option);
      const portions = remaining.quantity_units;
      const macro = macrosFromFood(option, gramsPer, portions);
      newEntries.push({
        id: createLogEntryId(),
        meal_id: mealId,
        meal_label: mealLabel,
        planned_item_id: status.item.id,
        substitution_id: option.substitution_id,
        food_id: option.food_id,
        food_name: option.food_name,
        quantity_g: gramsPer,
        quantity_units: portions,
        ...macro,
        logged_at: new Date().toISOString(),
        is_extra_meal: false,
      });
    }
    if (newEntries.length === logNote.entries.length) return;
    persist({ ...logNote, entries: newEntries });
  }

  function revertPlannedItem(plannedItemId: string) {
    const nextEntries = logNote.entries.filter(
      (e) => e.is_extra_meal || e.planned_item_id !== plannedItemId,
    );
    if (nextEntries.length === logNote.entries.length) return;
    persist({ ...logNote, entries: nextEntries });
  }

  function undoLast() {
    if (logNote.entries.length === 0) return;
    persist({ ...logNote, entries: logNote.entries.slice(0, -1) });
  }

  function toggleMeal(mealId: string) {
    setExpandedMeals((prev) => {
      const next = new Set(prev);
      if (next.has(mealId)) next.delete(mealId);
      else next.add(mealId);
      return next;
    });
  }

  const extraMealForPick = extraPickMealId
    ? logNote.extra_meals.find((m) => m.id === extraPickMealId)
    : null;

  const activeStatuses = listTab === 'pending' ? pendingStatuses : consumedStatuses;

  function renderMealHeader(
    meal: MealDiaryPlannedMeal,
    mealStatuses: MealDiaryPlannedItemStatus[],
    variant: 'pending' | 'consumed',
  ) {
    const expanded = expandedMeals.has(meal.id);
    const mealKcal = plannedKcalForMeal(meal);
    const allInMeal = statuses.filter((s) => s.meal_id === meal.id);
    const doneCount = allInMeal.filter((s) => s.complete).length;
    const totalCount = allInMeal.length;
    const mealDone = totalCount > 0 && doneCount === totalCount;

    return (
      <div className="flex items-stretch gap-2 border-b border-white/[0.05] bg-white/[0.015] px-2.5 py-2.5">
        <button
          type="button"
          onClick={() => toggleMeal(meal.id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <div
            className={[
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums',
              mealDone
                ? 'bg-emerald-400/14 text-emerald-100/85'
                : 'bg-white/[0.06] text-emerald-100/75',
            ].join(' ')}
          >
            {mealDone ? '✓' : `${doneCount}/${totalCount}`}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-emerald-50/95">{meal.label}</p>
            <p className="text-[10px] tabular-nums text-emerald-100/55">
              {mealKcal.toLocaleString('pt-BR')} kcal
              {variant === 'pending'
                ? ` · ${mealStatuses.length} pendente${mealStatuses.length !== 1 ? 's' : ''}`
                : ` · ${mealStatuses.length} consumido${mealStatuses.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <ChevronDown
            size={16}
            className={[
              'shrink-0 text-emerald-100/45 transition-transform',
              expanded ? 'rotate-180' : '',
            ].join(' ')}
            aria-hidden
          />
        </button>
        {variant === 'pending' && !readonly && mealStatuses.length > 0 && (
          <button
            type="button"
            onClick={() => markMealComplete(meal.id, meal.label, mealStatuses)}
            className="shrink-0 self-center rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100/80 transition-colors hover:border-emerald-400/18 hover:bg-emerald-500/[0.08]"
          >
            Concluir
          </button>
        )}
      </div>
    );
  }

  function renderPendingRow(
    status: MealDiaryPlannedItemStatus,
    mealId: string,
    mealLabel: string,
  ) {
    const { item } = status;
    const remaining = remainingQuantityForItem(status);
    const hasSubstitutions = (item.substitutions?.length ?? 0) > 0;

    return (
      <div
        key={item.id}
        className="flex items-center gap-2 rounded-lg border border-white/[0.035] bg-white/[0.015] px-2.5 py-2"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-text-primary">{item.food_name}</p>
          <p className="text-[10px] tabular-nums text-text-muted">
            {status.partial
              ? `Faltam ${formatItemQuantity(remaining)}`
              : formatItemQuantity(item)}
            {(item.substitutions?.length ?? 0) > 0
              ? ` · ${item.substitutions!.length} subst.`
              : ''}
            {status.partial ? ` · ${Math.round(status.ratio * 100)}%` : ''}
          </p>
        </div>
        {!readonly && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className={[actionBtnClass, hasSubstitutions ? 'order-3' : 'order-1'].join(' ')}
              aria-label={`Informar quantidade · ${item.food_name}`}
              onClick={() => openQtyModal(mealId, mealLabel, item, item.id)}
            >
              <Hash size={14} />
            </button>
            {hasSubstitutions && (
              <button
                type="button"
                className={[actionBtnClass, 'order-2'].join(' ')}
                aria-label={`Marcar item principal Â· ${item.food_name}`}
                title="Usar item principal"
                onClick={() =>
                  appendPlannedEntry(
                    mealId,
                    mealLabel,
                    item.id,
                    itemConsumptionOptions(item)[0],
                    remaining.quantity_units,
                  )
                }
              >
                <CheckCircle2 size={14} />
              </button>
            )}
            <button
              type="button"
              className={[actionBtnClass, hasSubstitutions ? 'order-1' : 'order-2'].join(' ')}
              aria-label={
                hasSubstitutions
                  ? `Escolher alimento consumido · ${item.food_name}`
                  : `Marcar total · ${item.food_name}`
              }
              onClick={() => markItemComplete(mealId, mealLabel, item, item.id)}
            >
              {hasSubstitutions ? (
                <ArrowRightLeft size={14} />
              ) : (
                <CheckCircle2 size={14} />
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderConsumedRow(status: MealDiaryPlannedItemStatus) {
    const { item } = status;
    const label = loggedFoodLabel(status, logNote.entries);

    return (
      <div
        key={item.id}
        className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5"
      >
        <Check size={14} className="shrink-0 text-emerald-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-text-secondary">{label}</p>
          <p className="text-[10px] tabular-nums text-text-muted">
            {consumedQuantityLabel(status)}
            {label !== item.food_name ? ` · plano: ${item.food_name}` : ''}
          </p>
        </div>
        {!readonly && (
          <button
            type="button"
            className={actionBtnClass}
            aria-label={`Voltar para pendentes · ${item.food_name}`}
            title="Voltar para pendentes"
            onClick={() => revertPlannedItem(item.id)}
          >
            <Undo2 size={13} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        <div className="relative w-[3.25rem] shrink-0 self-stretch overflow-visible">
          <MealDiaryPlateReactor fillPct={progress} goalMet={goalMet} mealBands={mealBands} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <div className="space-y-1">
            <div className="flex items-end justify-between gap-2">
              <p className="text-[1.65rem] font-bold leading-none tabular-nums tracking-tight text-text-primary sm:text-[1.75rem]">
                {Math.round(macros.kcal).toLocaleString('pt-BR')}
                {plannedKcal > 0 && (
                  <span className="text-sm font-semibold text-text-muted">
                    {' '}
                    / {plannedKcal.toLocaleString('pt-BR')}
                  </span>
                )}
                <span className="ml-1 text-xs font-medium text-text-muted">kcal</span>
              </p>
              <span className="shrink-0 text-xs font-bold tabular-nums text-emerald-300/90">{progress}%</span>
            </div>
            <p className="text-[11px] leading-snug text-text-muted">
              {goalMet ? (
                <span className="font-semibold text-emerald-300">Plano do dia completo</span>
              ) : (
                <>
                  Itens {completedItems}/{totalItems}
                  {plannedKcal > 0 && (
                    <>
                      {' '}
                      · plano {plannedKcal.toLocaleString('pt-BR')} kcal
                    </>
                  )}
                </>
              )}
            </p>
            {weeklyFreeBudget > 0 && (
              <p
                className={[
                  'text-[10px] tabular-nums',
                  weeklyFreeOver ? 'text-amber-300' : 'text-text-muted',
                ].join(' ')}
              >
                Calorias livres (semana): {weeklyFreeUsed.toLocaleString('pt-BR')}/
                {weeklyFreeBudget.toLocaleString('pt-BR')} kcal
                {weeklyFreeOver
                  ? ` · ${(weeklyFreeUsed - weeklyFreeBudget).toLocaleString('pt-BR')} acima`
                  : weeklyFreeRemaining > 0
                    ? ` · ${weeklyFreeRemaining.toLocaleString('pt-BR')} restantes`
                    : ' · esgotadas'}
              </p>
            )}
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] tabular-nums text-text-muted">
                P {Math.round(macros.protein)}g · C {Math.round(macros.carbs)}g · G {Math.round(macros.fat)}g
              </p>
              {!readonly && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={addExtraMeal}
                    className="flex h-7 items-center rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2 text-[10px] font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20"
                  >
                    Extra
                  </button>
                  <button
                    type="button"
                    disabled={logNote.entries.length === 0}
                    onClick={undoLast}
                    className={actionBtnClass}
                    aria-label="Desfazer último"
                  >
                    <RotateCcw size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="h-1 min-w-0 overflow-hidden rounded-full bg-white/8">
            <div
              className={[
                'h-full rounded-full transition-all duration-500',
                goalMet
                  ? 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-lime-300'
                  : 'bg-gradient-to-r from-emerald-800 via-emerald-500 to-emerald-300',
              ].join(' ')}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl bg-black/25 p-0.5">
        <button
          type="button"
          onClick={() => setListTab('pending')}
          className={[
            'flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors',
            listTab === 'pending'
              ? 'bg-emerald-500/20 text-emerald-100'
              : 'text-text-muted hover:text-text-secondary',
          ].join(' ')}
        >
          Pendentes ({pendingStatuses.length})
        </button>
        <button
          type="button"
          onClick={() => setListTab('consumed')}
          className={[
            'flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors',
            listTab === 'consumed'
              ? 'bg-emerald-500/20 text-emerald-100'
              : 'text-text-muted hover:text-text-secondary',
          ].join(' ')}
        >
          Consumidos ({consumedStatuses.length})
        </button>
      </div>

      <div className="max-h-[14rem] space-y-1.5 overflow-y-auto pr-0.5">
        {listTab === 'pending' ? (
          config.meals.map((meal) => {
            const mealStatuses = activeStatuses.filter((s) => s.meal_id === meal.id);
            if (mealStatuses.length === 0) return null;

            return (
              <div
                key={meal.id}
                className="overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              >
                {renderMealHeader(meal, mealStatuses, 'pending')}

                {expandedMeals.has(meal.id) && (
                  <div className="space-y-1 px-2 pb-2 pt-1">
                    {mealStatuses.map((status) =>
                      renderPendingRow(status, meal.id, meal.label),
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <>
            {config.meals.map((meal) => {
              const mealStatuses = activeStatuses.filter((s) => s.meal_id === meal.id);
              if (mealStatuses.length === 0) return null;

              return (
                <div
                  key={meal.id}
                  className="overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                >
                  {renderMealHeader(meal, mealStatuses, 'consumed')}

                  {expandedMeals.has(meal.id) && (
                    <div className="space-y-1 px-2 pb-2 pt-1">
                      {mealStatuses.map((status) => renderConsumedRow(status))}
                    </div>
                  )}
                </div>
              );
            })}

            {logNote.extra_meals.map((extra) => {
              const extraEntries = logNote.entries.filter((e) => e.meal_id === extra.id);
              if (extraEntries.length === 0) return null;
              return (
                <div
                  key={extra.id}
                  className="rounded-xl border border-amber-400/20 bg-amber-500/5 px-2.5 py-2"
                >
                  <p className="text-xs font-semibold text-amber-200/90">{extra.label}</p>
                  <div className="mt-1 space-y-0.5">
                    {extraEntries.map((e) => (
                      <p key={e.id} className="text-[10px] text-text-muted">
                        {e.food_name} · {formatItemQuantity(e)}
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {listTab === 'pending' && pendingStatuses.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-text-muted">
            Nenhum item pendente — plano do dia completo.
          </p>
        )}

        {listTab === 'consumed' &&
          consumedStatuses.length === 0 &&
          logNote.entries.filter((e) => e.is_extra_meal).length === 0 && (
            <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-text-muted">
              Nenhum item consumido ainda hoje.
            </p>
          )}
      </div>

      <Modal
        isOpen={logModal?.kind === 'planned'}
        onClose={() => setLogModal(null)}
        title="Informar quantidade"
      >
        {logModal?.kind === 'planned' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-secondary">
              {logModal.plannedItem.food_name} · {logModal.mealLabel}
            </p>

            {logModal.options.length > 1 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-text-muted">O que você consumiu?</p>
                <div className="flex flex-wrap gap-1.5">
                  {logModal.options.map((option) => {
                    const selected = logModal.selectedOption.substitution_id === option.substitution_id;
                    return (
                      <button
                        key={option.substitution_id ?? 'main'}
                        type="button"
                        onClick={() => {
                          setQtyPortions(formatPortionCount(option.quantity_units));
                          setLogModal({ ...logModal, selectedOption: option });
                        }}
                        className={[
                          'rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition-colors',
                          selected
                            ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100'
                            : 'border-white/10 bg-black/20 text-text-secondary hover:border-emerald-400/30',
                        ].join(' ')}
                      >
                        <span className="font-medium">{option.option_label}</span>
                        <span className="ml-1 text-text-muted">· {formatPortionWithQuantity(option)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-xs text-text-muted">
              {formatPortionSize(logModal.selectedOption)} por porção
            </p>
            <Input
              label="Qtd."
              type="text"
              inputMode="decimal"
              value={qtyPortions}
              onChange={(e) => setQtyPortions(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setLogModal(null)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleLogSave} className="bg-emerald-500 text-white hover:bg-emerald-600">
                Registrar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={extraPickMealId != null && logModal == null}
        onClose={() => setExtraPickMealId(null)}
        title={extraMealForPick ? `Adicionar · ${extraMealForPick.label}` : 'Refeição extra'}
      >
        <FoodSearch onSelect={handleExtraFoodSelect} placeholder="Buscar alimento..." />
      </Modal>

      <Modal
        isOpen={logModal?.kind === 'extra'}
        onClose={() => {
          setLogModal(null);
          setExtraPickMealId(null);
        }}
        title={logModal?.kind === 'extra' ? `Quantidade · ${logModal.mealLabel}` : 'Extra'}
      >
        {logModal?.kind === 'extra' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-text-primary">{logModal.item.food_name}</p>
            <p className="text-xs text-text-muted">{formatPortionSize(logModal.item)} por porção</p>
            <Input
              label="Qtd."
              type="text"
              inputMode="decimal"
              value={qtyPortions}
              onChange={(e) => setQtyPortions(e.target.value)}
            />
            {weeklyFreeBudget > 0 && (
              <p
                className={[
                  'text-xs tabular-nums',
                  weeklyFreeUsed +
                    macrosFromFood(
                      logModal.item,
                      gramsPerPortion(logModal.item),
                      parsePortionCountInput(qtyPortions) ?? 0,
                    ).kcal >
                  weeklyFreeBudget
                    ? 'text-amber-300'
                    : 'text-text-muted',
                ].join(' ')}
              >
                Calorias livres após registro:{' '}
                {Math.max(
                  0,
                  weeklyFreeBudget -
                    weeklyFreeUsed -
                    macrosFromFood(
                      logModal.item,
                      gramsPerPortion(logModal.item),
                      parsePortionCountInput(qtyPortions) ?? 0,
                    ).kcal,
                ).toLocaleString('pt-BR')}{' '}
                kcal restantes na semana
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setLogModal(null);
                  setExtraPickMealId(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={handleLogSave} className="bg-emerald-500 text-white hover:bg-emerald-600">
                Registrar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
