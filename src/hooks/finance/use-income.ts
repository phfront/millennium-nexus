'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import { usePlanningHorizonListener } from '@/hooks/finance/use-planning-horizon-listener';
import { normalizeOptionalCurrencyCode } from '@/lib/finance/currency';
import type { IncomeSource, IncomeEntry } from '@/types/finance';

function normalizeMonthKey(m: string): string {
  if (!m) return '';
  return m.length >= 10 ? m.slice(0, 10) : m;
}

/** PostgREST devolve numéricos como string e a moeda pode vir suja/ausente. */
function normalizeSource(row: IncomeSource): IncomeSource {
  const currency = normalizeOptionalCurrencyCode(row.currency);
  return {
    ...row,
    default_monthly_amount: Number(row.default_monthly_amount ?? 0),
    currency,
    // Sem moeda própria, a fronteira não significa nada.
    currency_since: currency && row.currency_since ? normalizeMonthKey(row.currency_since) : null,
  };
}

export function useIncome() {
  const user = useUserStore((s) => s.user);
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const [{ data: srcData }, { data: entData }] = await Promise.all([
      supabase
        .from('finance_income_sources')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('finance_income_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('month', { ascending: false }),
    ]);
    const rawSources = (srcData ?? []) as IncomeSource[];
    setSources(rawSources.map(normalizeSource));
    setEntries((entData ?? []) as IncomeEntry[]);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  usePlanningHorizonListener(fetchAll);

  /** Cria entradas em falta com o valor padrão da fonte (só meses sem linha na BD). */
  const ensureDefaultIncomeEntriesForMonths = useCallback(
    async (months: string[]) => {
      if (!user?.id || months.length === 0) return;
      const supabase = createClient();
      const [{ data: srcData }, { data: entData }] = await Promise.all([
        supabase.from('finance_income_sources').select('*').eq('user_id', user.id),
        supabase.from('finance_income_entries').select('*').eq('user_id', user.id),
      ]);
      const srcs = (srcData ?? []) as IncomeSource[];
      const ents = (entData ?? []) as IncomeEntry[];
      const monthKeys = [...new Set(months.map(normalizeMonthKey))].filter(Boolean);
      const rows: { user_id: string; source_id: string; month: string; amount: number }[] = [];
      for (const s of srcs) {
        if (!s.is_active) continue;
        const amt = Number((s as { default_monthly_amount?: number }).default_monthly_amount ?? 0);
        if (amt <= 0) continue;
        for (const m of monthKeys) {
          const exists = ents.some(
            (e) => e.source_id === s.id && normalizeMonthKey(e.month) === m,
          );
          if (exists) continue;
          rows.push({ user_id: user.id, source_id: s.id, month: m, amount: amt });
        }
      }
      if (rows.length === 0) return;
      const { error } = await supabase.from('finance_income_entries').upsert(rows, {
        onConflict: 'user_id,source_id,month',
      });
      if (!error) await fetchAll();
    },
    [user?.id, fetchAll],
  );

  async function upsertEntry(sourceId: string, month: string, amount: number) {
    if (!user) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('finance_income_entries')
      .upsert(
        { user_id: user.id, source_id: sourceId, month, amount },
        { onConflict: 'user_id,source_id,month' },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    const updated = data as IncomeEntry;
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.source_id === sourceId && e.month === month);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [updated, ...prev];
    });
    return updated;
  }

  const fillSourceColumnForMonths = useCallback(
    async (sourceId: string, months: string[], amount: number) => {
      if (!user?.id || months.length === 0) return;
      const supabase = createClient();
      const amt = Math.max(0, amount);
      const rows = months.map((month) => ({
        user_id: user.id!,
        source_id: sourceId,
        month: normalizeMonthKey(month),
        amount: amt,
      }));
      const { error } = await supabase.from('finance_income_entries').upsert(rows, {
        onConflict: 'user_id,source_id,month',
      });
      if (error) throw new Error(error.message);
      await fetchAll();
    },
    [user?.id, fetchAll],
  );

  /** `currency` null = a fonte lança na moeda padrão do usuário. */
  async function addSource(
    name: string,
    defaultMonthlyAmount = 0,
    currency: string | null = null,
    currencySince: string | null = null,
  ) {
    if (!user) return;
    const supabase = createClient();
    const maxOrder = sources.length > 0 ? Math.max(...sources.map((s) => s.sort_order)) + 1 : 0;
    const safeDefault = Math.max(0, Number(defaultMonthlyAmount) || 0);
    const code = normalizeOptionalCurrencyCode(currency);
    const { data, error } = await supabase
      .from('finance_income_sources')
      .insert({
        user_id: user.id,
        name,
        sort_order: maxOrder,
        default_monthly_amount: safeDefault,
        currency: code,
        currency_since: code ? currencySince : null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const row = normalizeSource(data as IncomeSource);
    setSources((prev) => [...prev, row]);
    return row;
  }

  /**
   * Troca a moeda de uma fonte a partir de `since` (mês 'YYYY-MM-DD'; null = todo
   * o histórico). `factor` > 0 reescreve os valores desses meses — e o padrão
   * mensal — para a moeda nova; `factor = 1` só re-etiqueta, mantendo os números.
   * Lançamentos anteriores a `since` nunca são tocados nem reinterpretados.
   */
  const changeSourceCurrency = useCallback(
    async (
      sourceId: string,
      nextCurrency: string | null,
      factor: number,
      since: string | null = null,
    ) => {
      if (!user?.id) return;
      const supabase = createClient();
      const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
      const code = normalizeOptionalCurrencyCode(nextCurrency);
      const boundary = code && since ? normalizeMonthKey(since) : null;

      if (safeFactor !== 1) {
        let query = supabase
          .from('finance_income_entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('source_id', sourceId);
        if (boundary) query = query.gte('month', boundary);

        const { data, error: readError } = await query;
        if (readError) throw new Error(readError.message);

        const rescaled = (data ?? []).map((row) => {
          const entry = row as IncomeEntry;
          return { ...entry, amount: Math.round(Number(entry.amount ?? 0) * safeFactor * 100) / 100 };
        });
        if (rescaled.length > 0) {
          const { error } = await supabase
            .from('finance_income_entries')
            .upsert(rescaled, { onConflict: 'user_id,source_id,month' });
          if (error) throw new Error(error.message);
        }
      }

      const source = sources.find((s) => s.id === sourceId);
      const nextDefault =
        safeFactor === 1
          ? undefined
          : Math.round(Number(source?.default_monthly_amount ?? 0) * safeFactor * 100) / 100;

      const { error } = await supabase
        .from('finance_income_sources')
        .update({
          currency: code,
          currency_since: boundary,
          ...(nextDefault === undefined ? {} : { default_monthly_amount: nextDefault }),
        })
        .eq('id', sourceId)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);

      await fetchAll();
    },
    [user?.id, sources, fetchAll],
  );

  async function updateSource(
    id: string,
    patch: Partial<
      Pick<
        IncomeSource,
        'name' | 'is_active' | 'sort_order' | 'default_monthly_amount' | 'currency' | 'currency_since'
      >
    >,
  ) {
    if (!user) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('finance_income_sources')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const row = normalizeSource(data as IncomeSource);
    setSources((prev) => prev.map((s) => (s.id === id ? row : s)));
  }

  function getEntry(sourceId: string, month: string): IncomeEntry | undefined {
    return entries.find((e) => e.source_id === sourceId && e.month === month);
  }

  /**
   * Soma bruta das entradas do mês, cada uma na moeda da sua fonte — só é
   * comparável se todas as fontes usarem a mesma moeda. Para o total real usa
   * `finance_monthly_summary` (a view já converte) ou converte aqui com
   * `useCurrencyConversion().convert(amount, source.currency)`.
   */
  function getMonthlyTotal(month: string): number {
    return entries
      .filter((e) => e.month === month)
      .reduce((sum, e) => sum + (e.amount ?? 0), 0);
  }

  const activeSources = sources.filter((s) => s.is_active);

  return {
    sources,
    activeSources,
    entries,
    isLoading,
    refetch: fetchAll,
    upsertEntry,
    addSource,
    updateSource,
    changeSourceCurrency,
    getEntry,
    getMonthlyTotal,
    ensureDefaultIncomeEntriesForMonths,
    fillSourceColumnForMonths,
  };
}
