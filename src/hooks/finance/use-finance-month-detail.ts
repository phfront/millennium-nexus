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
};

export type MonthDetailData = {
  income: SnapshotIncomeRow[];
  expenseGroups: SnapshotExpenseCategoryGroup[];
  oneTime: SnapshotOneTimeRow[];
  totalIncome: number;
  totalExpenses: number;
  totalOneTime: number;
  surplus: number;
};

const EMPTY: MonthDetailData = {
  income: [],
  expenseGroups: [],
  oneTime: [],
  totalIncome: 0,
  totalExpenses: 0,
  totalOneTime: 0,
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
    setIsLoading(true);
    const supabase = createClient();
    const { data: rows } = await supabase
      .from('finance_month_snapshot_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
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
      });
    }
    const expenseGroups = Array.from(categoryMap.values());

    const oneTime: SnapshotOneTimeRow[] = entries
      .filter((e) => e.entry_type === 'one_time')
      .map((e) => ({
        item_name: e.item_name,
        amount: Number(e.amount),
        is_paid: e.is_paid,
        due_date: e.due_date,
      }));

    const totalIncome = income.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenseGroups
      .flatMap((g) => g.items)
      .reduce((s, r) => s + r.amount, 0);
    const totalOneTime = oneTime.reduce((s, r) => s + r.amount, 0);
    const surplus = totalIncome - totalExpenses - totalOneTime;

    setData({ income, expenseGroups, oneTime, totalIncome, totalExpenses, totalOneTime, surplus });
    setIsLoading(false);
  }, [user?.id, month]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { ...data, isLoading };
}
