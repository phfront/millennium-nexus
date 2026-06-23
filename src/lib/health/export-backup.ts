import type { SupabaseClient } from '@supabase/supabase-js';

export const HEALTH_BACKUP_VERSION = 1;

export type HealthBackupScope = 'all' | 'peso' | 'nutricao' | 'calorias';

export type HealthModuleBackup = {
  version: typeof HEALTH_BACKUP_VERSION;
  exportedAt: string;
  scope: HealthBackupScope;
  peso?: {
    settings: Record<string, unknown> | null;
    weightLogs: Record<string, unknown>[];
  };
  nutricao?: {
    settings: Record<string, unknown> | null;
    customFoods: Record<string, unknown>[];
    plans: Record<string, unknown>[];
    dietLogs: Record<string, unknown>[];
    waterLogs: Record<string, unknown>[];
  };
  calorias?: {
    settings: Record<string, unknown> | null;
    logs: Record<string, unknown>[];
  };
};

function scopeIncludes(scope: HealthBackupScope, part: Exclude<HealthBackupScope, 'all'>): boolean {
  return scope === 'all' || scope === part;
}

async function fetchPesoBackup(supabase: SupabaseClient, userId: string) {
  const [settingsRes, logsRes] = await Promise.all([
    supabase.from('health_settings').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('weight_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: true }),
  ]);

  if (settingsRes.error) throw new Error(`Peso (configurações): ${settingsRes.error.message}`);
  if (logsRes.error) throw new Error(`Peso (histórico): ${logsRes.error.message}`);

  return {
    settings: (settingsRes.data as Record<string, unknown> | null) ?? null,
    weightLogs: (logsRes.data ?? []) as Record<string, unknown>[],
  };
}

async function fetchNutricaoBackup(supabase: SupabaseClient, userId: string) {
  const [settingsRes, foodsRes, plansRes, dietLogsRes, waterLogsRes] = await Promise.all([
    supabase.from('diet_settings').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('foods').select('*').eq('user_id', userId).order('name', { ascending: true }),
    supabase
      .from('diet_plans')
      .select(`
        *,
        diet_plan_meals (
          *,
          diet_plan_meal_items (
            *,
            foods (*),
            food_substitutions (
              *,
              foods:substitute_food_id (*)
            )
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase.from('diet_logs').select('*').eq('user_id', userId).order('logged_date', { ascending: true }),
    supabase.from('water_logs').select('*').eq('user_id', userId).order('logged_date', { ascending: true }),
  ]);

  if (settingsRes.error) throw new Error(`Nutrição (configurações): ${settingsRes.error.message}`);
  if (foodsRes.error) throw new Error(`Nutrição (alimentos): ${foodsRes.error.message}`);
  if (plansRes.error) throw new Error(`Nutrição (planos): ${plansRes.error.message}`);
  if (dietLogsRes.error) throw new Error(`Nutrição (histórico): ${dietLogsRes.error.message}`);
  if (waterLogsRes.error) throw new Error(`Nutrição (água): ${waterLogsRes.error.message}`);

  return {
    settings: (settingsRes.data as Record<string, unknown> | null) ?? null,
    customFoods: (foodsRes.data ?? []) as Record<string, unknown>[],
    plans: (plansRes.data ?? []) as Record<string, unknown>[],
    dietLogs: (dietLogsRes.data ?? []) as Record<string, unknown>[],
    waterLogs: (waterLogsRes.data ?? []) as Record<string, unknown>[],
  };
}

async function fetchCaloriasBackup(supabase: SupabaseClient, userId: string) {
  const [settingsRes, logsRes] = await Promise.all([
    supabase.from('calorias_settings').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('calorias_logs').select('*').eq('user_id', userId).order('logged_date', { ascending: true }),
  ]);

  if (settingsRes.error) throw new Error(`Calorias (configurações): ${settingsRes.error.message}`);
  if (logsRes.error) throw new Error(`Calorias (histórico): ${logsRes.error.message}`);

  return {
    settings: (settingsRes.data as Record<string, unknown> | null) ?? null,
    logs: (logsRes.data ?? []) as Record<string, unknown>[],
  };
}

export async function fetchHealthModuleBackup(
  supabase: SupabaseClient,
  userId: string,
  scope: HealthBackupScope,
): Promise<HealthModuleBackup> {
  const backup: HealthModuleBackup = {
    version: HEALTH_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    scope,
  };

  const tasks: Promise<void>[] = [];

  if (scopeIncludes(scope, 'peso')) {
    tasks.push(
      fetchPesoBackup(supabase, userId).then((data) => {
        backup.peso = data;
      }),
    );
  }

  if (scopeIncludes(scope, 'nutricao')) {
    tasks.push(
      fetchNutricaoBackup(supabase, userId).then((data) => {
        backup.nutricao = data;
      }),
    );
  }

  if (scopeIncludes(scope, 'calorias')) {
    tasks.push(
      fetchCaloriasBackup(supabase, userId).then((data) => {
        backup.calorias = data;
      }),
    );
  }

  await Promise.all(tasks);
  return backup;
}

export function downloadHealthBackupJson(backup: HealthModuleBackup, filename?: string): void {
  const scope = backup.scope === 'all' ? 'health-completo' : backup.scope;
  const date = backup.exportedAt.slice(0, 10);
  const defaultName = `millennium-health-${scope}-${date}.json`;
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename ?? defaultName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function summarizeHealthBackup(backup: HealthModuleBackup): {
  pesoLogs: number;
  nutricaoPlans: number;
  nutricaoDietLogs: number;
  nutricaoWaterLogs: number;
  nutricaoFoods: number;
  caloriasLogs: number;
} {
  return {
    pesoLogs: backup.peso?.weightLogs.length ?? 0,
    nutricaoPlans: backup.nutricao?.plans.length ?? 0,
    nutricaoDietLogs: backup.nutricao?.dietLogs.length ?? 0,
    nutricaoWaterLogs: backup.nutricao?.waterLogs.length ?? 0,
    nutricaoFoods: backup.nutricao?.customFoods.length ?? 0,
    caloriasLogs: backup.calorias?.logs.length ?? 0,
  };
}
