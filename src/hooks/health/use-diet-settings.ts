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
    const row = data as DietSettings | null;
    setSettings(
      row
        ? {
            ...row,
            meal_reminder_push_enabled: row.meal_reminder_push_enabled ?? false,
            meal_reminder_lead_minutes: row.meal_reminder_lead_minutes ?? 15,
          }
        : null,
    );
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function upsertSettings(
    values: Partial<Omit<DietSettings, 'user_id' | 'created_at' | 'updated_at'>>,
  ) {
    if (!user) return;
    const supabase = createClient();
    const merged = {
      weekly_extra_buffer: values.weekly_extra_buffer ?? settings?.weekly_extra_buffer ?? 0,
      daily_water_target_ml: values.daily_water_target_ml ?? settings?.daily_water_target_ml ?? 2500,
      meal_reminder_push_enabled:
        values.meal_reminder_push_enabled ?? settings?.meal_reminder_push_enabled ?? false,
      meal_reminder_lead_minutes:
        values.meal_reminder_lead_minutes ?? settings?.meal_reminder_lead_minutes ?? 15,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('diet_settings')
      .upsert(merged, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    setSettings(data as DietSettings);
    return data as DietSettings;
  }

  return { settings, isLoading, refetch: fetchSettings, upsertSettings };
}
