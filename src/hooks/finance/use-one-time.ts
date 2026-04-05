'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import { usePlanningHorizonListener } from '@/hooks/finance/use-planning-horizon-listener';
import { normalizeExpenseMonthKey } from '@/lib/finance/finance';
import type { OneTimeExpense } from '@/types/finance';

export function useOneTime() {
  const user = useUserStore((s) => s.user);
  const [expenses, setExpenses] = useState<OneTimeExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('finance_one_time_expenses')
      .select('*')
      .eq('user_id', user.id)
      .order('month', { ascending: false });
    setExpenses(
      (data ?? []).map((row) => ({
        ...(row as OneTimeExpense),
        due_date: (row as { due_date?: string | null }).due_date ?? null,
      })),
    );
    setIsLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  usePlanningHorizonListener(fetchAll);

  async function upsertExpense(
    name: string,
    month: string,
    amount: number,
    id?: string,
    extra?: { due_date?: string | null },
  ) {
    if (!user) return;
    const supabase = createClient();
    if (id) {
      const patch: { amount: number; name: string; due_date?: string | null } = { amount, name };
      if (extra && 'due_date' in extra) patch.due_date = extra.due_date ?? null;
      const { data, error } = await supabase
        .from('finance_one_time_expenses')
        .update(patch)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      const row = {
        ...(data as OneTimeExpense),
        due_date: (data as { due_date?: string | null }).due_date ?? null,
      };
      setExpenses((prev) => prev.map((e) => (e.id === id ? row : e)));
      return row;
    } else {
      const { data, error } = await supabase
        .from('finance_one_time_expenses')
        .insert({
          user_id: user.id,
          name,
          month,
          amount,
          due_date: extra?.due_date ?? null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      const row = {
        ...(data as OneTimeExpense),
        due_date: (data as { due_date?: string | null }).due_date ?? null,
      };
      setExpenses((prev) => [row, ...prev]);
      return row;
    }
  }

  async function togglePaid(id: string) {
    if (!user) return;
    const existing = expenses.find((e) => e.id === id);
    if (!existing) return;
    const newPaid = !existing.is_paid;
    const paidAt = newPaid ? new Date().toISOString().split('T')[0] : null;

    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, is_paid: newPaid, paid_at: paidAt } : e)),
    );

    const supabase = createClient();
    const { error } = await supabase
      .from('finance_one_time_expenses')
      .update({ is_paid: newPaid, paid_at: paidAt })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      setExpenses((prev) =>
        prev.map((e) => (e.id === id ? { ...e, is_paid: !newPaid, paid_at: existing.paid_at } : e)),
      );
      throw new Error(error.message);
    }
  }

  async function deleteExpense(id: string) {
    if (!user) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('finance_one_time_expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) throw new Error(error.message);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  function getMonthlyTotal(month: string): number {
    const mk = normalizeExpenseMonthKey(month);
    return expenses
      .filter((e) => normalizeExpenseMonthKey(e.month) === mk)
      .reduce((sum, e) => sum + (e.amount ?? 0), 0);
  }

  function getForMonth(month: string): OneTimeExpense[] {
    const mk = normalizeExpenseMonthKey(month);
    return expenses.filter((e) => normalizeExpenseMonthKey(e.month) === mk);
  }

  const allNames = [...new Set(expenses.map((e) => e.name))].sort();

  return { expenses, isLoading, refetch: fetchAll, upsertExpense, togglePaid, deleteExpense, getMonthlyTotal, getForMonth, allNames };
}
