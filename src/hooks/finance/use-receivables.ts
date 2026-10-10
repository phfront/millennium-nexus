'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import { buildMonthRange, receivableIsFullyPaid } from '@/lib/finance/finance';
import { getLocalDateStr } from '@/lib/habits-goals/timezone';
import type { Receivable, ReceivableSeries } from '@/types/finance';

function normalizeReceivable(raw: Record<string, unknown>): Receivable {
  const r = raw as Receivable;
  return {
    ...r,
    amount: Number(r.amount ?? 0),
    amount_paid: Number((r as { amount_paid?: number }).amount_paid ?? 0),
    series_id: r.series_id ?? null,
  };
}

function normalizeSeries(raw: Record<string, unknown>): ReceivableSeries {
  const s = raw as ReceivableSeries;
  return {
    ...s,
    amount: Number(s.amount ?? 0),
    due_day: s.due_day != null ? Number(s.due_day) : null,
    start_month: String(s.start_month).slice(0, 10),
    end_month: s.end_month ? String(s.end_month).slice(0, 10) : null,
  };
}

/** Mês corrente ('YYYY-MM-01') no fuso do usuário. */
function currentMonth(timezone?: string | null): string {
  return `${getLocalDateStr(timezone).slice(0, 7)}-01`;
}

function monthKey(m: string | null): string {
  return m ? m.slice(0, 10) : '';
}

function paidState(amount: number, amountPaid: number, timezone?: string | null) {
  const paid = Math.max(0, Math.min(amount, amountPaid));
  const full = paid >= amount && amount > 0;
  return {
    amount_paid: paid,
    is_paid: full,
    paid_at: full ? getLocalDateStr(timezone) : null,
  };
}

export function useReceivables() {
  const user = useUserStore((s) => s.user);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [series, setSeries] = useState<ReceivableSeries[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const [{ data: recData }, { data: serData }] = await Promise.all([
      supabase
        .from('finance_receivables')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('finance_receivable_series')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);
    setReceivables((recData ?? []).map((row) => normalizeReceivable(row as Record<string, unknown>)));
    setSeries((serData ?? []).map((row) => normalizeSeries(row as Record<string, unknown>)));
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /**
   * Materializa as cobranças em falta das regras ativas: de `start_month` até
   * o mês corrente, uma por mês. Nunca meses futuros — o que ainda não venceu
   * não é dívida.
   *
   * `ignoreDuplicates` sobre o índice único (user, série, mês) é o que torna
   * isto seguro de repetir: duas abas abertas geram o mesmo mês e a segunda
   * não faz nada. E é também o que preserva o histórico — mudar o valor da
   * regra não reescreve o que já foi cobrado, porque a linha existente nunca
   * é tocada.
   */
  const ensureSeriesCharges = useCallback(async () => {
    if (!user || series.length === 0) return;
    const today = currentMonth(user.profile?.timezone);
    const existing = new Set(
      receivables
        .filter((r) => r.series_id)
        .map((r) => `${r.series_id}:${monthKey(r.reference_month)}`),
    );

    const rows: Record<string, unknown>[] = [];
    for (const s of series) {
      if (!s.is_active) continue;
      const last = s.end_month && s.end_month < today ? s.end_month : today;
      if (s.start_month > last) continue;
      for (const month of buildMonthRange(s.start_month, last)) {
        if (existing.has(`${s.id}:${month}`)) continue;
        rows.push({
          user_id: user.id,
          series_id: s.id,
          person_name: s.person_name,
          description: s.description,
          amount: s.amount,
          amount_paid: 0,
          reference_month: month,
          is_paid: false,
          paid_at: null,
        });
      }
    }
    if (rows.length === 0) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('finance_receivables')
      .upsert(rows, { onConflict: 'user_id,series_id,reference_month', ignoreDuplicates: true });
    if (error) return;
    await fetchAll();
  }, [user, series, receivables, fetchAll]);

  useEffect(() => {
    if (isLoading) return;
    void ensureSeriesCharges();
    // Só quando as regras mudam: `receivables` muda a cada pagamento, e
    // reagir a isso poria a geração a correr por nada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, series]);

  async function addReceivable(values: Omit<Receivable, 'id' | 'user_id' | 'created_at'>) {
    if (!user) return;
    const amount = Number(values.amount);
    const ps = paidState(amount, Number(values.amount_paid ?? 0), user?.profile?.timezone);
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
    const ps = paidState(amount, rawPaid, user?.profile?.timezone);

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
    const ps = paidState(amount, nextPaid, user?.profile?.timezone);

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

  async function addSeries(values: Omit<ReceivableSeries, 'id' | 'user_id' | 'created_at'>) {
    if (!user) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('finance_receivable_series')
      .insert({ ...values, amount: Number(values.amount), user_id: user.id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const row = normalizeSeries(data as Record<string, unknown>);
    /* A geração corre no efeito, assim que `series` muda. */
    setSeries((prev) => [row, ...prev]);
    return row;
  }

  /**
   * Alterar a regra vale dos meses ainda não gerados em diante: as cobranças
   * já emitidas ficam como estão, porque já foram o que foram.
   */
  async function updateSeries(
    id: string,
    patch: Partial<Omit<ReceivableSeries, 'id' | 'user_id' | 'created_at'>>,
  ) {
    if (!user) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('finance_receivable_series')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const row = normalizeSeries(data as Record<string, unknown>);
    setSeries((prev) => prev.map((s) => (s.id === id ? row : s)));
  }

  /**
   * Apaga só a regra. As cobranças já geradas ficam (o FK é SET NULL) e
   * passam a ser avulsas — apagar a regra não pode apagar o histórico de
   * quem te devia o quê.
   */
  async function deleteSeries(id: string) {
    if (!user) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('finance_receivable_series')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) throw new Error(error.message);
    setSeries((prev) => prev.filter((s) => s.id !== id));
    setReceivables((prev) =>
      prev.map((r) => (r.series_id === id ? { ...r, series_id: null } : r)),
    );
  }

  /* Inclui quem só tem regra ainda sem cobrança gerada (regra a começar no futuro). */
  const people = [
    ...new Set([...receivables.map((r) => r.person_name), ...series.map((s) => s.person_name)]),
  ].sort();

  function getSeriesByPerson(person: string): ReceivableSeries[] {
    return series.filter((s) => s.person_name === person);
  }

  function getByPerson(person: string): Receivable[] {
    return receivables.filter((r) => r.person_name === person);
  }

  function getPendingTotal(person?: string): number {
    const items = person ? receivables.filter((r) => r.person_name === person) : receivables;
    return items.reduce((sum, r) => sum + Math.max(0, Number(r.amount) - Number(r.amount_paid ?? 0)), 0);
  }

  return {
    receivables,
    series,
    isLoading,
    people,
    refetch: fetchAll,
    addReceivable,
    updateAmountPaid,
    togglePaid,
    deleteReceivable,
    addSeries,
    updateSeries,
    deleteSeries,
    getByPerson,
    getSeriesByPerson,
    getPendingTotal,
  };
}
