'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import { calculatePoints } from '@/lib/daily-goals/scoring';
import { getLocalDateStr } from '@/lib/daily-goals/timezone';
import type { Log, Tracker } from '@/types/daily-goals';

export function useLogs(date?: string) {
  const user = useUserStore((s) => s.user);
  const targetDate = date ?? getLocalDateStr(user?.profile?.timezone);
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingTrackerId, setSavingTrackerId] = useState<string | null>(null);

  // silent=true evita mostrar o skeleton global ao refetch pós-upsert
  const fetchLogs = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setIsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('logs')
      .select('*')
      .eq('created_at', targetDate);
    setLogs((data ?? []) as Log[]);
    if (!silent) setIsLoading(false);
  }, [user, targetDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  async function upsertLog(tracker: Tracker, partialLog: Partial<Log>) {
    const supabase = createClient();
    // Salva sempre na data que este hook está observando (hoje ou data do histórico)
    const saveDate = targetDate;
    const points_earned = calculatePoints(tracker, partialLog);

    // Optimistic update imediato — usuário vê a mudança sem esperar o servidor
    setLogs((prev) => {
      const exists = prev.find((l) => l.tracker_id === tracker.id);
      if (exists) {
        return prev.map((l) =>
          l.tracker_id === tracker.id
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
          created_at: saveDate,
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

      // Substitui o optimistic com o dado real do servidor
      setLogs((prev) =>
        prev.map((l) => (l.tracker_id === tracker.id ? (data as Log) : l)),
      );

      // Refetch silencioso para manter consistência (sem skeleton)
      fetchLogs(true);

      return data as Log;
    } finally {
      setSavingTrackerId(null);
    }
  }

  function getLogForTracker(trackerId: string): Log | null {
    return logs.find((l) => l.tracker_id === trackerId) ?? null;
  }

  return { logs, isLoading, savingTrackerId, refetch: fetchLogs, upsertLog, getLogForTracker };
}
