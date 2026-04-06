'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import { usePlanningHorizonListener } from '@/hooks/finance/use-planning-horizon-listener';
import { normalizeExpenseMonthKey } from '@/lib/finance/finance';
import { getLocalDateStr } from '@/lib/daily-goals/timezone';
import type { OneTimeEntry } from '@/types/finance';

function mapRow(row: Record<string, unknown>): OneTimeEntry {
  const flow = row.flow === 'income' ? 'income' : 'expense';
  return {
    ...(row as OneTimeEntry),
    flow,
    due_date: (row.due_date as string | null) ?? null,
    paid_note: (row.paid_note as string | null) ?? null,
  };
}

export function useOneTime() {
  const user = useUserStore((s) => s.user);
  const [entries, setEntries] = useState<OneTimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('finance_one_time_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('month', { ascending: false });
    setEntries((data ?? []).map((row) => mapRow(row as Record<string, unknown>)));
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  usePlanningHorizonListener(fetchAll);

  async function upsertExpense(
    name: string,
    month: string,
    amount: number,
    id?: string,
    extra?: { due_date?: string | null; flow?: 'expense' | 'income' },
  ) {
    if (!user) return;
    const supabase = createClient();
    const flow = extra?.flow ?? 'expense';
    if (id) {
      const patch: {
        amount: number;
        name: string;
        due_date?: string | null;
        flow?: 'expense' | 'income';
      } = { amount, name, flow };
      if (extra && 'due_date' in extra) patch.due_date = extra.due_date ?? null;
      const { data, error } = await supabase
        .from('finance_one_time_entries')
        .update(patch)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      const row = mapRow(data as Record<string, unknown>);
      setEntries((prev) => prev.map((e) => (e.id === id ? row : e)));
      return row;
    }
    const { data, error } = await supabase
      .from('finance_one_time_entries')
      .insert({
        user_id: user.id,
        name,
        month,
        amount,
        due_date: extra?.due_date ?? null,
        flow,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const row = mapRow(data as Record<string, unknown>);
    setEntries((prev) => [row, ...prev]);
    return row;
  }

  async function togglePaid(id: string, paidNote?: string | null) {
    if (!user) return;
    const existing = entries.find((e) => e.id === id);
    if (!existing) return;
    const newPaid = !existing.is_paid;
    const paidAt = newPaid ? getLocalDateStr(user?.profile?.timezone) : null;
    const noteToStore = newPaid
      ? paidNote !== undefined
        ? (paidNote ?? '').trim() || null
        : null
      : null;

    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, is_paid: newPaid, paid_at: paidAt, paid_note: noteToStore } : e,
      ),
    );

    const supabase = createClient();
    const { error } = await supabase
      .from('finance_one_time_entries')
      .update({ is_paid: newPaid, paid_at: paidAt, paid_note: noteToStore })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, is_paid: !newPaid, paid_at: existing.paid_at, paid_note: existing.paid_note }
            : e,
        ),
      );
      throw new Error(error.message);
    }
  }

  async function deleteExpense(id: string) {
    if (!user) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('finance_one_time_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) throw new Error(error.message);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  /** Totais de despesa e receita pontuais no mês (valores ≥ 0). */
  function getMonthFlowTotals(month: string): { expense: number; income: number } {
    const mk = normalizeExpenseMonthKey(month);
    const rows = entries.filter((e) => normalizeExpenseMonthKey(e.month) === mk);
    return {
      expense: rows
        .filter((e) => e.flow === 'expense')
        .reduce((s, e) => s + Number(e.amount ?? 0), 0),
      income: rows
        .filter((e) => e.flow === 'income')
        .reduce((s, e) => s + Number(e.amount ?? 0), 0),
    };
  }

  function getForMonth(month: string): OneTimeEntry[] {
    const mk = normalizeExpenseMonthKey(month);
    return entries.filter((e) => normalizeExpenseMonthKey(e.month) === mk);
  }

  const allNames = [...new Set(entries.map((e) => e.name))].sort();

  return {
    entries,
    /** @deprecated use entries */
    expenses: entries,
    isLoading,
    refetch: fetchAll,
    upsertExpense,
    togglePaid,
    deleteExpense,
    getMonthFlowTotals,
    getForMonth,
    allNames,
  };
}
