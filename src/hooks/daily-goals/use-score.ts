'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';

export function useScore() {
  const user = useUserStore((s) => s.user);
  const today = new Date().toISOString().split('T')[0];
  const [dailyScore, setDailyScore] = useState<number>(0);
  const [totalScore, setTotalScore] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchScores = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const [{ data: daily, error: dailyErr }, { data: total, error: totalErr }] = await Promise.all([
      supabase
        .from('daily_scores')
        .select('daily_score')
        .eq('user_id', user.id)
        .eq('score_date', today)
        .maybeSingle(),
      supabase
        .from('total_scores')
        .select('total_score')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);
    if (!dailyErr) setDailyScore(Number(daily?.daily_score ?? 0));
    if (!totalErr) setTotalScore(Number(total?.total_score ?? 0));
    setIsLoading(false);
  }, [user, today]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  return { dailyScore, totalScore, isLoading, refetch: fetchScores };
}
