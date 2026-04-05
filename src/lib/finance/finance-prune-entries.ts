import type { SupabaseClient } from '@supabase/supabase-js';

const TABLES = [
  'finance_income_entries',
  'finance_expense_entries',
  'finance_one_time_expenses',
] as const;

/**
 * Apaga linhas do utilizador com `month` estritamente posterior ao último mês do horizonte
 * (receitas, despesas fixas e pontuais).
 */
export async function pruneFinanceEntriesAfterMonth(
  supabase: SupabaseClient,
  userId: string,
  maxMonthInclusive: string,
): Promise<{ error: string | null }> {
  for (const table of TABLES) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId).gt('month', maxMonthInclusive);
    if (error) return { error: error.message };
  }
  return { error: null };
}
