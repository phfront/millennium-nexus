'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import type { CaloriasSettings } from '@/types/calorias';

export function useCaloriasSettings() {
  const user = useUserStore((s) => s.user);
  const [settings, setSettings] = useState<CaloriasSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('calorias_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    setSettings((data as CaloriasSettings | null) ?? null);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  async function upsertSettings(
    values: Partial<Pick<CaloriasSettings, 'daily_target_kcal' | 'active_days'>>,
  ) {
    if (!user) return;
    const supabase = createClient();
    const merged = {
      user_id: user.id,
      daily_target_kcal: values.daily_target_kcal ?? settings?.daily_target_kcal ?? 400,
      active_days: values.active_days ?? settings?.active_days ?? 31,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('calorias_settings')
      .upsert(merged, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    setSettings(data as CaloriasSettings);
    return data as CaloriasSettings;
  }

  return { settings, isLoading, refetch: fetchSettings, upsertSettings };
}
