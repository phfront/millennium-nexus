'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUserStore } from '@/store/user-store';
import { createClient } from '@/lib/supabase/client';
import type { FinanceMonthSnapshot } from '@/types/finance';

export function useFinanceMonthSnapshots() {
  const user = useUserStore((s) => s.user);
  const [snapshots, setSnapshots] = useState<FinanceMonthSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user?.id) {
      setSnapshots([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const supabase = createClient();
    await supabase.rpc('finance_ensure_month_snapshots');
    const { data, error } = await supabase
      .from('finance_month_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .order('month', { ascending: false });
    if (error) {
      setSnapshots([]);
    } else {
      setSnapshots((data ?? []) as FinanceMonthSnapshot[]);
    }
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return { snapshots, isLoading, refetch: fetchAll };
}
