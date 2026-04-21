"use client";

import { useState } from "react";
import { Check, Plus, Flame, ChevronDown, Trash2 } from "lucide-react";
import { Accordion, Button, Skeleton, useToast } from "@phfront/millennium-ui";
import { useDietPlan } from "@/hooks/health/use-diet-plan";
import { useDietHistory } from "@/hooks/health/use-diet-history";
import type { Food, FoodSubstitution } from "@/types/nutrition";
import { useDietSettings } from "@/hooks/health/use-diet-settings";
import {
  calcMacros,
  formatKcal,
  formatGrams,
  formatQuantity,
  sumPlannedKcalFromMeals,
} from "@/lib/health/nutrition";
import { ExtraConsumptionModal } from "./extra-consumption-modal";
import { WeeklyBufferBadge } from "./weekly-buffer-badge";

export interface DailyChecklistProps {
  /** Oculta o bloco “Resumo do dia” (ex.: widget `health_meals` na home). */
  hideDailySummary?: boolean;
}

export function DailyChecklist({
  hideDailySummary = false,
}: DailyChecklistProps) {
  const { meals, isLoading: planLoading } = useDietPlan();
  const { settings } = useDietSettings();
  const {
    todayLogs,
    todayTotals,
    weeklyBufferUsed,
    isLoading: logsLoading,
    checkMealItem,
    uncheckLog,
    findPlanSlotLog,
  } = useDietHistory();
  const { toast } = useToast();

  const [showExtra, setShowExtra] = useState(false);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);

  const isLoading = planLoading || logsLoading;

  async function handleUncheck(logId: string) {
    try {
      await uncheckLog(logId);
    } catch (e) {
      toast.error(
        "Erro",
        e instanceof Error ? e.message : "Falha ao desmarcar"
      );
    }
  }

  async function handleSlotOption(
    mealName: string,
    mealTargetTime: string | null,
    item: (typeof meals)[number]["items"][number],
    option: "main" | { sub: FoodSubstitution & { substitute_food?: Food } }
  ) {
    const slotLog = findPlanSlotLog(mealName, item);
    const target =
      option === "main"
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
      await checkMealItem(
        mealName,
        target.food,
        target.qtyG,
        false,
        target.units,
        mealTargetTime
      );
    } catch (e) {
      toast.error(
        "Erro",
        e instanceof Error ? e.message : "Falha ao registrar"
      );
    }
  }

  /** Checkbox do principal: vazio → marca principal; principal marcado → desmarca; só substituto → remove substituto (sem marcar principal). */
  async function handleMainCheckboxClick(
    mealName: string,
    mealTargetTime: string | null,
    item: (typeof meals)[number]["items"][number]
  ) {
    const slotLog = findPlanSlotLog(mealName, item);
    const units = item.quantity_units ?? 1;
    try {
      if (!slotLog) {
        await checkMealItem(
          mealName,
          item.food,
          item.quantity_g,
          false,
          units,
          mealTargetTime
        );
        return;
      }
      if (slotLog.food_name === item.food.name) {
        await uncheckLog(slotLog.id);
        return;
      }
      await uncheckLog(slotLog.id);
    } catch (e) {
      toast.error(
        "Erro",
        e instanceof Error ? e.message : "Falha ao atualizar"
      );
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
        <Button
          variant="outline"
          onClick={() => (window.location.href = "/health/nutrition/plan")}
        >
          Minha Dieta
        </Button>
      </div>
    );
  }

  const dailyTarget = sumPlannedKcalFromMeals(meals);
  const weeklyBuffer = settings?.weekly_extra_buffer ?? 0;
  const kcalProgress =
    dailyTarget > 0
      ? Math.min(100, Math.round((todayTotals.kcal / dailyTarget) * 100))
      : 0;
  const isWidget = hideDailySummary;

  function renderExtraCard() {
    const extraLogs = todayLogs.filter((l) => l.is_extra);
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="text-sm font-semibold text-text-primary">
            Consumo extra
          </span>
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Plus size={14} />}
            onClick={() => setShowExtra(true)}
          >
            Adicionar
          </Button>
        </div>
        {extraLogs.length === 0 ? (
          <p className="px-5 py-4 text-xs text-text-muted">
            Nenhum item extra registrado hoje.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {extraLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-text-primary">
                    {log.food_name}
                  </span>
                  <span className="text-[10px] text-text-muted tabular-nums">
                    {log.quantity_units > 1 ? `${log.quantity_units}× ` : ""}
                    {formatQuantity(log.quantity_g, log.serving_unit)} ·{" "}
                    {Math.round(log.kcal)} kcal · {formatGrams(log.protein)} P
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleUncheck(log.id)}
                  className="shrink-0 cursor-pointer p-1 text-text-muted transition-colors hover:text-red-400"
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
  }

  const mealsAccordion = (
    <Accordion
      type="single"
      value={expandedMeal ?? ""}
      onValueChange={(v) => {
        const s =
          typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : "";
        setExpandedMeal(s === "" ? null : s);
      }}
      className="flex flex-col gap-4"
    >
      {meals.map((meal) => {
        const allChecked = meal.items.every((item) =>
          Boolean(findPlanSlotLog(meal.name, item))
        );
        const checkedCount = meal.items.filter((item) =>
          Boolean(findPlanSlotLog(meal.name, item))
        ).length;

        return (
          <Accordion.Item
            key={meal.id}
            value={meal.id}
            className="rounded-xl border border-border bg-surface-2 shadow-none"
          >
            <Accordion.Trigger className="items-start bg-transparent! px-5 py-4 hover:bg-surface-3/50">
              <div className="flex min-w-0 flex-col items-start gap-1 text-left">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      allChecked ? "bg-green-400" : "bg-surface-3"
                    }`}
                  />
                  <span className="text-sm font-semibold text-text-primary">
                    {meal.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 pl-5">
                  {meal.target_time && (
                    <span className="text-xs text-text-muted tabular-nums">
                      {meal.target_time.slice(0, 5)}
                    </span>
                  )}
                  <span className="text-xs text-text-muted tabular-nums">
                    {checkedCount}/{meal.items.length} itens
                  </span>
                </div>
              </div>
            </Accordion.Trigger>
            <Accordion.Content>
              <div className="-mx-4 -mt-3 -mb-3">
                <div className="divide-y divide-border">
                  {meal.items.map((item) => {
                    const slotLog = findPlanSlotLog(meal.name, item);
                    const units = item.quantity_units ?? 1;
                    const mainMacros = calcMacros(item.food, item.quantity_g);
                    const mainLogged = Boolean(
                      slotLog && slotLog.food_name === item.food.name
                    );
                    const slotFilled = Boolean(slotLog);
                    const subs = item.substitutions ?? [];
                    const validSubs = subs.filter((s) => s.substitute_food);
                    const selectedSubName =
                      !mainLogged && slotLog
                        ? validSubs.find(
                            (s) =>
                              s.substitute_food &&
                              slotLog.food_name === s.substitute_food.name
                          )?.substitute_food?.name
                        : null;

                    if (validSubs.length === 0) {
                      return (
                        <div key={item.id}>
                          <div
                            className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${
                              slotFilled ? "bg-green-500/5" : ""
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                handleMainCheckboxClick(
                                  meal.name,
                                  meal.target_time ?? null,
                                  item
                                )
                              }
                              className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 transition-all ${
                                slotFilled
                                  ? "border-green-500 bg-green-500 text-white"
                                  : "border-border hover:border-brand-primary"
                              }`}
                            >
                              {slotFilled && (
                                <Check size={12} strokeWidth={3} />
                              )}
                            </button>
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span
                                className={`truncate text-sm ${
                                  mainLogged
                                    ? "text-text-muted line-through"
                                    : "text-text-primary"
                                }`}
                              >
                                {item.food.name}
                              </span>
                              <span className="text-[10px] text-text-muted tabular-nums">
                                {units > 1 ? `${units}× ` : ""}
                                {formatQuantity(
                                  item.quantity_g,
                                  item.food.serving_unit
                                )}{" "}
                                · {Math.round(mainMacros.kcal * units)} kcal ·{" "}
                                {formatGrams(mainMacros.protein * units)} P
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
                            className="overflow-hidden rounded-none border-0 bg-transparent shadow-none"
                          >
                            <div
                              className={`flex min-w-0 items-center gap-3 px-5 py-3.5 transition-colors ${
                                slotFilled ? "bg-green-500/5" : ""
                              }`}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMainCheckboxClick(
                                    meal.name,
                                    meal.target_time ?? null,
                                    item
                                  );
                                }}
                                className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 transition-all ${
                                  slotFilled
                                    ? "border-green-500 bg-green-500 text-white"
                                    : "border-border hover:border-brand-primary"
                                }`}
                              >
                                {slotFilled && (
                                  <Check size={12} strokeWidth={3} />
                                )}
                              </button>
                              <Accordion.CustomTrigger className="w-auto! flex min-w-0 flex-1 items-center justify-between gap-2 rounded-none py-0 pr-0 text-left hover:bg-transparent focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:ring-offset-0">
                                {({ isExpanded }) => (
                                  <>
                                    <div className="flex min-w-0 flex-1 flex-col items-start text-left">
                                      <span
                                        className={`w-full truncate text-sm ${
                                          mainLogged
                                            ? "text-text-muted line-through"
                                            : "text-text-primary"
                                        }`}
                                      >
                                        {item.food.name}
                                      </span>
                                      <span className="text-[10px] text-text-muted tabular-nums">
                                        {units > 1 ? `${units}× ` : ""}
                                        {formatQuantity(
                                          item.quantity_g,
                                          item.food.serving_unit
                                        )}{" "}
                                        · {Math.round(mainMacros.kcal * units)}{" "}
                                        kcal ·{" "}
                                        {formatGrams(
                                          mainMacros.protein * units
                                        )}{" "}
                                        P
                                      </span>
                                      {!mainLogged &&
                                        (selectedSubName ? (
                                          <span className="mt-0.5 max-w-full truncate text-[10px] text-green-400">
                                            Marcado: {selectedSubName}
                                          </span>
                                        ) : (
                                          <span className="mt-0.5 text-[10px] text-text-muted">
                                            {validSubs.length} substituição(ões)
                                          </span>
                                        ))}
                                      {mainLogged && (
                                        <span className="mt-0.5 text-[10px] text-text-muted">
                                          Substituições ao expandir
                                        </span>
                                      )}
                                    </div>
                                    <ChevronDown
                                      size={18}
                                      className={[
                                        "shrink-0 text-text-muted transition-transform duration-300",
                                        isExpanded ? "rotate-180" : "rotate-0",
                                      ].join(" ")}
                                    />
                                  </>
                                )}
                              </Accordion.CustomTrigger>
                            </div>
                            <Accordion.Content>
                              <div className="-mx-4 -mt-3 -mb-3">
                                <div className="flex flex-col bg-surface-3/10">
                                  {validSubs.map((sub, subIdx) => {
                                    const sf = sub.substitute_food!;
                                    const subUnits =
                                      sub.substitute_quantity_units ?? 1;
                                    const subMacros = calcMacros(
                                      sf,
                                      sub.substitute_quantity_g
                                    );
                                    const subChecked = Boolean(
                                      slotLog && slotLog.food_name === sf.name
                                    );

                                    return (
                                      <div
                                        key={sub.id}
                                        className={[
                                          "flex items-center gap-3 px-5 py-3",
                                          subIdx > 0
                                            ? "border-t border-border/50"
                                            : "border-t border-border/40",
                                          subChecked ? "bg-green-500/5" : "",
                                        ].join(" ")}
                                      >
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleSlotOption(
                                              meal.name,
                                              meal.target_time ?? null,
                                              item,
                                              { sub }
                                            )
                                          }
                                          className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 transition-all ${
                                            subChecked
                                              ? "border-green-500 bg-green-500 text-white"
                                              : "border-border hover:border-brand-primary"
                                          }`}
                                        >
                                          {subChecked && (
                                            <Check size={12} strokeWidth={3} />
                                          )}
                                        </button>
                                        <div className="flex min-w-0 flex-1 flex-col border-l border-border/50 pl-3">
                                          <span className="mb-0.5 text-[10px] uppercase tracking-wide text-text-muted">
                                            Substituição
                                          </span>
                                          <span
                                            className={`truncate text-sm ${
                                              subChecked
                                                ? "text-text-muted line-through"
                                                : "text-text-primary"
                                            }`}
                                          >
                                            {sf.name}
                                          </span>
                                          <span className="text-[10px] text-text-muted tabular-nums">
                                            {subUnits > 1
                                              ? `${subUnits}× `
                                              : ""}
                                            {formatQuantity(
                                              sub.substitute_quantity_g,
                                              sf.serving_unit
                                            )}{" "}
                                            ·{" "}
                                            {Math.round(
                                              subMacros.kcal * subUnits
                                            )}{" "}
                                            kcal ·{" "}
                                            {formatGrams(
                                              subMacros.protein * subUnits
                                            )}{" "}
                                            P
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </Accordion.Content>
                          </Accordion.Item>
                        </Accordion>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Accordion.Content>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );

  return (
    <div
      className={[
        "flex min-h-0 flex-col",
        isWidget ? "h-full flex-1 gap-4" : "gap-5",
      ].join(" ")}
    >
      {/* Daily summary header */}
      {!hideDailySummary && (
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-orange-400" />
              <h3 className="text-sm font-semibold text-text-primary">
                Resumo do dia
              </h3>
            </div>
            <WeeklyBufferBadge used={weeklyBufferUsed} total={weeklyBuffer} />
          </div>

          {/* Kcal progress bar */}
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-text-muted">
                Calorias consumidas
              </span>
              <span className="text-xs font-medium text-text-secondary tabular-nums">
                {formatKcal(todayTotals.kcal)} / {formatKcal(dailyTarget)} kcal
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  kcalProgress > 100
                    ? "bg-red-400"
                    : kcalProgress > 80
                    ? "bg-amber-400"
                    : "bg-green-400"
                }`}
                style={{ width: `${Math.min(kcalProgress, 100)}%` }}
              />
            </div>
          </div>

          {/* Macro breakdown */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-surface-3 p-1.5 text-center">
              <p className="text-[10px] text-text-muted">Proteína</p>
              <p className="text-xs font-bold tabular-nums text-blue-400">
                {formatGrams(todayTotals.protein)}
              </p>
            </div>
            <div className="rounded-lg bg-surface-3 p-1.5 text-center">
              <p className="text-[10px] text-text-muted">Carboidratos</p>
              <p className="text-xs font-bold tabular-nums text-amber-400">
                {formatGrams(todayTotals.carbs)}
              </p>
            </div>
            <div className="rounded-lg bg-surface-3 p-1.5 text-center">
              <p className="text-[10px] text-text-muted">Gordura</p>
              <p className="text-xs font-bold tabular-nums text-rose-400">
                {formatGrams(todayTotals.fat)}
              </p>
            </div>
          </div>
        </div>
      )}

      {isWidget ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 py-3 sm:px-4 sm:py-4">
            <div className="flex flex-col gap-4">
              {mealsAccordion}
              {renderExtraCard()}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {mealsAccordion}
          {renderExtraCard()}
        </div>
      )}

      {showExtra && (
        <ExtraConsumptionModal onClose={() => setShowExtra(false)} />
      )}
    </div>
  );
}
