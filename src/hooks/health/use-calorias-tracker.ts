'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import type { CaloriasLog, CaloriasSettings } from '@/types/calorias';
import { todayISO } from '@/lib/health/nutrition';
import {
  addDaysISO,
  calcCaloriasProgress,
  caloriasHistoryFetchBounds,
  dailyTotals,
  effectiveTargetForDay,
  enumerateWeekDatesISO,
  weekBoundsForReference,
  weeklyRemainingKcal,
  weeklyTargetKcal,
  weeklyTotal,
} from '@/lib/health/calorias';

export function useCaloriasTracker(settings: CaloriasSettings | null) {
  const user = useUserStore((s) => s.user);
  const [rangeLogs, setRangeLogs] = useState<CaloriasLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const weekBounds = useMemo(() => weekBoundsForReference(new Date()), []);
  const today = todayISO();

  /** Janela alargada (≈90d + segunda da semana) para gráfico e metas com rollover. */
  const { fetchStart, fetchEnd } = useMemo(() => {
    const visStart = addDaysISO(today, -89);
    return caloriasHistoryFetchBounds(visStart, weekBounds.sunday);
  }, [today, weekBounds.sunday]);

  const logs = useMemo(
    () =>
      rangeLogs.filter(
        (l) => l.logged_date >= weekBounds.monday && l.logged_date <= weekBounds.sunday,
      ),
    [rangeLogs, weekBounds.monday, weekBounds.sunday],
  );

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('calorias_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('logged_date', fetchStart)
      .lte('logged_date', fetchEnd)
      .order('logged_at', { ascending: true });
    if (error) {
      setRangeLogs([]);
      setIsLoading(false);
      return;
    }
    setRangeLogs((data ?? []) as CaloriasLog[]);
    setIsLoading(false);
  }, [user, fetchStart, fetchEnd]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  async function addKcal(amountKcal: number, note?: string | null, loggedDate?: string) {
    if (!user) throw new Error('Não autenticado');
    if (amountKcal <= 0) throw new Error('Valor inválido');
    const date = loggedDate ?? today;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('calorias_logs')
      .insert({
        user_id: user.id,
        logged_date: date,
        amount_kcal: amountKcal,
        note: note?.trim() || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const row = data as CaloriasLog;
    if (row.logged_date >= fetchStart && row.logged_date <= fetchEnd) {
      setRangeLogs((prev) => [...prev, row].sort((a, b) => a.logged_at.localeCompare(b.logged_at)));
    } else {
      void fetchLogs();
    }
    return row;
  }

  async function removeLog(logId: string) {
    if (!user) throw new Error('Não autenticado');
    const supabase = createClient();
    const { error } = await supabase.from('calorias_logs').delete().eq('id', logId).eq('user_id', user.id);
    if (error) throw new Error(error.message);
    setRangeLogs((prev) => prev.filter((l) => l.id !== logId));
  }

  function sortLogsNewestFirst(a: CaloriasLog, b: CaloriasLog): number {
    if (a.logged_at === b.logged_at) return a.id.localeCompare(b.id);
    return a.logged_at > b.logged_at ? -1 : 1;
  }

  async function undoLast() {
    const todayLogs = logs.filter((l) => l.logged_date === today);
    if (todayLogs.length === 0) return;
    const last = [...todayLogs].sort(sortLogsNewestFirst)[0];
    await removeLog(last.id);
  }

  async function undoLastForDate(loggedDate: string) {
    const dayLogs = logs.filter((l) => l.logged_date === loggedDate);
    if (dayLogs.length === 0) return;
    const last = [...dayLogs].sort(sortLogsNewestFirst)[0];
    await removeLog(last.id);
  }

  const derived = useMemo(() => {
    if (!settings) {
      return {
        dailyTotalsMap: {} as Record<string, number>,
        weekTotalKcal: 0,
        weeklyTargetKcal: 0,
        weeklyRemaining: 0,
        effectiveTargetToday: 0,
        todayTotal: 0,
        todayRemaining: 0,
        progressToday: 0,
        weekDates: enumerateWeekDatesISO(weekBounds.monday, weekBounds.sunday),
      };
    }
    const dailyTotalsMap = dailyTotals(logs, weekBounds);
    const weekTotalKcal = weeklyTotal(logs, weekBounds);
    const wTarget = weeklyTargetKcal(settings);
    const wRem = weeklyRemainingKcal(weekTotalKcal, settings);
    const effectiveTargetToday = effectiveTargetForDay(today, settings, logs, weekBounds);
    const todayTotal = dailyTotalsMap[today] ?? 0;
    const todayRemaining = Math.max(0, effectiveTargetToday - todayTotal);
    const progressToday = calcCaloriasProgress(todayTotal, effectiveTargetToday);
    return {
      dailyTotalsMap,
      weekTotalKcal,
      weeklyTargetKcal: wTarget,
      weeklyRemaining: wRem,
      effectiveTargetToday,
      todayTotal,
      todayRemaining,
      progressToday,
      weekDates: enumerateWeekDatesISO(weekBounds.monday, weekBounds.sunday),
    };
  }, [logs, settings, today, weekBounds]);

  return {
    logs,
    evolutionLogs: rangeLogs,
    isLoading,
    refetch: fetchLogs,
    addKcal,
    removeLog,
    undoLast,
    undoLastForDate,
    weekBounds,
    today,
    ...derived,
  };
}
