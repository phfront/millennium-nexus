import type { SupabaseClient } from '@supabase/supabase-js';
import type { Module } from '@/types/database';

export async function fetchDeniedModuleIdsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('user_module_denials')
    .select('module_id')
    .eq('user_id', userId);

  if (error || !data) return new Set();
  return new Set(data.map((row: { module_id: string }) => row.module_id));
}

export function userHasModuleAccess(module: Module, deniedModuleIds: Set<string>): boolean {
  return module.is_active && !deniedModuleIds.has(module.id);
}

export function filterModulesForNav(modules: Module[], deniedModuleIds: Set<string>): Module[] {
  return modules.filter((m) => userHasModuleAccess(m, deniedModuleIds));
}

export function filterModulesVisibleOnHome(modules: Module[], deniedModuleIds: Set<string>): Module[] {
  return modules.filter((m) => !m.is_active || !deniedModuleIds.has(m.id));
}
