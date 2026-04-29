import type { Tracker } from '@/types/habits-goals';
import { formatDateInTimezone } from '@/lib/habits-goals/timezone';

/** Data de início efetiva para agendamento (ISO 'YYYY-MM-DD'). */
export function effectiveTrackerStartDate(tracker: Tracker, timezone?: string | null): string {
  const createdDay = formatDateInTimezone(tracker.created_at, timezone);
  if (!tracker.start_date) return createdDay;
  // Nunca mostrar dias anteriores à existência da meta no histórico
  return tracker.start_date > createdDay ? tracker.start_date : createdDay;
}

/**
 * Verifica se um tracker deve aparecer no dashboard para a data informada,
 * levando em conta recurrence_days, start_date, data de criação e end_date.
 *
 * Regras:
 *  - Data efetiva de início = start_date (se informada) ou dia de criação da meta;
 *    nunca antes do dia em que a meta foi criada (no fuso do perfil).
 *  - Se dateStr < início efetivo → não exibir
 *  - Se end_date definido   e dateStr > end_date    → não exibir
 *  - Se recurrence_days definido e o dia da semana não está na lista → não exibir
 *  - Caso contrário → exibir
 */
export function isTrackerScheduledForDate(
  tracker: Tracker,
  dateStr: string,
  timezone?: string | null,
): boolean {
  const start = effectiveTrackerStartDate(tracker, timezone);
  if (dateStr < start) return false;
  if (tracker.end_date && dateStr > tracker.end_date) return false;

  if (tracker.recurrence_days && tracker.recurrence_days.length > 0) {
    // Parseamos a data como local para evitar desvios de timezone
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dow = date.getDay(); // 0=Dom, 1=Seg, … 6=Sáb
    if (!tracker.recurrence_days.includes(dow)) return false;
  }

  return true;
}

/** Rótulos curtos dos dias da semana (índice 0=Dom … 6=Sáb) */
export const WEEK_DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
