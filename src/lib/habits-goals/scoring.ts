import { enumerateDatesInWindow, type PeriodWindow } from '@/lib/habits-goals/period';
import {
  extraKcalFromEntries,
  mealDiaryAdherenceRatio,
  parseMealDiaryConfig,
  parseMealDiaryLogNote,
} from '@/lib/habits-goals/meal-diary';
import type { Tracker, Log } from '@/types/habits-goals';

/** Meta semanal em kcal para tracker de calorias (meta diária × dias ativos). */
export function weeklyGoalKcalForTracker(tracker: Tracker): number {
  const daily = Number(tracker.goal_value ?? 0);
  const activeDays = tracker.recurrence_days?.length ?? 7;
  return daily * activeDays;
}

/**
 * Pontos por dia na semana calendário (seg–dom) para meta de calorias.
 * Bônus semanal vai para o primeiro dia em que o acumulado atinge a meta.
 */
export function computeCaloriesWeekPointsByDate(
  tracker: Tracker,
  logs: Log[],
  weekWindow: PeriodWindow,
): Map<string, number> {
  const result = new Map<string, number>();
  if (tracker.source_key !== 'calories_burned') return result;

  const dates = enumerateDatesInWindow(weekWindow);
  const valueByDate = new Map<string, number>();
  for (const log of logs) {
    if (log.tracker_id !== tracker.id) continue;
    if (log.created_at < weekWindow.startStr || log.created_at > weekWindow.endStr) continue;
    valueByDate.set(log.created_at, Number(log.value ?? 0));
  }

  if (!tracker.scoring_enabled) {
    for (const date of dates) {
      if (valueByDate.has(date)) result.set(date, 0);
    }
    return result;
  }

  const pointsPerKcal = Number(tracker.points_value ?? 0);
  const weeklyBonus = Number(tracker.weekly_bonus_points ?? 0);
  const weeklyGoal = weeklyGoalKcalForTracker(tracker);

  let cumulative = 0;
  let bonusDate: string | null = null;
  for (const date of dates) {
    cumulative += valueByDate.get(date) ?? 0;
    if (bonusDate === null && weeklyGoal > 0 && weeklyBonus > 0 && cumulative >= weeklyGoal) {
      bonusDate = date;
    }
  }

  for (const date of dates) {
    const value = valueByDate.get(date) ?? 0;
    const base = value * pointsPerKcal;
    const bonus = date === bonusDate ? weeklyBonus : 0;
    if (value > 0 || bonus > 0 || valueByDate.has(date)) {
      result.set(date, base + bonus);
    }
  }

  return result;
}

/** Penalidade configurada ao estourar calorias livres (valor negativo ou zero). */
export function mealDiaryFreeKcalOverPenalty(tracker: Tracker): number {
  const raw = Number(tracker.points_on_miss ?? 0);
  if (!Number.isFinite(raw) || raw === 0) return 0;
  return raw > 0 ? -raw : raw;
}

/** Pontos base do dia: `points_value` × aderência média aos itens do plano (0–1). */
export function computeMealDiaryDayBasePoints(tracker: Tracker, note: string | null | undefined): number {
  if (tracker.source_key !== 'meal_diary' || !tracker.scoring_enabled) return 0;
  const config = parseMealDiaryConfig(tracker.source_config);
  const entries = parseMealDiaryLogNote(note).entries;
  const ratio = mealDiaryAdherenceRatio(config, entries);
  return Math.round(Number(tracker.points_value ?? 0) * ratio);
}

/**
 * Pontos por dia na semana calendário para diário alimentar (modo `planned_items`).
 * Penalidade no primeiro dia em que as calorias livres semanais forem ultrapassadas.
 */
export function computeMealDiaryWeekPointsByDate(
  tracker: Tracker,
  logs: Log[],
  weekWindow: PeriodWindow,
): Map<string, number> {
  const result = new Map<string, number>();
  if (tracker.source_key !== 'meal_diary') return result;

  const dates = enumerateDatesInWindow(weekWindow);
  const config = parseMealDiaryConfig(tracker.source_config);
  const adherenceByDate = new Map<string, number>();
  const extraKcalByDate = new Map<string, number>();

  for (const log of logs) {
    if (log.tracker_id !== tracker.id) continue;
    if (log.created_at < weekWindow.startStr || log.created_at > weekWindow.endStr) continue;
    const entries = parseMealDiaryLogNote(log.note).entries;
    adherenceByDate.set(log.created_at, mealDiaryAdherenceRatio(config, entries));
    extraKcalByDate.set(log.created_at, extraKcalFromEntries(entries));
  }

  if (!tracker.scoring_enabled) {
    for (const date of dates) {
      if (adherenceByDate.has(date)) result.set(date, 0);
    }
    return result;
  }

  const penalty = mealDiaryFreeKcalOverPenalty(tracker);
  const weeklyFreeBudget = config.weekly_free_kcal;
  const maxDaily = Number(tracker.points_value ?? 0);

  let cumulativeExtra = 0;
  let penaltyDate: string | null = null;
  for (const date of dates) {
    cumulativeExtra += extraKcalByDate.get(date) ?? 0;
    const overBudget =
      penalty < 0 &&
      (weeklyFreeBudget <= 0 ? cumulativeExtra > 0 : cumulativeExtra > weeklyFreeBudget);
    if (penaltyDate === null && overBudget) {
      penaltyDate = date;
    }
  }

  for (const date of dates) {
    if (!adherenceByDate.has(date)) continue;
    const ratio = adherenceByDate.get(date) ?? 0;
    const base = Math.round(maxDaily * ratio);
    const appliedPenalty = date === penaltyDate ? penalty : 0;
    result.set(date, base + appliedPenalty);
  }

  return result;
}

/**
 * Melhor pontuação possível no dia para a meta (só trackers com scoring_enabled).
 * Usado para exibir "X de Y pts" e % de pontos.
 */
export function maxPossiblePointsForTracker(tracker: Tracker): number {
  if (tracker.source_key === 'calories_burned') {
    if (!tracker.scoring_enabled) return 0;
    const daily = Number(tracker.goal_value ?? 0);
    const pv = Number(tracker.points_value ?? 0);
    const bonus = Number(tracker.weekly_bonus_points ?? 0);
    return Math.max(0, daily * pv + bonus);
  }

  if (tracker.source_key === 'meal_diary') {
    if (!tracker.scoring_enabled) return 0;
    return Math.max(0, Number(tracker.points_value ?? 0));
  }

  // Checklist: pontuação sempre baseada nos pontos individuais por item
  if (tracker.type === 'checklist') {
    return (tracker.checklist_items ?? []).reduce(
      (acc, item) => acc + Math.max(0, Number(item.points ?? 0)),
      0,
    );
  }

  if (!tracker.scoring_enabled) return 0;

  const pv = Number(tracker.points_value ?? 0);
  const goal = Number(tracker.goal_value ?? 0);

  switch (tracker.type) {
    case 'boolean':
      return Math.max(0, pv);
    case 'counter':
    case 'slider':
      if (tracker.scoring_mode === 'completion') {
        return Math.max(0, pv);
      }
      return Math.max(0, goal * pv);
    default:
      return 0;
  }
}

export function pointsPercentOfMax(earned: number, maxPossible: number): number | null {
  if (maxPossible <= 0) return null;
  return Math.min(100, Math.round((earned / maxPossible) * 100));
}

/**
 * Para `counter` / `slider` com `period_aggregation === 'aggregate'` e modo `completion`,
 * `log.value` pode ser a **soma no período** (não só o valor do dia), p.ex. ao gravar pontos após upsert.
 */
export function calculatePoints(
  tracker: Tracker,
  log: Partial<Log>,
  goalValue?: number | null
): number {
  // Usa o goalValue passado ou o do tracker
  const effectiveGoalValue = goalValue !== undefined ? goalValue : tracker.goal_value;

  // Checklist: pontuação sempre baseada nos pontos individuais por item
  if (tracker.type === 'checklist') {
    const items = tracker.checklist_items ?? [];
    const checked = log.checked_items ?? [];
    return items.reduce((acc, item, index) => {
      return acc + (checked[index] ? Number(item.points ?? 0) : 0);
    }, 0);
  }

  if (!tracker.scoring_enabled) return 0;

  if (tracker.source_key === 'meal_diary' || tracker.scoring_mode === 'planned_items') {
    return computeMealDiaryDayBasePoints(tracker, log.note);
  }

  switch (tracker.type) {
    case 'boolean':
      return log.value === 1 ? Number(tracker.points_value ?? 0) : 0;

    case 'counter':
    case 'slider': {
      const value = log.value ?? 0;
      if (tracker.scoring_mode === 'completion') {
        return value >= (effectiveGoalValue ?? 0) ? Number(tracker.points_value ?? 0) : 0;
      }
      return value * Number(tracker.points_value ?? 0);
    }

    default:
      return 0;
  }
}

export function formatScore(points: number): string {
  if (points > 0) return `+${points} pts`;
  if (points < 0) return `${points} pts`;
  return '0 pts';
}

export function getScoreColor(points: number): string {
  if (points > 0) return 'text-success';
  if (points < 0) return 'text-danger';
  return 'text-text-muted';
}
