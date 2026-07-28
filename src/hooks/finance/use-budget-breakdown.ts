'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import { usePlanningHorizonListener } from '@/hooks/finance/use-planning-horizon-listener';
import { normalizeBudgetClass, type BudgetClass } from '@/types/finance';

/** Os cinco destinos possíveis de uma despesa no orçamento. */
export type BudgetLineGroup = BudgetClass | 'unclassified';

export const BUDGET_LINE_GROUPS: BudgetLineGroup[] = [
  'essential',
  'optional',
  'investment',
  'deduction',
  'unclassified',
];

export type BudgetLine = {
  id: string;
  name: string;
  amount: number;
  /** Categoria da planilha; null nos pontuais e nos itens sem categoria. */
  categoryName: string | null;
  /** Pontuais e fixos convivem na mesma lista — a origem desempata nomes iguais. */
  isOneTime: boolean;
};

export type BudgetBreakdown = Record<BudgetLineGroup, BudgetLine[]>;

function emptyBreakdown(): BudgetBreakdown {
  return {
    essential: [],
    optional: [],
    investment: [],
    deduction: [],
    unclassified: [],
  };
}

function normalizeMonthKey(m: string): string {
  return m && m.length >= 10 ? m.slice(0, 10) : m;
}

type EntryRow = { item_id: string; amount: number | string | null };
type ItemRow = {
  id: string;
  name: string;
  category_id: string | null;
  budget_class: string | null;
};
type CategoryRow = { id: string; name: string };
type OneTimeRow = {
  id: string;
  name: string;
  amount: number | string | null;
  budget_class: string | null;
};

/**
 * As linhas por trás de cada balde do mês.
 *
 * `finance_budget_monthly` só devolve totais; isto abre o total para o
 * detalhe. Soma exactamente as mesmas linhas que a view — despesas com
 * entrada em `finance_expense_entries` (sem o fallback de `default_amount`)
 * mais os pontuais de despesa — senão o detalhe não fecharia com a barra.
 *
 * Valores de despesa não passam por câmbio, aqui nem na view: já estão na
 * moeda de exibição.
 */
export function useBudgetBreakdown(month: string) {
  const user = useUserStore((s) => s.user);
  const monthKey = normalizeMonthKey(month);

  const [breakdown, setBreakdown] = useState<BudgetBreakdown>(emptyBreakdown);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user?.id || !monthKey) {
      setBreakdown(emptyBreakdown());
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const supabase = createClient();
    const [{ data: entryData }, { data: itemData }, { data: catData }, { data: oneTimeData }] =
      await Promise.all([
        supabase
          .from('finance_expense_entries')
          .select('item_id, amount')
          .eq('user_id', user.id)
          .eq('month', monthKey),
        supabase
          .from('finance_expense_items')
          .select('id, name, category_id, budget_class')
          .eq('user_id', user.id),
        supabase.from('finance_expense_categories').select('id, name').eq('user_id', user.id),
        supabase
          .from('finance_one_time_entries')
          .select('id, name, amount, budget_class')
          .eq('user_id', user.id)
          .eq('month', monthKey)
          .eq('flow', 'expense'),
      ]);

    const items = new Map(((itemData ?? []) as ItemRow[]).map((i) => [i.id, i]));
    const categories = new Map(((catData ?? []) as CategoryRow[]).map((c) => [c.id, c.name]));

    const next = emptyBreakdown();

    for (const row of (entryData ?? []) as EntryRow[]) {
      const amount = Number(row.amount ?? 0);
      // Linhas a zero existem só para segurar a célula na planilha: não somam
      // nada e enchiam a lista de ruído.
      if (!Number.isFinite(amount) || amount === 0) continue;
      const item = items.get(row.item_id);
      if (!item) continue;
      const group = normalizeBudgetClass(item.budget_class) ?? 'unclassified';
      next[group].push({
        id: `fixed:${row.item_id}`,
        name: item.name,
        amount,
        categoryName: item.category_id ? (categories.get(item.category_id) ?? null) : null,
        isOneTime: false,
      });
    }

    for (const row of (oneTimeData ?? []) as OneTimeRow[]) {
      const amount = Number(row.amount ?? 0);
      if (!Number.isFinite(amount) || amount === 0) continue;
      const group = normalizeBudgetClass(row.budget_class) ?? 'unclassified';
      next[group].push({
        id: `one_time:${row.id}`,
        name: row.name,
        amount,
        categoryName: null,
        isOneTime: true,
      });
    }

    for (const group of BUDGET_LINE_GROUPS) {
      next[group].sort((a, b) => b.amount - a.amount);
    }

    setBreakdown(next);
    setIsLoading(false);
  }, [user?.id, monthKey]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);
  usePlanningHorizonListener(fetchAll);

  const totals = useMemo(() => {
    const acc = {} as Record<BudgetLineGroup, number>;
    for (const group of BUDGET_LINE_GROUPS) {
      acc[group] = breakdown[group].reduce((sum, l) => sum + l.amount, 0);
    }
    return acc;
  }, [breakdown]);

  return { breakdown, totals, isLoading, refetch: fetchAll };
}
