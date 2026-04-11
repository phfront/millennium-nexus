import type { Tracker, Log } from '@/types/daily-goals';

/**
 * Melhor pontuação possível no dia para a meta (só trackers com scoring_enabled).
 * Usado para exibir "X de Y pts" e % de pontos.
 */
export function maxPossiblePointsForTracker(tracker: Tracker): number {
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
