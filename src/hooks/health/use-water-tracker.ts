'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import type { WaterLog } from '@/types/nutrition';
import { todayISO, calcWaterProgress } from '@/lib/health/nutrition';

/**
 * Hook para controle de hidratação.
 */
export function useWaterTracker(targetMl = 2500) {
  const user = useUserStore((s) => s.user);
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const today = todayISO();

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('water_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('logged_date', today)
      .order('logged_at', { ascending: true });

    setLogs((data ?? []) as WaterLog[]);
    setIsLoading(false);
  }, [user, today]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  async function addWater(amountMl: number) {
    if (!user) throw new Error('Não autenticado');
    const supabase = createClient();
    const { data, error } = await supabase
      .from('water_logs')
      .insert({
        user_id: user.id,
        logged_date: today,
        amount_ml: amountMl,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const newLog = data as WaterLog;
    setLogs((prev) => [...prev, newLog]);
    return newLog;
  }

  async function removeWater(logId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('water_logs')
      .delete()
      .eq('id', logId);
    if (error) throw new Error(error.message);
    setLogs((prev) => prev.filter((l) => l.id !== logId));
  }

  const totalMl = logs.reduce((sum, l) => sum + l.amount_ml, 0);
  const progress = calcWaterProgress(totalMl, targetMl);

  return {
    logs,
    totalMl,
    targetMl,
    progress,
    isLoading,
    refetch: fetchLogs,
    addWater,
    removeWater,
  };
}
