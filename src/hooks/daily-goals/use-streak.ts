'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';

export function useStreak() {
  const user = useUserStore((s) => s.user);
  const [streak, setStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from('current_streaks')
      .select('current_streak')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setIsLoading(false);
          return;
        }
        setStreak(Number(data?.current_streak ?? 0));
        setIsLoading(false);
      });
  }, [user]);

  return { streak, isLoading };
}
