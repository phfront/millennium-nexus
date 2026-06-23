import type { SupabaseClient } from '@supabase/supabase-js';

export const FINANCE_BACKUP_VERSION = 1;

export type FinanceModuleBackup = {
  version: typeof FINANCE_BACKUP_VERSION;
  exportedAt: string;
  settings: Record<string, unknown> | null;
  income: {
    sources: Record<string, unknown>[];
    entries: Record<string, unknown>[];
  };
  expenses: {
    categories: Record<string, unknown>[];
    items: Record<string, unknown>[];
    entries: Record<string, unknown>[];
  };
  oneTimeEntries: Record<string, unknown>[];
  subscriptions: Record<string, unknown>[];
  receivables: Record<string, unknown>[];
  history: {
    monthSnapshots: Record<string, unknown>[];
    monthSnapshotEntries: Record<string, unknown>[];
  };
};

async function fetchUserRows(
  supabase: SupabaseClient,
  table: string,
  userId: string,
  order?: { column: string; ascending?: boolean },
): Promise<Record<string, unknown>[]> {
  let query = supabase.from(table).select('*').eq('user_id', userId);
  if (order) {
    query = query.order(order.column, { ascending: order.ascending ?? true });
  }
  const { data, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

export async function fetchFinanceModuleBackup(
  supabase: SupabaseClient,
  userId: string,
): Promise<FinanceModuleBackup> {
  const [
    settingsRes,
    incomeSources,
    incomeEntries,
    expenseCategories,
    expenseItems,
    expenseEntries,
    oneTimeEntries,
    subscriptions,
    receivables,
    monthSnapshots,
    monthSnapshotEntries,
  ] = await Promise.all([
    supabase.from('finance_user_settings').select('*').eq('user_id', userId).maybeSingle(),
    fetchUserRows(supabase, 'finance_income_sources', userId, { column: 'sort_order' }),
    fetchUserRows(supabase, 'finance_income_entries', userId, { column: 'month' }),
    fetchUserRows(supabase, 'finance_expense_categories', userId, { column: 'sort_order' }),
    fetchUserRows(supabase, 'finance_expense_items', userId, { column: 'sort_order' }),
    fetchUserRows(supabase, 'finance_expense_entries', userId, { column: 'month' }),
    fetchUserRows(supabase, 'finance_one_time_entries', userId, { column: 'month' }),
    fetchUserRows(supabase, 'finance_subscriptions', userId, { column: 'created_at' }),
    fetchUserRows(supabase, 'finance_receivables', userId, { column: 'created_at' }),
    fetchUserRows(supabase, 'finance_month_snapshots', userId, { column: 'month' }),
    supabase
      .from('finance_month_snapshot_entries')
      .select('*')
      .eq('user_id', userId)
      .order('month', { ascending: true })
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (error) throw new Error(`finance_month_snapshot_entries: ${error.message}`);
        return (data ?? []) as Record<string, unknown>[];
      }),
  ]);

  if (settingsRes.error) {
    throw new Error(`finance_user_settings: ${settingsRes.error.message}`);
  }

  return {
    version: FINANCE_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: (settingsRes.data as Record<string, unknown> | null) ?? null,
    income: {
      sources: incomeSources,
      entries: incomeEntries,
    },
    expenses: {
      categories: expenseCategories,
      items: expenseItems,
      entries: expenseEntries,
    },
    oneTimeEntries,
    subscriptions,
    receivables,
    history: {
      monthSnapshots,
      monthSnapshotEntries,
    },
  };
}

export function summarizeFinanceBackup(backup: FinanceModuleBackup): {
  incomeSources: number;
  incomeEntries: number;
  expenseCategories: number;
  expenseItems: number;
  expenseEntries: number;
  oneTimeEntries: number;
  subscriptions: number;
  receivables: number;
  closedMonths: number;
  historyLines: number;
} {
  return {
    incomeSources: backup.income.sources.length,
    incomeEntries: backup.income.entries.length,
    expenseCategories: backup.expenses.categories.length,
    expenseItems: backup.expenses.items.length,
    expenseEntries: backup.expenses.entries.length,
    oneTimeEntries: backup.oneTimeEntries.length,
    subscriptions: backup.subscriptions.length,
    receivables: backup.receivables.length,
    closedMonths: backup.history.monthSnapshots.length,
    historyLines: backup.history.monthSnapshotEntries.length,
  };
}

export function downloadFinanceBackupJson(backup: FinanceModuleBackup, filename?: string): void {
  const date = backup.exportedAt.slice(0, 10);
  const defaultName = `millennium-finance-completo-${date}.json`;
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename ?? defaultName;
  anchor.click();
  URL.revokeObjectURL(url);
}
