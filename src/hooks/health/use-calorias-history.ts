'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import type { CaloriasLog, CaloriasSettings } from '@/types/calorias';
import { todayISO } from '@/lib/health/nutrition';
import {
  addDaysISO,
  buildCaloriasHistoryDayRows,
  buildCaloriasHistoryMonthRows,
  buildCaloriasHistoryWeekRows,
  caloriasHistoryFetchBounds,
} from '@/lib/health/calorias';

export const CALORIAS_HISTORY_PRESET_DAYS = [7, 30, 90] as const;
export type CaloriasHistoryPresetDays = (typeof CALORIAS_HISTORY_PRESET_DAYS)[number];

export function useCaloriasHistory(
  settings: CaloriasSettings | null,
  presetDays: CaloriasHistoryPresetDays,
) {
  const user = useUserStore((s) => s.user);
  const [logs, setLogs] = useState<CaloriasLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const today = todayISO();

  const { visibleStart, visibleEnd, fetchStart, fetchEnd } = useMemo(() => {
    const visibleEnd = today;
    const visibleStart = addDaysISO(today, -(presetDays - 1));
    const { fetchStart, fetchEnd } = caloriasHistoryFetchBounds(visibleStart, visibleEnd);
    return { visibleStart, visibleEnd, fetchStart, fetchEnd };
  }, [today, presetDays]);

  const fetchLogs = useCallback(async () => {
    if (!user) {
      setLogs([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('calorias_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('logged_date', fetchStart)
      .lte('logged_date', fetchEnd)
      .order('logged_date', { ascending: false })
      .order('logged_at', { ascending: false });
    if (error) {
      setLogs([]);
      setIsLoading(false);
      return;
    }
    setLogs((data ?? []) as CaloriasLog[]);
    setIsLoading(false);
  }, [user, fetchStart, fetchEnd]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const dayRows = useMemo(() => {
    if (!settings) return [];
    return buildCaloriasHistoryDayRows(logs, settings, visibleStart, visibleEnd);
  }, [logs, settings, visibleStart, visibleEnd]);

  const weekRows = useMemo(() => {
    if (!settings) return [];
    return buildCaloriasHistoryWeekRows(logs, settings, visibleStart, visibleEnd);
  }, [logs, settings, visibleStart, visibleEnd]);

  const monthRows = useMemo(() => {
    if (!settings) return [];
    return buildCaloriasHistoryMonthRows(logs, settings, visibleStart, visibleEnd);
  }, [logs, settings, visibleStart, visibleEnd]);

  async function removeLog(logId: string) {
    if (!user) throw new Error('Não autenticado');
    const supabase = createClient();
    const { error } = await supabase.from('calorias_logs').delete().eq('id', logId).eq('user_id', user.id);
    if (error) throw new Error(error.message);
    setLogs((prev) => prev.filter((l) => l.id !== logId));
  }

  async function addKcal(amountKcal: number, note: string | null | undefined, loggedDate: string) {
    if (!user) throw new Error('Não autenticado');
    if (amountKcal <= 0) throw new Error('Valor inválido');
    const supabase = createClient();
    const { data, error } = await supabase
      .from('calorias_logs')
      .insert({
        user_id: user.id,
        logged_date: loggedDate,
        amount_kcal: amountKcal,
        note: note?.trim() || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const row = data as CaloriasLog;
    if (row.logged_date >= fetchStart && row.logged_date <= fetchEnd) {
      setLogs((prev) =>
        [...prev, row].sort((a, b) => {
          if (a.logged_date !== b.logged_date) return b.logged_date.localeCompare(a.logged_date);
          return b.logged_at.localeCompare(a.logged_at);
        }),
      );
    }
    return row;
  }

  return {
    logs,
    isLoading,
    refetch: fetchLogs,
    removeLog,
    addKcal,
    dayRows,
    weekRows,
    monthRows,
    visibleStart,
    visibleEnd,
    fetchStart,
    fetchEnd,
  };
}
