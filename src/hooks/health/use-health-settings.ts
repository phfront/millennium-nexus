'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import type { HealthSettings } from '@/types/health';

export function useHealthSettings() {
  const user = useUserStore((s) => s.user);
  const [settings, setSettings] = useState<HealthSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('health_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    setSettings(data as HealthSettings | null);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function upsertSettings(values: Omit<HealthSettings, 'user_id' | 'created_at' | 'updated_at'>) {
    if (!user) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('health_settings')
      .upsert(
        { ...values, user_id: user.id, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    setSettings(data as HealthSettings);
    return data as HealthSettings;
  }

  return { settings, isLoading, refetch: fetchSettings, upsertSettings };
}
