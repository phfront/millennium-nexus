'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import type { DietLog, AdherenceDay } from '@/types/nutrition';
import { formatDateISO, sumPlannedKcalFromMeals } from '@/lib/health/nutrition';
import { fetchActiveDietPlanMeals } from '@/lib/health/fetch-active-diet-plan-meals';

/**
 * Hook para preparar dados de gráficos de aderência à dieta.
 */
export function useDietChartData(days = 30) {
  const user = useUserStore((s) => s.user);
  const [chartData, setChartData] = useState<AdherenceDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchChartData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const supabase = createClient();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days + 1);

    const from = formatDateISO(startDate);
    const to = formatDateISO(endDate);

    // Busca logs no período
    const { data: logsData } = await supabase
      .from('diet_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('logged_date', from)
      .lte('logged_date', to)
      .order('logged_date', { ascending: true });

    const planMeals = await fetchActiveDietPlanMeals(supabase, user.id);
    const dailyTarget = sumPlannedKcalFromMeals(planMeals);

    const logs = (logsData ?? []) as DietLog[];

    // Agrupa por dia
    const byDate = new Map<string, DietLog[]>();
    for (const log of logs) {
      const existing = byDate.get(log.logged_date) ?? [];
      existing.push(log);
      byDate.set(log.logged_date, existing);
    }

    // Gera dados para cada dia no range
    const adherenceData: AdherenceDay[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = formatDateISO(current);
      const dayLogs = byDate.get(dateStr) ?? [];
      const consumed = dayLogs
        .filter((l) => !l.is_extra)
        .reduce((sum, l) => sum + l.kcal, 0);
      const extra = dayLogs
        .filter((l) => l.is_extra)
        .reduce((sum, l) => sum + l.kcal, 0);

      const ratio = dailyTarget > 0 ? consumed / dailyTarget : 0;
      const deviation = Math.abs(1 - ratio);
      const adherence = dayLogs.length > 0
        ? Math.max(0, Math.round((1 - deviation) * 100))
        : 0;

      adherenceData.push({
        date: dateStr,
        planned_kcal: dailyTarget,
        consumed_kcal: consumed,
        extra_kcal: extra,
        adherence_percent: adherence,
      });

      current.setDate(current.getDate() + 1);
    }

    setChartData(adherenceData);
    setIsLoading(false);
  }, [user, days]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  // Médias de aderência
  const last7 = chartData.slice(-7);
  const last30 = chartData;

  const avg7 =
    last7.length > 0
      ? Math.round(last7.reduce((s, d) => s + d.adherence_percent, 0) / last7.length)
      : 0;
  const avg30 =
    last30.length > 0
      ? Math.round(last30.reduce((s, d) => s + d.adherence_percent, 0) / last30.length)
      : 0;

  const activeDays7 = last7.filter((d) => d.consumed_kcal > 0).length;
  const activeDays30 = last30.filter((d) => d.consumed_kcal > 0).length;

  return {
    chartData,
    avg7,
    avg30,
    activeDays7,
    activeDays30,
    isLoading,
    refetch: fetchChartData,
  };
}
