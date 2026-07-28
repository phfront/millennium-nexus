'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import { usePlanningHorizonListener } from '@/hooks/finance/use-planning-horizon-listener';
import { useCurrencyConversion } from '@/hooks/finance/use-currency-conversion';
import type { BudgetMonthRow } from '@/types/finance';

export type BudgetBucketKey = 'essential' | 'optional' | 'investment';

export const BUDGET_BUCKET_KEYS: BudgetBucketKey[] = ['essential', 'optional', 'investment'];

export type BudgetBucket = {
  key: BudgetBucketKey;
  amount: number;
  /** Percentual-alvo da base (ex.: 60). */
  targetPct: number;
  targetAmount: number;
  /** Fatia real da base, em pontos percentuais; 0 quando não há base. */
  sharePct: number;
  /** `targetAmount - amount`: positivo = folga, negativo = acima do alvo. */
  delta: number;
};

export type BudgetMonth = {
  month: string;
  incomeRecurring: number;
  incomeOneTime: number;
  deductions: number;
  /** Receita considerada, antes de deduzir impostos. */
  incomeConsidered: number;
  /** `incomeConsidered - deductions` — o denominador de tudo. */
  base: number;
  buckets: Record<BudgetBucketKey, BudgetBucket>;
  /**
   * `true` = mês já arquivado: a base vem congelada do arquivo em vez de ser
   * recalculada com a cotação de hoje, para não divergir do Histórico.
   */
  baseIsFrozen: boolean;
  /** Despesas sem `budget_class`; não entram em balde nenhum. */
  unclassified: number;
  unclassifiedCount: number;
  unclassifiedSharePct: number;
  /** `base` menos tudo que tem destino (incl. não classificado). Pode ser negativo. */
  unallocated: number;
  unallocatedSharePct: number;
  /** Denominador das barras: a base, ou o gasto total quando este a excede. */
  barTotal: number;
  /** Gasto total do mês somando os quatro grupos (sem deduções). */
  totalSpent: number;
  includeOneTimeIncome: boolean;
  /** Sem receita lançada não há percentuais que façam sentido. */
  isEmpty: boolean;
};

const EMPTY_ROW = (month: string): BudgetMonthRow => ({
  user_id: '',
  month,
  income_recurring: 0,
  income_one_time: 0,
  deductions: 0,
  essential: 0,
  optional: 0,
  investment: 0,
  unclassified: 0,
  unclassified_count: 0,
  pct_essential: 60,
  pct_optional: 30,
  pct_investment: 10,
  include_one_time_income: false,
  base_is_frozen: false,
});

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeMonthKey(m: string): string {
  return m && m.length >= 10 ? m.slice(0, 10) : m;
}

/** Converte a linha crua da view no formato que os telas consomem. */
export function buildBudgetMonth(raw: BudgetMonthRow): BudgetMonth {
  const incomeRecurring = num(raw.income_recurring);
  const incomeOneTime = num(raw.income_one_time);
  const deductions = num(raw.deductions);
  const includeOneTimeIncome = Boolean(raw.include_one_time_income);

  const baseIsFrozen = Boolean(raw.base_is_frozen);

  const incomeConsidered = incomeRecurring + (includeOneTimeIncome ? incomeOneTime : 0);
  const base = incomeConsidered - deductions;

  const amounts: Record<BudgetBucketKey, number> = {
    essential: num(raw.essential),
    optional: num(raw.optional),
    investment: num(raw.investment),
  };
  const targets: Record<BudgetBucketKey, number> = {
    essential: num(raw.pct_essential),
    optional: num(raw.pct_optional),
    investment: num(raw.pct_investment),
  };

  const share = (v: number) => (base > 0 ? (v / base) * 100 : 0);

  const buckets = BUDGET_BUCKET_KEYS.reduce(
    (acc, key) => {
      const amount = amounts[key];
      const targetPct = targets[key];
      const targetAmount = base > 0 ? (base * targetPct) / 100 : 0;
      acc[key] = {
        key,
        amount,
        targetPct,
        targetAmount,
        sharePct: share(amount),
        delta: targetAmount - amount,
      };
      return acc;
    },
    {} as Record<BudgetBucketKey, BudgetBucket>,
  );

  const unclassified = num(raw.unclassified);
  const totalSpent = amounts.essential + amounts.optional + amounts.investment + unclassified;
  const unallocated = base - totalSpent;

  return {
    month: normalizeMonthKey(raw.month),
    incomeRecurring,
    incomeOneTime,
    deductions,
    incomeConsidered,
    base,
    baseIsFrozen,
    buckets,
    unclassified,
    unclassifiedCount: num(raw.unclassified_count),
    unclassifiedSharePct: share(unclassified),
    unallocated,
    unallocatedSharePct: share(unallocated),
    // Quando se gasta mais do que a base, a barra passa a medir o gasto —
    // senão os segmentos somariam mais de 100% e sairiam do eixo.
    barTotal: Math.max(base, totalSpent, 0),
    totalSpent,
    includeOneTimeIncome,
    isEmpty: incomeConsidered <= 0,
  };
}

/**
 * Orçamento por baldes, mês a mês.
 *
 * Os totais vêm de `finance_budget_monthly`, que já converte as receitas em
 * moeda estrangeira. Nada é convertido outra vez aqui — `useCurrencyConversion`
 * entra só para saber se há cotações, porque sem elas o `finance_fx_factor`
 * devolve 1 em silêncio e todos os percentuais desta tela ficam errados.
 */
export function useBudgetAllocation() {
  const user = useUserStore((s) => s.user);
  const { hasRates, fetchedAt, isLoading: ratesLoading } = useCurrencyConversion();

  const [rows, setRows] = useState<BudgetMonthRow[]>([]);
  const [hasForeignIncome, setHasForeignIncome] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setHasForeignIncome(false);
      setIsLoading(false);
      return;
    }
    const supabase = createClient();
    const [{ data: budgetData }, { count: foreignCount }] = await Promise.all([
      supabase
        .from('finance_budget_monthly')
        .select('*')
        .eq('user_id', user.id)
        .order('month', { ascending: true }),
      supabase
        .from('finance_income_sources')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('currency', 'is', null),
    ]);
    setRows((budgetData ?? []) as BudgetMonthRow[]);
    setHasForeignIncome((foreignCount ?? 0) > 0);
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);
  usePlanningHorizonListener(fetchAll);

  const months = useMemo(() => rows.map((r) => buildBudgetMonth(r)), [rows]);

  const getMonth = useCallback(
    (month: string): BudgetMonth => {
      const key = normalizeMonthKey(month);
      return months.find((m) => m.month === key) ?? buildBudgetMonth(EMPTY_ROW(key));
    },
    [months],
  );

  /** Os `count` meses até `month` (inclusive), para a tendência. */
  const getTrend = useCallback(
    (month: string, count = 12): BudgetMonth[] => {
      const key = normalizeMonthKey(month);
      const upTo = months.filter((m) => m.month <= key);
      return upTo.slice(Math.max(0, upTo.length - count));
    },
    [months],
  );

  /**
   * Só é problema quando há fonte em moeda estrangeira: aí a base depende da
   * cotação, e sem ela os percentuais mentem sem dar erro.
   */
  const ratesUnavailable = hasForeignIncome && !ratesLoading && !hasRates;

  return {
    months,
    isLoading,
    refetch: fetchAll,
    getMonth,
    getTrend,
    hasForeignIncome,
    hasRates,
    ratesFetchedAt: fetchedAt,
    ratesUnavailable,
  };
}
