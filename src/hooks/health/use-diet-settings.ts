'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import type { DietSettings } from '@/types/nutrition';

export function useDietSettings() {
  const user = useUserStore((s) => s.user);
  const [settings, setSettings] = useState<DietSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('diet_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    setSettings(data as DietSettings | null);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function upsertSettings(
    values: Omit<DietSettings, 'user_id' | 'created_at' | 'updated_at'>,
  ) {
    if (!user) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('diet_settings')
      .upsert(
        { ...values, user_id: user.id, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    setSettings(data as DietSettings);
    return data as DietSettings;
  }

  return { settings, isLoading, refetch: fetchSettings, upsertSettings };
}
