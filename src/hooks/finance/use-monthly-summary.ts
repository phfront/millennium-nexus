'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import { usePlanningHorizonListener } from '@/hooks/finance/use-planning-horizon-listener';
import type { MonthlySummary } from '@/types/finance';

export function useMonthlySummary() {
  const user = useUserStore((s) => s.user);
  const [summaries, setSummaries] = useState<MonthlySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('finance_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .order('month', { ascending: true });
    setSummaries((data ?? []) as MonthlySummary[]);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);
  usePlanningHorizonListener(fetch);

  function getSummaryForMonth(month: string): MonthlySummary | null {
    return summaries.find((s) => s.month === month) ?? null;
  }

  return { summaries, isLoading, refetch: fetch, getSummaryForMonth };
}
