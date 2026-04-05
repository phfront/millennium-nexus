'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import { receivableIsFullyPaid } from '@/lib/finance/finance';
import type { Receivable } from '@/types/finance';

function normalizeReceivable(raw: Record<string, unknown>): Receivable {
  const r = raw as Receivable;
  return {
    ...r,
    amount: Number(r.amount ?? 0),
    amount_paid: Number((r as { amount_paid?: number }).amount_paid ?? 0),
  };
}

function paidState(amount: number, amountPaid: number) {
  const paid = Math.max(0, Math.min(amount, amountPaid));
  const full = paid >= amount && amount > 0;
  return {
    amount_paid: paid,
    is_paid: full,
    paid_at: full ? new Date().toISOString().split('T')[0] : null,
  };
}

export function useReceivables() {
  const user = useUserStore((s) => s.user);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('finance_receivables')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setReceivables((data ?? []).map((row) => normalizeReceivable(row as Record<string, unknown>)));
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function addReceivable(values: Omit<Receivable, 'id' | 'user_id' | 'created_at'>) {
    if (!user) return;
    const amount = Number(values.amount);
    const ps = paidState(amount, Number(values.amount_paid ?? 0));
    const supabase = createClient();
    const { data, error } = await supabase
      .from('finance_receivables')
      .insert({
        person_name: values.person_name,
        description: values.description,
        amount,
        amount_paid: ps.amount_paid,
        reference_month: values.reference_month,
        is_paid: ps.is_paid,
        paid_at: ps.paid_at,
        user_id: user.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const row = normalizeReceivable(data as Record<string, unknown>);
    setReceivables((prev) => [row, ...prev]);
    return row;
  }

  async function updateAmountPaid(id: string, rawPaid: number) {
    if (!user) return;
    const existing = receivables.find((r) => r.id === id);
    if (!existing) return;
    const amount = Number(existing.amount);
    const ps = paidState(amount, rawPaid);

    setReceivables((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              amount_paid: ps.amount_paid,
              is_paid: ps.is_paid,
              paid_at: ps.paid_at,
            }
          : r,
      ),
    );

    const supabase = createClient();
    const { error } = await supabase
      .from('finance_receivables')
      .update({
        amount_paid: ps.amount_paid,
        is_paid: ps.is_paid,
        paid_at: ps.paid_at,
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      await fetchAll();
      throw new Error(error.message);
    }
  }

  async function togglePaid(id: string) {
    if (!user) return;
    const existing = receivables.find((r) => r.id === id);
    if (!existing) return;
    const amount = Number(existing.amount);
    const currentlyFull = receivableIsFullyPaid(existing);
    const nextPaid = currentlyFull ? 0 : amount;
    const ps = paidState(amount, nextPaid);

    setReceivables((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, amount_paid: ps.amount_paid, is_paid: ps.is_paid, paid_at: ps.paid_at }
          : r,
      ),
    );

    const supabase = createClient();
    const { error } = await supabase
      .from('finance_receivables')
      .update({
        amount_paid: ps.amount_paid,
        is_paid: ps.is_paid,
        paid_at: ps.paid_at,
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      setReceivables((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                amount_paid: existing.amount_paid,
                is_paid: existing.is_paid,
                paid_at: existing.paid_at,
              }
            : r,
        ),
      );
      throw new Error(error.message);
    }
  }

  async function deleteReceivable(id: string) {
    if (!user) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('finance_receivables')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) throw new Error(error.message);
    setReceivables((prev) => prev.filter((r) => r.id !== id));
  }

  const people = [...new Set(receivables.map((r) => r.person_name))].sort();

  function getByPerson(person: string): Receivable[] {
    return receivables.filter((r) => r.person_name === person);
  }

  function getPendingTotal(person?: string): number {
    const items = person ? receivables.filter((r) => r.person_name === person) : receivables;
    return items.reduce((sum, r) => sum + Math.max(0, Number(r.amount) - Number(r.amount_paid ?? 0)), 0);
  }

  return {
    receivables,
    isLoading,
    people,
    refetch: fetchAll,
    addReceivable,
    updateAmountPaid,
    togglePaid,
    deleteReceivable,
    getByPerson,
    getPendingTotal,
  };
}
