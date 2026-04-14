'use server';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/auth-types';

async function getAuthenticatedClient() {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return { supabase: null, userId: null };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminSupabase = supabaseUrl && serviceRoleKey
    ? createSupabaseClient(supabaseUrl, serviceRoleKey)
    : null;

  // Fallback para client autenticado quando service role não está disponível.
  return { supabase: adminSupabase ?? userSupabase, userId: user.id };
}

export async function updateProfileBasicInfo(
  fullName: string,
  avatarUrl: string | null,
  timezone: string
): Promise<{ success: boolean; data?: Profile; error?: string }> {
  try {
    const { supabase, userId } = await getAuthenticatedClient();
    if (!supabase || !userId) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        avatar_url: avatarUrl,
        timezone,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', userId);

    if (error) return { success: false, error: error.message };

    const { data, error: selectError } = await supabase
      .from('profiles').select().eq('id', userId).maybeSingle();

    if (selectError || !data) return { success: false, error: selectError?.message || 'Failed to update profile' };

    return { success: true, data: data as Profile };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function resetBrandColors(): Promise<{ success: boolean; data?: Profile; error?: string }> {
  try {
    const RASTER_BRAND_PRIMARY_HEX = '#006437';
    const RASTER_BRAND_SECONDARY_HEX = '#beac4e';

    const { supabase, userId } = await getAuthenticatedClient();
    if (!supabase || !userId) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
      .from('profiles')
      .update({
        brand_primary_hex: RASTER_BRAND_PRIMARY_HEX,
        brand_secondary_hex: RASTER_BRAND_SECONDARY_HEX,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', userId);

    if (error) return { success: false, error: error.message };

    const { data, error: selectError } = await supabase
      .from('profiles').select().eq('id', userId).maybeSingle();

    if (selectError || !data) return { success: false, error: selectError?.message || 'Failed to reset colors' };

    return { success: true, data: data as Profile };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function saveBrandColors(
  primaryHex: string | null,
  secondaryHex: string | null
): Promise<{ success: boolean; data?: Profile; error?: string }> {
  try {
    const { supabase, userId } = await getAuthenticatedClient();
    if (!supabase || !userId) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
      .from('profiles')
      .update({
        brand_primary_hex: primaryHex,
        brand_secondary_hex: secondaryHex,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', userId);

    if (error) return { success: false, error: error.message };

    const { data, error: selectError } = await supabase
      .from('profiles').select().eq('id', userId).maybeSingle();

    if (selectError || !data) return { success: false, error: selectError?.message || 'Failed to save colors' };

    return { success: true, data: data as Profile };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function updateAIConfig(
  aiProvider: string | null,
  aiApiKey: string | null,
  aiModel: string | null
): Promise<{ success: boolean; data?: Profile; error?: string }> {
  try {
    const { supabase, userId } = await getAuthenticatedClient();
    if (!supabase || !userId) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
      .from('profiles')
      .update({
        ai_provider: aiProvider,
        ai_api_key: aiApiKey,
        ai_model: aiModel,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', userId);

    if (error) return { success: false, error: error.message };

    const { data, error: selectError } = await supabase
      .from('profiles').select().eq('id', userId).maybeSingle();

    if (selectError || !data) return { success: false, error: selectError?.message || 'Failed to fetch AI config' };

    return { success: true, data: data as Profile };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function updateThemePreference(
  theme: 'dark' | 'light'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, userId } = await getAuthenticatedClient();
    if (!supabase || !userId) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
      .from('profiles')
      .update({ theme_preference: theme } as never)
      .eq('id', userId);

    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
