'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import type { HealthSummary } from '@/types/health';

export function useHealthSummary() {
  const user = useUserStore((s) => s.user);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('health_summary')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    setSummary(data as HealthSummary | null);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, isLoading, refetch: fetchSummary };
}
