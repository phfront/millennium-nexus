'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import { calculatePoints, computeCaloriesWeekPointsByDate, computeMealDiaryWeekPointsByDate } from '@/lib/habits-goals/scoring';
import { getLocalDateStr } from '@/lib/habits-goals/timezone';
import {
  fetchDateBoundsForTrackers,
  getCalendarWeekWindow,
  getPeriodWindowForDate,
  logRowDateForTrackerView,
  sumNumericInWindow,
} from '@/lib/habits-goals/period';
import type { Log, Tracker } from '@/types/habits-goals';
import type { PeriodWindow } from '@/lib/habits-goals/period';

function mondayForDate(dateStr: string): string {
  return getCalendarWeekWindow(dateStr).startStr;
}

function computePointsForUpsert(
  tracker: Tracker,
  partialLog: Partial<Log>,
  logs: Log[],
  targetDate: string,
): number {
  if (tracker.type === 'checklist') {
    return calculatePoints(tracker, partialLog);
  }
  if (
    (tracker.period_aggregation ?? 'single') === 'aggregate' &&
    (tracker.type === 'counter' || tracker.type === 'slider')
  ) {
    const w = getPeriodWindowForDate(tracker, targetDate);
    let sum = sumNumericInWindow(tracker, logs, w);
    const row = logs.find((l) => l.tracker_id === tracker.id && l.created_at === targetDate);
    const oldV = Number(row?.value ?? 0);
    const newV = partialLog.value != null ? Number(partialLog.value) : oldV;
    sum = sum - oldV + newV;
    return calculatePoints(tracker, { ...partialLog, value: sum });
  }
  return calculatePoints(tracker, partialLog);
}

function mergeProjectedLog(
  logs: Log[],
  tracker: Tracker,
  saveDate: string,
  partialLog: Partial<Log>,
): Log[] {
  const projected = logs.map((l) => ({ ...l }));
  const idx = projected.findIndex(
    (l) => l.tracker_id === tracker.id && l.created_at === saveDate,
  );
  if (idx >= 0) {
    projected[idx] = { ...projected[idx], ...partialLog };
  } else {
    projected.push({
      id: `optimistic-${tracker.id}-${saveDate}`,
      tracker_id: tracker.id,
      value: partialLog.value ?? null,
      checked_items: partialLog.checked_items ?? null,
      note: partialLog.note ?? null,
      points_earned: 0,
      created_at: saveDate,
    });
  }
  return projected;
}

/**
 * @param trackers — se definido, carrega logs no intervalo que cobre os períodos
 *   das metas para `targetDate` (necessário para agregados semanais/mensais).
 */
export function useLogs(date?: string, trackers?: Tracker[]) {
  const user = useUserStore((s) => s.user);
  const targetDate = date ?? getLocalDateStr(user?.profile?.timezone);
  const trackerList = trackers ?? [];
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingTrackerId, setSavingTrackerId] = useState<string | null>(null);

  const fetchLogs = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (!silent) setIsLoading(true);
      const supabase = createClient();
      let q = supabase.from('logs').select('*');

      if (trackerList.length > 0) {
        const ids = trackerList.map((t) => t.id);
        const bounds = fetchDateBoundsForTrackers(trackerList, targetDate);
        const min = trackerList.some(
          (tracker) => tracker.source_key === 'calories_burned' || tracker.source_key === 'meal_diary',
        )
          ? [bounds.min, mondayForDate(targetDate)].sort()[0]
          : bounds.min;
        const max = bounds.max;
        q = q.in('tracker_id', ids).gte('created_at', min).lte('created_at', max);
      } else {
        q = q.eq('created_at', targetDate);
      }

      const { data } = await q;
      setLogs((data ?? []) as Log[]);
      if (!silent) setIsLoading(false);
    },
    [user, targetDate, trackerList],
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  async function upsertWeekScoredLog(
    tracker: Tracker,
    partialLog: Partial<Log>,
    computeWeekPoints: (t: Tracker, projected: Log[], weekWindow: PeriodWindow) => Map<string, number>,
  ) {
    const supabase = createClient();
    const saveDate = logRowDateForTrackerView(tracker, targetDate);
    const weekWindow = getCalendarWeekWindow(targetDate);
    const projected = mergeProjectedLog(logs, tracker, saveDate, partialLog);
    const pointsByDate = computeWeekPoints(tracker, projected, weekWindow);
    const targetPoints = pointsByDate.get(saveDate) ?? 0;

    setLogs((prev) => {
      const next = prev.map((l) => {
        if (l.tracker_id !== tracker.id) return l;
        if (l.created_at < weekWindow.startStr || l.created_at > weekWindow.endStr) return l;
        const nextPoints = pointsByDate.get(l.created_at);
        return nextPoints != null ? { ...l, points_earned: nextPoints } : l;
      });

      const exists = next.find((l) => l.tracker_id === tracker.id && l.created_at === saveDate);
      if (exists) {
        return next.map((l) =>
          l.tracker_id === tracker.id && l.created_at === saveDate
            ? { ...l, ...partialLog, points_earned: targetPoints }
            : l,
        );
      }

      return [
        ...next,
        {
          id: `optimistic-${tracker.id}-${saveDate}`,
          tracker_id: tracker.id,
          value: partialLog.value ?? null,
          checked_items: partialLog.checked_items ?? null,
          note: partialLog.note ?? null,
          points_earned: targetPoints,
          created_at: saveDate,
        } as Log,
      ];
    });

    setSavingTrackerId(tracker.id);
    try {
      const { data: saved, error } = await supabase
        .from('logs')
        .upsert(
          {
            tracker_id: tracker.id,
            value: partialLog.value ?? null,
            checked_items: partialLog.checked_items ?? null,
            note: partialLog.note ?? null,
            points_earned: targetPoints,
            created_at: saveDate,
          },
          { onConflict: 'tracker_id,created_at' },
        )
        .select()
        .single();

      if (error) throw new Error(error.message);

      const weekLogs = logs.filter(
        (l) =>
          l.tracker_id === tracker.id &&
          l.created_at >= weekWindow.startStr &&
          l.created_at <= weekWindow.endStr &&
          l.created_at !== saveDate &&
          !l.id.startsWith('optimistic-'),
      );

      for (const row of weekLogs) {
        const nextPoints = pointsByDate.get(row.created_at);
        if (nextPoints == null || Number(row.points_earned) === nextPoints) continue;
        const { error: updateError } = await supabase
          .from('logs')
          .update({ points_earned: nextPoints })
          .eq('id', row.id);
        if (updateError) throw new Error(updateError.message);
      }

      setLogs((prev) => {
        const withoutOptimistic = prev.filter(
          (l) => !(l.tracker_id === tracker.id && l.id.startsWith('optimistic-')),
        );
        const updated = withoutOptimistic.map((l) => {
          if (l.tracker_id !== tracker.id) return l;
          if (l.created_at < weekWindow.startStr || l.created_at > weekWindow.endStr) return l;
          const nextPoints = pointsByDate.get(l.created_at);
          return nextPoints != null ? { ...l, points_earned: nextPoints } : l;
        });
        const hasSaved = updated.some(
          (l) => l.tracker_id === tracker.id && l.created_at === saveDate,
        );
        return hasSaved ? updated : [...updated, saved as Log];
      });

      await fetchLogs(true);
      return saved as Log;
    } finally {
      setSavingTrackerId(null);
    }
  }

  async function upsertCaloriesLog(tracker: Tracker, partialLog: Partial<Log>) {
    return upsertWeekScoredLog(tracker, partialLog, computeCaloriesWeekPointsByDate);
  }

  async function upsertMealDiaryLog(tracker: Tracker, partialLog: Partial<Log>) {
    return upsertWeekScoredLog(tracker, partialLog, computeMealDiaryWeekPointsByDate);
  }

  async function upsertLog(tracker: Tracker, partialLog: Partial<Log>) {
    if (tracker.source_key === 'calories_burned') {
      return upsertCaloriesLog(tracker, partialLog);
    }
    if (tracker.source_key === 'meal_diary') {
      return upsertMealDiaryLog(tracker, partialLog);
    }

    const supabase = createClient();
    const saveDate = logRowDateForTrackerView(tracker, targetDate);
    const points_earned = computePointsForUpsert(tracker, partialLog, logs, targetDate);

    setLogs((prev) => {
      const rowDate = saveDate;
      const exists = prev.find((l) => l.tracker_id === tracker.id && l.created_at === rowDate);
      if (exists) {
        return prev.map((l) =>
          l.tracker_id === tracker.id && l.created_at === rowDate
            ? { ...l, ...partialLog, points_earned }
            : l,
        );
      }
      return [
        ...prev,
        {
          id: `optimistic-${tracker.id}`,
          tracker_id: tracker.id,
          value: partialLog.value ?? null,
          checked_items: partialLog.checked_items ?? null,
          note: partialLog.note ?? null,
          points_earned,
          created_at: rowDate,
        } as Log,
      ];
    });

    setSavingTrackerId(tracker.id);
    try {
      const { data, error } = await supabase
        .from('logs')
        .upsert(
          {
            tracker_id: tracker.id,
            value: partialLog.value ?? null,
            checked_items: partialLog.checked_items ?? null,
            note: partialLog.note ?? null,
            points_earned,
            created_at: saveDate,
          },
          { onConflict: 'tracker_id,created_at' },
        )
        .select()
        .single();

      if (error) throw new Error(error.message);

      setLogs((prev) => {
        const filtered = prev.filter(
          (l) => !(l.tracker_id === tracker.id && l.created_at === saveDate),
        );
        return [...filtered, data as Log];
      });

      fetchLogs(true);

      return data as Log;
    } finally {
      setSavingTrackerId(null);
    }
  }

  function getLogForTracker(tracker: Tracker): Log | null {
    const rowDate = logRowDateForTrackerView(tracker, targetDate);
    return logs.find((l) => l.tracker_id === tracker.id && l.created_at === rowDate) ?? null;
  }

  return { logs, isLoading, savingTrackerId, refetch: fetchLogs, upsertLog, getLogForTracker };
}
