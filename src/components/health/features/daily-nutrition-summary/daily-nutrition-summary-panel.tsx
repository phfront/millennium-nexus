"use client";

import { useRouter } from "next/navigation";
import { Flame } from "lucide-react";
import { Button, Skeleton } from "@phfront/millennium-ui";
import { WidgetSectionHeader } from "@/components/widgets/WidgetSectionHeader";
import { useDietPlan } from "@/hooks/health/use-diet-plan";
import { useDietHistory } from "@/hooks/health/use-diet-history";
import { useDietSettings } from "@/hooks/health/use-diet-settings";
import {
  formatKcal,
  formatGrams,
  sumPlannedKcalFromMeals,
} from "@/lib/health/nutrition";
import { WeeklyBufferBadge } from "@/components/health/features/daily-checklist/weekly-buffer-badge";
import { cn } from "@/lib/utils";

/**
 * Resumo do dia (calorias + macros) para o widget da home.
 * Reutiliza a mesma fonte de dados que o checklist de refeições.
 */
export function DailyNutritionSummaryPanel({
  hasBackground = true,
}: {
  hasBackground?: boolean;
}) {
  const router = useRouter();
  const { meals, isLoading: planLoading } = useDietPlan();
  const { settings } = useDietSettings();
  const {
    todayTotals,
    weeklyBufferUsed,
    isLoading: logsLoading,
  } = useDietHistory({ activePlanMeals: meals });

  const isLoading = planLoading || logsLoading;
  const weeklyBuffer = settings?.weekly_extra_buffer ?? 0;
  const dailyTarget = sumPlannedKcalFromMeals(meals);
  const kcalProgress =
    dailyTarget > 0
      ? Math.min(100, Math.round((todayTotals.kcal / dailyTarget) * 100))
      : 0;

  if (isLoading) {
    return (
      <Skeleton
        variant="block"
        className="h-full min-h-[160px] w-full rounded-2xl"
      />
    );
  }

  if (meals.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface-2/60 p-4 text-center">
        <p className="text-sm text-text-muted">
          Sem plano ativo para resumir o dia.
        </p>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => router.push("/health/nutrition/plan")}
        >
          Montar dieta
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-3 sm:gap-4",
        hasBackground
          ? "rounded-2xl border border-white/10 bg-surface-2/50 p-4 pb-5 shadow-sm ring-1 ring-inset ring-white/4"
          : "px-3 pt-3 pb-4"
      )}
    >
      <WidgetSectionHeader
        className="shrink-0"
        variant="orange"
        icon={<Flame className="h-3.5 w-3.5" aria-hidden />}
        title="Resumo do dia"
        subtitle="Calorias consumidas e macros do plano ativo."
        trailing={
          <div className="hidden sm:block">
            <WeeklyBufferBadge used={weeklyBufferUsed} total={weeklyBuffer} />
          </div>
        }
      />

      <div className="-mt-2 flex shrink-0 justify-end sm:hidden">
        <WeeklyBufferBadge used={weeklyBufferUsed} total={weeklyBuffer} />
      </div>

      <section className="shrink-0">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-xs text-text-muted">Calorias consumidas</span>
          <span className="text-xs font-medium tabular-nums text-text-secondary">
            {formatKcal(todayTotals.kcal)} / {formatKcal(dailyTarget)} kcal
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-black/35 ring-1 ring-inset ring-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              kcalProgress > 100
                ? "bg-red-400"
                : kcalProgress > 80
                ? "bg-amber-400"
                : "bg-emerald-400"
            }`}
            style={{ width: `${Math.min(kcalProgress, 100)}%` }}
            role="progressbar"
            aria-valuenow={Math.min(kcalProgress, 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso das calorias do plano"
          />
        </div>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-2 pb-1 sm:gap-3 sm:pb-2">
        <div className="flex min-h-14 min-w-0 flex-col items-center justify-center rounded-xl border border-white/6 bg-surface-3/80 px-2 py-2 text-center sm:min-h-18 sm:py-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Proteína
          </p>
          <p className="mt-1 text-base font-bold tabular-nums text-sky-400 sm:text-lg">
            {formatGrams(todayTotals.protein)}
          </p>
        </div>
        <div className="flex min-h-14 min-w-0 flex-col items-center justify-center rounded-xl border border-white/6 bg-surface-3/80 px-2 py-2 text-center sm:min-h-18 sm:py-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Carboidratos
          </p>
          <p className="mt-1 text-base font-bold tabular-nums text-amber-400 sm:text-lg">
            {formatGrams(todayTotals.carbs)}
          </p>
        </div>
        <div className="flex min-h-14 min-w-0 flex-col items-center justify-center rounded-xl border border-white/6 bg-surface-3/80 px-2 py-2 text-center sm:min-h-18 sm:py-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Gordura
          </p>
          <p className="mt-1 text-base font-bold tabular-nums text-rose-400 sm:text-lg">
            {formatGrams(todayTotals.fat)}
          </p>
        </div>
      </div>
    </div>
  );
}
