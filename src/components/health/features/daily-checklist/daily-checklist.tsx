'use client';

import { useState } from 'react';
import { Check, Plus, Flame, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Accordion, Button, Skeleton, useToast } from '@phfront/millennium-ui';
import { useDietPlan } from '@/hooks/health/use-diet-plan';
import { useDietHistory } from '@/hooks/health/use-diet-history';
import type { Food, FoodSubstitution } from '@/types/nutrition';
import { useDietSettings } from '@/hooks/health/use-diet-settings';
import { calcMacros, formatKcal, formatGrams, formatQuantity, sumPlannedKcalFromMeals } from '@/lib/health/nutrition';
import { ExtraConsumptionModal } from './extra-consumption-modal';
import { WeeklyBufferBadge } from './weekly-buffer-badge';

export function DailyChecklist() {
  const { meals, isLoading: planLoading } = useDietPlan();
  const { settings } = useDietSettings();
  const {
    todayLogs, todayTotals, weeklyBufferUsed,
    isLoading: logsLoading,
    checkMealItem, uncheckLog, findPlanSlotLog,
  } = useDietHistory();
  const { toast } = useToast();

  const [showExtra, setShowExtra] = useState(false);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);

  const isLoading = planLoading || logsLoading;

  async function handleUncheck(logId: string) {
    try {
      await uncheckLog(logId);
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao desmarcar');
    }
  }

  async function handleSlotOption(
    mealName: string,
    mealTargetTime: string | null,
    item: (typeof meals)[number]['items'][number],
    option: 'main' | { sub: FoodSubstitution & { substitute_food?: Food } },
  ) {
    const slotLog = findPlanSlotLog(mealName, item);
    const target =
      option === 'main'
        ? {
            food: item.food,
            qtyG: item.quantity_g,
            units: item.quantity_units ?? 1,
          }
        : {
            food: option.sub.substitute_food,
            qtyG: option.sub.substitute_quantity_g,
            units: option.sub.substitute_quantity_units ?? 1,
          };
    if (!target.food?.name) return;

    try {
      if (slotLog && slotLog.food_name === target.food.name) {
        await uncheckLog(slotLog.id);
        return;
      }
      if (slotLog) await uncheckLog(slotLog.id);
      await checkMealItem(mealName, target.food, target.qtyG, false, target.units, mealTargetTime);
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao registrar');
    }
  }

  /** Checkbox do principal: vazio → marca principal; principal marcado → desmarca; só substituto → remove substituto (sem marcar principal). */
  async function handleMainCheckboxClick(
    mealName: string,
    mealTargetTime: string | null,
    item: (typeof meals)[number]['items'][number],
  ) {
    const slotLog = findPlanSlotLog(mealName, item);
    const units = item.quantity_units ?? 1;
    try {
      if (!slotLog) {
        await checkMealItem(mealName, item.food, item.quantity_g, false, units, mealTargetTime);
        return;
      }
      if (slotLog.food_name === item.food.name) {
        await uncheckLog(slotLog.id);
        return;
      }
      await uncheckLog(slotLog.id);
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao atualizar');
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton variant="block" className="h-24 w-full" />
        <Skeleton variant="block" className="h-40 w-full" />
        <Skeleton variant="block" className="h-40 w-full" />
      </div>
    );
  }

  if (meals.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-text-muted mb-4">
          Nenhum plano de dieta ativo. Monte sua dieta primeiro.
        </p>
        <Button variant="outline" onClick={() => window.location.href = '/health/nutrition/plan'}>
          Minha Dieta
        </Button>
      </div>
    );
  }

  const dailyTarget = sumPlannedKcalFromMeals(meals);
  const weeklyBuffer = settings?.weekly_extra_buffer ?? 0;
  const kcalProgress = dailyTarget > 0 ? Math.min(100, Math.round((todayTotals.kcal / dailyTarget) * 100)) : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Daily summary header */}
      <div className="p-4 bg-surface-2 rounded-xl border border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-orange-400" />
            <h3 className="text-sm font-semibold text-text-primary">Resumo do dia</h3>
          </div>
          <WeeklyBufferBadge used={weeklyBufferUsed} total={weeklyBuffer} />
        </div>

        {/* Kcal progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-muted">Calorias consumidas</span>
            <span className="text-xs font-medium text-text-secondary tabular-nums">
              {formatKcal(todayTotals.kcal)} / {formatKcal(dailyTarget)} kcal
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-surface-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                kcalProgress > 100 ? 'bg-red-400' : kcalProgress > 80 ? 'bg-amber-400' : 'bg-green-400'
              }`}
              style={{ width: `${Math.min(kcalProgress, 100)}%` }}
            />
          </div>
        </div>

        {/* Macro breakdown */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-1.5 rounded-lg bg-surface-3">
            <p className="text-[10px] text-text-muted">Proteína</p>
            <p className="text-xs font-bold text-blue-400 tabular-nums">{formatGrams(todayTotals.protein)}</p>
          </div>
          <div className="text-center p-1.5 rounded-lg bg-surface-3">
            <p className="text-[10px] text-text-muted">Carboidratos</p>
            <p className="text-xs font-bold text-amber-400 tabular-nums">{formatGrams(todayTotals.carbs)}</p>
          </div>
          <div className="text-center p-1.5 rounded-lg bg-surface-3">
            <p className="text-[10px] text-text-muted">Gordura</p>
            <p className="text-xs font-bold text-rose-400 tabular-nums">{formatGrams(todayTotals.fat)}</p>
          </div>
        </div>
      </div>

      {/* Meal checklists */}
      {meals.map((meal) => {
        const allChecked = meal.items.every((item) => Boolean(findPlanSlotLog(meal.name, item)));
        const checkedCount = meal.items.filter((item) => Boolean(findPlanSlotLog(meal.name, item))).length;
        const isExpanded = expandedMeal === meal.id;

        return (
          <div key={meal.id} className="bg-surface-2 rounded-xl border border-border overflow-hidden">
            {/* Header — clickable to toggle */}
            <button
              onClick={() => setExpandedMeal(isExpanded ? null : meal.id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-3/50 transition-colors cursor-pointer"
            >
              <div className="flex flex-col items-start gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${allChecked ? 'bg-green-400' : 'bg-surface-3'}`} />
                  <span className="text-sm font-semibold text-text-primary">{meal.name}</span>
                </div>
                <div className="flex items-center gap-2 pl-4">
                  {meal.target_time && (
                    <span className="text-xs text-text-muted tabular-nums">{meal.target_time.slice(0, 5)}</span>
                  )}
                  <span className="text-xs text-text-muted tabular-nums">
                    {checkedCount}/{meal.items.length} itens
                  </span>
                </div>
              </div>
              <div className="flex items-center shrink-0">
                {isExpanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border divide-y divide-border">
                {meal.items.map((item) => {
                  const slotLog = findPlanSlotLog(meal.name, item);
                  const units = item.quantity_units ?? 1;
                  const mainMacros = calcMacros(item.food, item.quantity_g);
                  const mainLogged = Boolean(slotLog && slotLog.food_name === item.food.name);
                  const slotFilled = Boolean(slotLog);
                  const subs = item.substitutions ?? [];
                  const validSubs = subs.filter((s) => s.substitute_food);
                  const selectedSubName =
                    !mainLogged && slotLog
                      ? validSubs.find((s) => s.substitute_food && slotLog.food_name === s.substitute_food.name)
                          ?.substitute_food?.name
                      : null;

                  if (validSubs.length === 0) {
                    return (
                      <div key={item.id}>
                        <div
                          className={`px-4 py-3 flex items-center gap-3 transition-colors ${
                            slotFilled ? 'bg-green-500/5' : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleMainCheckboxClick(meal.name, meal.target_time ?? null, item)}
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                              slotFilled
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-border hover:border-brand-primary'
                            }`}
                          >
                            {slotFilled && <Check size={12} strokeWidth={3} />}
                          </button>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className={`text-sm truncate ${mainLogged ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                              {item.food.name}
                            </span>
                            <span className="text-[10px] text-text-muted tabular-nums">
                              {units > 1 ? `${units}× ` : ''}{formatQuantity(item.quantity_g, item.food.serving_unit)} ·{' '}
                              {Math.round(mainMacros.kcal * units)} kcal · {formatGrams(mainMacros.protein * units)} P
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={item.id}>
                      <Accordion type="single" className="w-full">
                        <Accordion.Item
                          value={`slot-${item.id}`}
                          className="rounded-none border-0 shadow-none bg-transparent overflow-hidden"
                        >
                          <div
                            className={`flex items-center gap-3 px-4 py-3 min-w-0 transition-colors ${
                              slotFilled ? 'bg-green-500/5' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMainCheckboxClick(meal.name, meal.target_time ?? null, item);
                              }}
                              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                                slotFilled
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-border hover:border-brand-primary'
                              }`}
                            >
                              {slotFilled && <Check size={12} strokeWidth={3} />}
                            </button>
                            <Accordion.CustomTrigger className="flex-1 min-w-0 flex items-center justify-between gap-2 py-0 pr-0 w-auto! text-left rounded-none hover:bg-transparent focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:ring-offset-0">
                              {({ isExpanded }) => (
                                <>
                                  <div className="flex flex-col min-w-0 flex-1 items-start text-left">
                                    <span
                                      className={`text-sm truncate w-full ${mainLogged ? 'line-through text-text-muted' : 'text-text-primary'}`}
                                    >
                                      {item.food.name}
                                    </span>
                                    <span className="text-[10px] text-text-muted tabular-nums">
                                      {units > 1 ? `${units}× ` : ''}
                                      {formatQuantity(item.quantity_g, item.food.serving_unit)} · {Math.round(mainMacros.kcal * units)} kcal ·{' '}
                                      {formatGrams(mainMacros.protein * units)} P
                                    </span>
                                    {!mainLogged &&
                                      (selectedSubName ? (
                                        <span className="text-[10px] text-green-400 truncate max-w-full mt-0.5">
                                          Marcado: {selectedSubName}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-text-muted mt-0.5">
                                          {validSubs.length} substituição(ões)
                                        </span>
                                      ))}
                                    {mainLogged && (
                                      <span className="text-[10px] text-text-muted mt-0.5">Substituições ao expandir</span>
                                    )}
                                  </div>
                                  <ChevronDown
                                    size={18}
                                    className={[
                                      'shrink-0 text-text-muted transition-transform duration-300',
                                      isExpanded ? 'rotate-180' : 'rotate-0',
                                    ].join(' ')}
                                  />
                                </>
                              )}
                            </Accordion.CustomTrigger>
                          </div>
                          <Accordion.Content>
                            <div className="flex flex-col bg-surface-3/10">
                              {validSubs.map((sub, subIdx) => {
                                const sf = sub.substitute_food!;
                                const subUnits = sub.substitute_quantity_units ?? 1;
                                const subMacros = calcMacros(sf, sub.substitute_quantity_g);
                                const subChecked = Boolean(slotLog && slotLog.food_name === sf.name);

                                return (
                                  <div
                                    key={sub.id}
                                    className={[
                                      'flex items-center gap-3 px-4 py-2.5',
                                      subIdx > 0 ? 'border-t border-border/50' : 'border-t border-border/40',
                                      subChecked ? 'bg-green-500/5' : '',
                                    ].join(' ')}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleSlotOption(meal.name, meal.target_time ?? null, item, { sub })}
                                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                                        subChecked
                                          ? 'bg-green-500 border-green-500 text-white'
                                          : 'border-border hover:border-brand-primary'
                                      }`}
                                    >
                                      {subChecked && <Check size={12} strokeWidth={3} />}
                                    </button>
                                    <div className="flex flex-col min-w-0 flex-1 border-l border-border/50 pl-3">
                                      <span className="text-[10px] uppercase tracking-wide text-text-muted mb-0.5">
                                        Substituição
                                      </span>
                                      <span
                                        className={`text-sm truncate ${subChecked ? 'line-through text-text-muted' : 'text-text-primary'}`}
                                      >
                                        {sf.name}
                                      </span>
                                      <span className="text-[10px] text-text-muted tabular-nums">
                                        {subUnits > 1 ? `${subUnits}× ` : ''}
                                        {formatQuantity(sub.substitute_quantity_g, sf.serving_unit)} · {Math.round(subMacros.kcal * subUnits)} kcal ·{' '}
                                        {formatGrams(subMacros.protein * subUnits)} P
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </Accordion.Content>
                        </Accordion.Item>
                      </Accordion>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Extra logs */}
      {(() => {
        const extraLogs = todayLogs.filter((l) => l.is_extra);
        return (
          <div className="bg-surface-2 rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-border">
              <span className="text-sm font-semibold text-text-primary">Consumo extra</span>
              <Button size="sm" variant="ghost" leftIcon={<Plus size={14} />} onClick={() => setShowExtra(true)}>
                Adicionar
              </Button>
            </div>
            {extraLogs.length === 0 ? (
              <p className="px-4 py-4 text-xs text-text-muted">Nenhum item extra registrado hoje.</p>
            ) : (
              <div className="divide-y divide-border">
                {extraLogs.map((log) => (
                  <div key={log.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm text-text-primary truncate">{log.food_name}</span>
                      <span className="text-[10px] text-text-muted tabular-nums">
                        {log.quantity_units > 1 ? `${log.quantity_units}× ` : ''}{formatQuantity(log.quantity_g, log.serving_unit)} · {Math.round(log.kcal)} kcal · {formatGrams(log.protein)} P
                      </span>
                    </div>
                    <button
                      onClick={() => handleUncheck(log.id)}
                      className="p-1 text-text-muted hover:text-red-400 transition-colors cursor-pointer shrink-0"
                      title="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {showExtra && (
        <ExtraConsumptionModal onClose={() => setShowExtra(false)} />
      )}
    </div>
  );
}
