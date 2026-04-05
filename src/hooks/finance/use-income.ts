'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import { usePlanningHorizonListener } from '@/hooks/finance/use-planning-horizon-listener';
import type { IncomeSource, IncomeEntry } from '@/types/finance';

function normalizeMonthKey(m: string): string {
  if (!m) return '';
  return m.length >= 10 ? m.slice(0, 10) : m;
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
    setSources(
      rawSources.map((s) => ({
        ...s,
        default_monthly_amount: Number((s as { default_monthly_amount?: number }).default_monthly_amount ?? 0),
      })),
    );
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

  async function addSource(name: string, defaultMonthlyAmount = 0) {
    if (!user) return;
    const supabase = createClient();
    const maxOrder = sources.length > 0 ? Math.max(...sources.map((s) => s.sort_order)) + 1 : 0;
    const safeDefault = Math.max(0, Number(defaultMonthlyAmount) || 0);
    const { data, error } = await supabase
      .from('finance_income_sources')
      .insert({
        user_id: user.id,
        name,
        sort_order: maxOrder,
        default_monthly_amount: safeDefault,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const row = data as IncomeSource;
    setSources((prev) => [...prev, { ...row, default_monthly_amount: Number(row.default_monthly_amount ?? 0) }]);
    return row;
  }

  async function updateSource(
    id: string,
    patch: Partial<Pick<IncomeSource, 'name' | 'is_active' | 'sort_order' | 'default_monthly_amount'>>,
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
    const row = data as IncomeSource;
    setSources((prev) =>
      prev.map((s) =>
        s.id === id ? { ...row, default_monthly_amount: Number(row.default_monthly_amount ?? 0) } : s,
      ),
    );
  }

  function getEntry(sourceId: string, month: string): IncomeEntry | undefined {
    return entries.find((e) => e.source_id === sourceId && e.month === month);
  }

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
    getEntry,
    getMonthlyTotal,
    ensureDefaultIncomeEntriesForMonths,
    fillSourceColumnForMonths,
  };
}
