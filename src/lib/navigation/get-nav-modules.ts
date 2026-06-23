import { createClient } from '@/lib/supabase/server';
import { fetchDeniedModuleIdsForUser, filterModulesForNav } from '@/lib/modules/access';
import type { Module } from '@/types/database';

export async function getNavModulesForUser(userId: string): Promise<Module[]> {
  const supabase = await createClient();
  const [{ data: modulesData }, deniedModuleIds] = await Promise.all([
    supabase.from('modules').select('*').order('sort_order', { ascending: true }),
    fetchDeniedModuleIdsForUser(supabase, userId),
  ]);

  return filterModulesForNav((modulesData ?? []) as Module[], deniedModuleIds);
}
