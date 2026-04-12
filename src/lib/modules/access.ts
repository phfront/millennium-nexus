import type { SupabaseClient } from '@supabase/supabase-js';
import type { Module, UserActiveModule } from '@/types/database';

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

export async function fetchActiveModuleIdsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('user_active_modules')
    .select('module_id')
    .eq('user_id', userId);

  if (error || !data) return new Set();
  return new Set(data.map((row: { module_id: string }) => row.module_id));
}

export async function activateModuleForUser(
  supabase: SupabaseClient,
  userId: string,
  moduleId: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('user_active_modules')
    .insert({ user_id: userId, module_id: moduleId });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function deactivateModuleForUser(
  supabase: SupabaseClient,
  userId: string,
  moduleId: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('user_active_modules')
    .delete()
    .eq('user_id', userId)
    .eq('module_id', moduleId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
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

export function filterActiveModules(
  modules: Module[],
  deniedModuleIds: Set<string>,
  activeModuleIds: Set<string>,
): Module[] {
  return modules.filter((m) =>
    activeModuleIds.has(m.id) &&
    !deniedModuleIds.has(m.id)
  );
}
