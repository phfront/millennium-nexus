'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUserStore } from '@/store/user-store';
import { createClient } from '@/lib/supabase/client';
import type { FinanceMonthSnapshotEntry } from '@/types/finance';

export type SnapshotIncomeRow = {
  item_name: string;
  amount: number;
};

export type SnapshotExpenseRow = {
  item_name: string;
  amount: number;
  is_paid: boolean | null;
  paid_note: string | null;
};

export type SnapshotExpenseCategoryGroup = {
  category_name: string | null;
  category_color: string | null;
  items: SnapshotExpenseRow[];
};

export type SnapshotOneTimeRow = {
  item_name: string;
  amount: number;
  is_paid: boolean | null;
  due_date: string | null;
  paid_note: string | null;
  /** null em dados antigos = tratar como despesa */
  flow: 'expense' | 'income';
};

export type MonthDetailData = {
  income: SnapshotIncomeRow[];
  expenseGroups: SnapshotExpenseCategoryGroup[];
  oneTime: SnapshotOneTimeRow[];
  totalIncome: number;
  totalExpenses: number;
  /** Só despesas pontuais (alinhado à coluna «Pontuais» do histórico). */
  totalOneTimeExpense: number;
  /** Só receitas pontuais. */
  totalOneTimeIncome: number;
  surplus: number;
};

const EMPTY: MonthDetailData = {
  income: [],
  expenseGroups: [],
  oneTime: [],
  totalIncome: 0,
  totalExpenses: 0,
  totalOneTimeExpense: 0,
  totalOneTimeIncome: 0,
  surplus: 0,
};

export function useFinanceMonthDetail(month: string | null) {
  const user = useUserStore((s) => s.user);
  const [data, setData] = useState<MonthDetailData>(EMPTY);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!user?.id || !month) {
      setData(EMPTY);
      return;
    }
    const monthKey = month.length >= 10 ? month.slice(0, 10) : month;
    setIsLoading(true);
    const supabase = createClient();
    const { data: rows } = await supabase
      .from('finance_month_snapshot_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', monthKey)
      .order('sort_order', { ascending: true });

    const entries = (rows ?? []) as FinanceMonthSnapshotEntry[];

    const income: SnapshotIncomeRow[] = entries
      .filter((e) => e.entry_type === 'income')
      .map((e) => ({ item_name: e.item_name, amount: Number(e.amount) }));

    const expenseEntries = entries.filter((e) => e.entry_type === 'expense');
    const categoryMap = new Map<string, SnapshotExpenseCategoryGroup>();
    for (const e of expenseEntries) {
      const key = e.category_name ?? '';
      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          category_name: e.category_name,
          category_color: e.category_color,
          items: [],
        });
      }
      categoryMap.get(key)!.items.push({
        item_name: e.item_name,
        amount: Number(e.amount),
        is_paid: e.is_paid,
        paid_note: e.paid_note ?? null,
      });
    }
    const expenseGroups = Array.from(categoryMap.values());

    let oneTime: SnapshotOneTimeRow[] = entries
      .filter((e) => e.entry_type === 'one_time')
      .map((e) => ({
        item_name: e.item_name,
        amount: Number(e.amount),
        is_paid: e.is_paid,
        due_date: e.due_date,
        paid_note: e.paid_note ?? null,
        flow: e.one_time_flow === 'income' ? 'income' : 'expense',
      }));

    /** Resíduos de arquivamentos antigos: snapshot sem linhas one_time, mas há dados na tabela viva. */
    if (oneTime.length === 0) {
      const { data: liveOt } = await supabase
        .from('finance_one_time_entries')
        .select('name, amount, is_paid, due_date, paid_note, flow')
        .eq('user_id', user.id)
        .eq('month', monthKey);

      type LiveOt = {
        name: string;
        amount: number;
        is_paid: boolean | null;
        due_date: string | null;
        paid_note: string | null;
        flow: string | null;
      };

      oneTime = (liveOt ?? []).map((row) => {
        const r = row as LiveOt;
        return {
          item_name: r.name,
          amount: Number(r.amount),
          is_paid: r.is_paid,
          due_date: r.due_date,
          paid_note: r.paid_note ?? null,
          flow: r.flow === 'income' ? 'income' : 'expense',
        };
      });
    }

    const totalIncome = income.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenseGroups
      .flatMap((g) => g.items)
      .reduce((s, r) => s + r.amount, 0);
    const totalOneTimeExpense = oneTime
      .filter((r) => r.flow === 'expense')
      .reduce((s, r) => s + r.amount, 0);
    const totalOneTimeIncome = oneTime
      .filter((r) => r.flow === 'income')
      .reduce((s, r) => s + r.amount, 0);
    const surplus = totalIncome + totalOneTimeIncome - totalExpenses - totalOneTimeExpense;

    setData({
      income,
      expenseGroups,
      oneTime,
      totalIncome,
      totalExpenses,
      totalOneTimeExpense,
      totalOneTimeIncome,
      surplus,
    });
    setIsLoading(false);
  }, [user?.id, month]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { ...data, isLoading };
}
