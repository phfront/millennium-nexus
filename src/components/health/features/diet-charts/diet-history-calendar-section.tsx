"use client";

import { useMemo, useState } from "react";
import { Accordion, CalendarHeatmap, Skeleton } from "@phfront/millennium-ui";
import type { DietLog, DietPlanMealWithItems } from "@/types/nutrition";
import {
  calcDailyTotals,
  formatGrams,
  formatKcal,
  formatQuantity,
  sumPlannedKcalFromMeals,
} from "@/lib/health/nutrition";

export type DietHistoryCalendarSectionProps = {
  logs: DietLog[];
  meals: DietPlanMealWithItems[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  refreshKey?: number;
  isLoading?: boolean;
};

export function DietHistoryCalendarSection({
  logs,
  meals,
  selectedDate,
  onSelectDate,
  refreshKey = 0,
  isLoading = false,
}: DietHistoryCalendarSectionProps) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const now = new Date();
  const isCurrentMonth =
    month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();

  const dailyTarget = sumPlannedKcalFromMeals(meals);

  const completionData = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const monthNum = String(m + 1).padStart(2, "0");
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const planMeals = meals.length > 0 ? meals : undefined;

    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${y}-${monthNum}-${String(day).padStart(2, "0")}`;
      const dayLogs = logs.filter((l) => l.logged_date === dateStr);
      const totals = calcDailyTotals(logs, dateStr, planMeals);
      const kcal = totals.kcal;
      const percent =
        dailyTarget > 0
          ? Math.min(100, Math.round((kcal / dailyTarget) * 100))
          : kcal > 0
            ? 100
            : 0;
      return {
        date: dateStr,
        percent,
        pointsEarned: 0,
        pointsMax: 0,
        pointsPercent: 0,
      };
    });
  }, [month, logs, meals, dailyTarget, refreshKey]);

  const selectedDayLogs = useMemo(() => {
    if (!selectedDate) return [];
    return logs
      .filter((l) => l.logged_date === selectedDate)
      .slice()
      .sort((a, b) => {
        const meal = a.meal_name.localeCompare(b.meal_name);
        if (meal !== 0) return meal;
        if (a.is_extra !== b.is_extra) return a.is_extra ? 1 : -1;
        return a.food_name.localeCompare(b.food_name);
      });
  }, [logs, selectedDate]);

  const selectedTotals = useMemo(() => {
    if (!selectedDate) return null;
    return calcDailyTotals(logs, selectedDate, meals.length > 0 ? meals : undefined);
  }, [logs, selectedDate, meals]);

  /** Refeições do dia selecionado, ordenadas como no plano + desconhecidas + extras. */
  const selectedMealGroups = useMemo(() => {
    if (selectedDayLogs.length === 0) return [];
    const planOrder = new Map(meals.map((m, i) => [m.name, i]));
    const byKey = new Map<string, DietLog[]>();
    for (const log of selectedDayLogs) {
      const k = log.is_extra ? "__extra__" : log.meal_name;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(log);
    }
    const unknown = [...byKey.keys()]
      .filter((k) => k !== "__extra__" && !planOrder.has(k))
      .sort((a, b) => a.localeCompare(b, "pt"));
    const unknownIdx = new Map(unknown.map((k, i) => [k, 1000 + i]));

    const entries = [...byKey.entries()].map(([key, groupLogs]) => {
      const label = key === "__extra__" ? "Consumo extra" : key;
      let order: number;
      if (key === "__extra__") order = 10000;
      else if (planOrder.has(key)) order = planOrder.get(key)!;
      else order = unknownIdx.get(key) ?? 2000;
      const mealKcal = groupLogs.reduce((s, l) => s + l.kcal, 0);
      return { key, label, logs: groupLogs, order, mealKcal };
    });
    entries.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.label.localeCompare(b.label, "pt");
    });
    return entries;
  }, [selectedDayLogs, meals]);

  function prevMonth() {
    setMonth((mo) => new Date(mo.getFullYear(), mo.getMonth() - 1, 1));
    onSelectDate(null);
  }

  function nextMonth() {
    if (isCurrentMonth) return;
    setMonth((mo) => new Date(mo.getFullYear(), mo.getMonth() + 1, 1));
    onSelectDate(null);
  }

  if (isLoading) {
    return <Skeleton variant="block" className="h-52 w-full" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <CalendarHeatmap
        data={completionData}
        month={month}
        selectedDate={selectedDate ?? undefined}
        onSelectDate={(d) => onSelectDate(d || null)}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        isCurrentMonth={isCurrentMonth}
        legendMinLabel="0 kcal"
        legendMaxLabel="Meta"
      />

      {selectedDate && selectedTotals && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-text-secondary">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </h2>
            <span className="text-xs text-text-muted tabular-nums">
              {formatKcal(selectedTotals.kcal)} kcal · {formatGrams(selectedTotals.protein)} P ·{" "}
              {formatGrams(selectedTotals.carbs)} C · {formatGrams(selectedTotals.fat)} G
            </span>
          </div>

          {selectedDayLogs.length === 0 ? (
            <p className="text-xs text-text-muted">Nenhum registo neste dia.</p>
          ) : (
            <Accordion
              key={selectedDate}
              type="multiple"
              defaultValue={selectedMealGroups.map((_, i) => `m-${i}`)}
              className="flex flex-col gap-2"
            >
              {selectedMealGroups.map((group, idx) => (
                <Accordion.Item
                  key={group.key}
                  value={`m-${idx}`}
                  className="overflow-hidden rounded-xl border border-border bg-surface-3/15 shadow-none"
                >
                  <Accordion.Trigger className="bg-transparent! px-4 py-3 hover:bg-surface-3/40">
                    <div className="min-w-0 text-left">
                      <span className="block truncate text-sm font-semibold text-text-primary">
                        {group.label}
                      </span>
                      <span className="text-[10px] text-text-muted tabular-nums">
                        {group.logs.length} {group.logs.length === 1 ? "item" : "itens"} ·{" "}
                        {Math.round(group.mealKcal)} kcal
                      </span>
                    </div>
                  </Accordion.Trigger>
                  <Accordion.Content innerClassName="!border-t-0 !px-0 !pb-0 !pt-0">
                    <ul className="flex flex-col divide-y divide-border border-t border-border">
                      {group.logs.map((log) => (
                        <li
                          key={log.id}
                          className="flex flex-col gap-0.5 bg-surface-3/20 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm text-text-primary">{log.food_name}</p>
                            <p className="text-[10px] text-text-muted">
                              {log.quantity_units > 1 ? `${log.quantity_units}× ` : ""}
                              {formatQuantity(log.quantity_g, log.serving_unit)}
                            </p>
                          </div>
                          <p className="shrink-0 text-xs tabular-nums text-text-secondary">
                            {Math.round(log.kcal)} kcal
                          </p>
                        </li>
                      ))}
                    </ul>
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion>
          )}
        </div>
      )}
    </div>
  );
}
