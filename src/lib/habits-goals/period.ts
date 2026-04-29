import type { Log, Tracker } from '@/types/habits-goals';

export type PeriodWindow = { startStr: string; endStr: string };

function parseYmd(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

function formatYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Janela do período que contém `dateStr` (datas civis YYYY-MM-DD). Alinhado a `tracker_period_start` no SQL. */
export function getPeriodWindowForDate(tracker: Tracker, dateStr: string): PeriodWindow {
  const pk = tracker.period_kind ?? 'daily';
  if (pk === 'daily') {
    return { startStr: dateStr, endStr: dateStr };
  }

  if (pk === 'weekly') {
    const ws = tracker.week_start ?? 1;
    const { y, m, d } = parseYmd(dateStr);
    const dt = new Date(y, m - 1, d);
    const dow = dt.getDay();
    const off = (dow - ws + 7) % 7;
    dt.setDate(dt.getDate() - off);
    const startStr = formatYmd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
    const endDt = new Date(dt);
    endDt.setDate(endDt.getDate() + 6);
    const endStr = formatYmd(endDt.getFullYear(), endDt.getMonth() + 1, endDt.getDate());
    return { startStr, endStr };
  }

  if (pk === 'monthly') {
    const { y, m } = parseYmd(dateStr);
    const startStr = formatYmd(y, m, 1);
    const last = new Date(y, m, 0).getDate();
    const endStr = formatYmd(y, m, last);
    return { startStr, endStr };
  }

  // custom
  const anchor = tracker.period_anchor_date;
  const len = tracker.period_length_days ?? 7;
  if (!anchor || len < 1) {
    return { startStr: dateStr, endStr: dateStr };
  }
  const { y: ay, m: am, d: ad } = parseYmd(anchor);
  const { y: ry, m: rm, d: rd } = parseYmd(dateStr);
  const a = new Date(ay, am - 1, ad);
  const r = new Date(ry, rm - 1, rd);
  const diffDays = Math.floor((r.getTime() - a.getTime()) / 86400000);
  const epoch = Math.floor(diffDays / len);
  const start = new Date(a);
  start.setDate(start.getDate() + epoch * len);
  const end = new Date(start);
  end.setDate(end.getDate() + len - 1);
  return {
    startStr: formatYmd(start.getFullYear(), start.getMonth() + 1, start.getDate()),
    endStr: formatYmd(end.getFullYear(), end.getMonth() + 1, end.getDate()),
  };
}

/** Data da linha em `logs` para a vista `viewDate`. */
export function logRowDateForTrackerView(tracker: Tracker, viewDate: string): string {
  if ((tracker.period_aggregation ?? 'single') === 'aggregate') {
    return viewDate;
  }
  return getPeriodWindowForDate(tracker, viewDate).startStr;
}

export function fetchDateBoundsForTrackers(trackers: Tracker[], targetDate: string): {
  min: string;
  max: string;
} {
  let min = targetDate;
  let max = targetDate;
  for (const t of trackers) {
    const w = getPeriodWindowForDate(t, targetDate);
    if (w.startStr < min) min = w.startStr;
    if (w.endStr > max) max = w.endStr;
  }
  return { min, max };
}

/** Soma `value` dos logs do tracker na janela (counter/slider). */
export function sumNumericInWindow(tracker: Tracker, logs: Log[], window: PeriodWindow): number {
  return logs
    .filter(
      (l) =>
        l.tracker_id === tracker.id &&
        l.created_at >= window.startStr &&
        l.created_at <= window.endStr,
    )
    .reduce((s, l) => s + Number(l.value ?? 0), 0);
}

/** Período imediatamente anterior ao que contém `window.startStr` (útil para histórico). */
export function getPreviousPeriodWindow(tracker: Tracker, window: PeriodWindow): PeriodWindow {
  const { y, m, d } = parseYmd(window.startStr);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const prevStr = formatYmd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  return getPeriodWindowForDate(tracker, prevStr);
}

/** Conclusão numa janela (para histórico / push), com base nos logs nesse intervalo. */
export function isPeriodCompleteFromLogs(
  tracker: Tracker,
  window: PeriodWindow,
  logs: Log[],
): boolean {
  const inWin = logs.filter(
    (l) =>
      l.tracker_id === tracker.id &&
      l.created_at >= window.startStr &&
      l.created_at <= window.endStr,
  );
  const goal = Number(tracker.goal_value ?? 0);
  const agg = (tracker.period_aggregation ?? 'single') === 'aggregate';

  if (tracker.type === 'boolean') {
    return inWin.some((l) => l.value === 1);
  }
  if (tracker.type === 'checklist') {
    const itemsLen = tracker.checklist_items?.length ?? 0;
    if (itemsLen === 0) return false;
    if (agg) {
      return inWin.some((l) => {
        const c = l.checked_items ?? [];
        return c.length >= itemsLen && c.every(Boolean);
      });
    }
    const row = inWin.find((l) => l.created_at === window.startStr);
    const c = row?.checked_items ?? [];
    return c.length >= itemsLen && c.every(Boolean);
  }
  if (tracker.type === 'counter' || tracker.type === 'slider') {
    const sum = inWin.reduce((s, l) => s + Number(l.value ?? 0), 0);
    if (agg) return sum >= goal;
    const row = inWin.find((l) => l.created_at === window.startStr);
    return Number(row?.value ?? 0) >= goal;
  }
  return false;
}

export function isTrackerCompletedForView(
  tracker: Tracker,
  log: Log | null,
  periodSum: number | null,
  effectiveGoal: number | null,
): boolean {
  const goal = effectiveGoal ?? 0;
  if (tracker.type === 'boolean') return log?.value === 1;
  if (tracker.type === 'checklist') return (log?.checked_items ?? []).every(Boolean);
  if (tracker.type === 'counter' || tracker.type === 'slider') {
    if ((tracker.period_aggregation ?? 'single') === 'aggregate' && periodSum != null) {
      return periodSum >= goal;
    }
    return (log?.value ?? 0) >= goal;
  }
  return false;
}
