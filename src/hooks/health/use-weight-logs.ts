'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import type { WeightLog } from '@/types/health';

export function useWeightLogs(limit?: number) {
  const user = useUserStore((s) => s.user);
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    let query = supabase
      .from('weight_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, count } = await query;
    setLogs((data ?? []) as WeightLog[]);
    setTotal(count ?? 0);
    setIsLoading(false);
  }, [user, limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  async function addLog(values: { weight: number; logged_at: string; note?: string }) {
    if (!user) throw new Error('Não autenticado');
    const supabase = createClient();
    const { data, error } = await supabase
      .from('weight_logs')
      .insert({ ...values, user_id: user.id, note: values.note ?? null })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new Error('duplicate');
      throw new Error(error.message);
    }
    setLogs((prev) => [data as WeightLog, ...prev]);
    setTotal((t) => t + 1);
    return data as WeightLog;
  }

  async function deleteLog(id: string) {
    if (!user) return;
    const supabase = createClient();
    const { error } = await supabase.from('weight_logs').delete().eq('id', id);
    if (error) throw new Error(error.message);
    setLogs((prev) => prev.filter((l) => l.id !== id));
    setTotal((t) => t - 1);
  }

  const latestLog = logs.length > 0 ? logs[0] : null;
  const previousLog = logs.length > 1 ? logs[1] : null;

  return { logs, isLoading, total, latestLog, previousLog, refetch: fetchLogs, addLog, deleteLog };
}
