'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import { calculatePoints } from '@/lib/habits-goals/scoring';
import { getLocalDateStr } from '@/lib/habits-goals/timezone';
import {
  fetchDateBoundsForTrackers,
  getPeriodWindowForDate,
  logRowDateForTrackerView,
  sumNumericInWindow,
} from '@/lib/habits-goals/period';
import type { Log, Tracker } from '@/types/habits-goals';

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
        const { min, max } = fetchDateBoundsForTrackers(trackerList, targetDate);
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

  async function upsertLog(tracker: Tracker, partialLog: Partial<Log>) {
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
