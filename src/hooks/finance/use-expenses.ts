'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import { usePlanningHorizonListener } from '@/hooks/finance/use-planning-horizon-listener';
import { buildMonthRange, monthInputValueToFirstDay, toMonthDate } from '@/lib/finance/finance';
import { getLocalDateStr } from '@/lib/daily-goals/timezone';
import type { ExpenseCategory, ExpenseItem, ExpenseEntry } from '@/types/finance';

function normalizeMonthKey(m: string): string {
  if (!m) return '';
  return m.length >= 10 ? m.slice(0, 10) : m;
}

export type AddExpenseItemOptions = {
  defaultAmount?: number | null;
  isRecurring?: boolean;
  monthFrom?: string;
  monthTo?: string;
  visibleMonths?: string[];
  /** 1–31 ou null para limpar. */
  dueDay?: number | null;
};

export function useExpenses() {
  const user = useUserStore((s) => s.user);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const [{ data: catData }, { data: itemData }, { data: entData }] = await Promise.all([
      supabase
        .from('finance_expense_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('finance_expense_items')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('finance_expense_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('month', { ascending: false }),
    ]);
    setCategories((catData ?? []) as ExpenseCategory[]);
    setItems(
      (itemData ?? []).map((raw) => {
        const i = raw as ExpenseItem & { is_recurring?: boolean };
        return {
          ...i,
          category_id: i.category_id ?? null,
          is_recurring: Boolean(i.is_recurring),
          default_amount: i.default_amount != null ? Number(i.default_amount) : null,
          due_day: i.due_day != null ? Number(i.due_day) : null,
        };
      }),
    );
    setEntries(
      (entData ?? []).map((raw) => {
        const e = raw as ExpenseEntry & { paid_note?: string | null };
        return { ...e, paid_note: e.paid_note ?? null } as ExpenseEntry;
      }),
    );
    setIsLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  usePlanningHorizonListener(fetchAll);

  const ensureRecurringExpenseEntriesForMonths = useCallback(
    async (visibleMonths: string[]) => {
      if (!user?.id || visibleMonths.length === 0) return;
      const supabase = createClient();
      const [{ data: itemData }, { data: entData }] = await Promise.all([
        supabase.from('finance_expense_items').select('*').eq('user_id', user.id),
        supabase.from('finance_expense_entries').select('*').eq('user_id', user.id),
      ]);
      const itms = (itemData ?? []) as (ExpenseItem & { is_recurring?: boolean })[];
      const ents = (entData ?? []) as ExpenseEntry[];
      const monthKeys = [...new Set(visibleMonths.map(normalizeMonthKey))].filter(Boolean);
      const rows: { user_id: string; item_id: string; month: string; amount: number }[] = [];
      for (const raw of itms) {
        if (!raw.is_active || !raw.is_recurring) continue;
        const amt = raw.default_amount != null ? Number(raw.default_amount) : 0;
        if (amt <= 0) continue;
        for (const m of monthKeys) {
          const exists = ents.some(
            (e) => e.item_id === raw.id && normalizeMonthKey(e.month) === m,
          );
          if (exists) continue;
          rows.push({ user_id: user.id, item_id: raw.id, month: m, amount: amt });
        }
      }
      if (rows.length === 0) return;
      const { error } = await supabase.from('finance_expense_entries').upsert(rows, {
        onConflict: 'user_id,item_id,month',
      });
      if (!error) await fetchAll();
    },
    [user?.id, fetchAll],
  );

  async function upsertEntry(itemId: string, month: string, amount: number) {
    if (!user) return;
    const supabase = createClient();
    const mk = normalizeMonthKey(month);
    const { data, error } = await supabase
      .from('finance_expense_entries')
      .upsert(
        { user_id: user.id, item_id: itemId, month: mk, amount },
        { onConflict: 'user_id,item_id,month' },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    const updated = data as ExpenseEntry;
    setEntries((prev) => {
      const idx = prev.findIndex(
        (e) => e.item_id === itemId && normalizeMonthKey(e.month) === mk,
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [updated, ...prev];
    });
    return updated;
  }

  /** Mesmo valor em todos os meses indicados; preserva `is_paid` / `paid_at` das células existentes. */
  const fillItemColumnForMonths = useCallback(
    async (itemId: string, months: string[], amount: number) => {
      if (!user?.id || months.length === 0) return;
      const supabase = createClient();
      const { data: entData } = await supabase
        .from('finance_expense_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('item_id', itemId);
      const existingForItem = (entData ?? []) as ExpenseEntry[];
      const byMonth = new Map(existingForItem.map((e) => [normalizeMonthKey(e.month), e]));
      const amt = Math.max(0, amount);
      const rows = months.map((month) => {
        const mk = normalizeMonthKey(month);
        const existing = byMonth.get(mk);
        return {
          user_id: user.id!,
          item_id: itemId,
          month: mk,
          amount: amt,
          is_paid: existing?.is_paid ?? false,
          paid_at: existing?.paid_at ?? null,
          paid_note: existing?.paid_note ?? null,
        };
      });
      const { error } = await supabase.from('finance_expense_entries').upsert(rows, {
        onConflict: 'user_id,item_id,month',
      });
      if (error) throw new Error(error.message);
      await fetchAll();
    },
    [user?.id, fetchAll],
  );

  async function togglePaid(itemId: string, month: string, paidNote?: string | null) {
    if (!user) return;
    const mk = normalizeMonthKey(month);
    const existing = entries.find(
      (e) => e.item_id === itemId && normalizeMonthKey(e.month) === mk,
    );
    const item = items.find((i) => i.id === itemId);
    const baseAmount = existing
      ? Number(existing.amount ?? 0)
      : item?.is_recurring && item.default_amount != null
        ? Number(item.default_amount)
        : 0;
    const newPaid = !(existing?.is_paid ?? false);
    const paidAt = newPaid ? getLocalDateStr(user?.profile?.timezone) : null;
    const noteToStore = newPaid
      ? paidNote !== undefined
        ? (paidNote ?? '').trim() || null
        : null
      : null;

    const supabase = createClient();
    const { data, error } = await supabase
      .from('finance_expense_entries')
      .upsert(
        {
          user_id: user.id,
          item_id: itemId,
          month: mk,
          amount: baseAmount,
          is_paid: newPaid,
          paid_at: paidAt,
          paid_note: noteToStore,
        },
        { onConflict: 'user_id,item_id,month' },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    const updated = data as ExpenseEntry;
    setEntries((prev) => {
      const idx = prev.findIndex(
        (e) => e.item_id === itemId && normalizeMonthKey(e.month) === mk,
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [updated, ...prev];
    });
  }

  async function addCategory(name: string, color?: string) {
    if (!user) return;
    const supabase = createClient();
    const maxOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.sort_order)) + 1 : 0;
    const { data, error } = await supabase
      .from('finance_expense_categories')
      .insert({ user_id: user.id, name, color: color ?? null, sort_order: maxOrder })
      .select()
      .single();
    if (error) throw new Error(error.message);
    setCategories((prev) => [...prev, data as ExpenseCategory]);
    return data as ExpenseCategory;
  }

  async function updateCategory(id: string, patch: { name?: string; color?: string | null }) {
    if (!user) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('finance_expense_categories')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const row = data as ExpenseCategory;
    setCategories((prev) => prev.map((c) => (c.id === id ? row : c)));
    return row;
  }

  async function deleteCategory(id: string) {
    if (!user) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('finance_expense_categories')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) throw new Error(error.message);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    await fetchAll();
  }

  async function addItem(categoryId: string | null, name: string, opts?: AddExpenseItemOptions) {
    if (!user) return;
    const supabase = createClient();
    const categoryItems = items.filter((i) => (i.category_id ?? null) === (categoryId ?? null));
    const maxOrder = categoryItems.length > 0 ? Math.max(...categoryItems.map((i) => i.sort_order)) + 1 : 0;
    const defaultAmt =
      opts?.defaultAmount != null && !Number.isNaN(Number(opts.defaultAmount))
        ? Number(opts.defaultAmount)
        : null;
    const recurring = opts?.isRecurring ?? false;
    const dueDay =
      opts?.dueDay !== undefined && opts.dueDay !== null && !Number.isNaN(Number(opts.dueDay))
        ? Math.min(31, Math.max(1, Math.round(Number(opts.dueDay))))
        : null;
    const { data, error } = await supabase
      .from('finance_expense_items')
      .insert({
        user_id: user.id,
        category_id: categoryId ?? null,
        name,
        default_amount: defaultAmt,
        is_recurring: recurring,
        sort_order: maxOrder,
        due_day: dueDay,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const newId = (data as ExpenseItem).id;
    const fillAmount = defaultAmt ?? 0;
    let from = opts?.monthFrom ?? toMonthDate(new Date());
    let to = opts?.monthTo ?? from;
    if (from > to) [from, to] = [to, from];
    const rangeMonths = buildMonthRange(from, to);
    const monthSet = new Set(rangeMonths.map(normalizeMonthKey));
    if (recurring && fillAmount > 0 && (opts?.visibleMonths?.length ?? 0) > 0) {
      for (const vm of opts!.visibleMonths!) {
        monthSet.add(normalizeMonthKey(vm));
      }
    }
    const rows = [...monthSet].sort().map((m) => ({
      user_id: user.id,
      item_id: newId,
      month: m,
      amount: fillAmount,
    }));
    if (rows.length > 0) {
      const { error: upErr } = await supabase.from('finance_expense_entries').upsert(rows, {
        onConflict: 'user_id,item_id,month',
      });
      if (upErr) throw new Error(upErr.message);
    }
    await fetchAll();
    return data as ExpenseItem;
  }

  async function updateItem(
    id: string,
    patch: Partial<
      Pick<
        ExpenseItem,
        'name' | 'is_active' | 'default_amount' | 'is_recurring' | 'category_id' | 'due_day'
      >
    >,
    monthRange?: { monthFrom: string; monthTo: string },
  ) {
    if (!user) return;
    const prev = items.find((i) => i.id === id);
    if (!prev) return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from('finance_expense_items')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const row = data as ExpenseItem & { is_recurring?: boolean };
    setItems((prevList) =>
      prevList.map((i) =>
        i.id === id
          ? {
              ...row,
              category_id: row.category_id ?? null,
              is_recurring: Boolean(row.is_recurring),
              default_amount: row.default_amount != null ? Number(row.default_amount) : null,
            }
          : i,
      ),
    );

    if (monthRange) {
      let from = monthInputValueToFirstDay(monthRange.monthFrom);
      let to = monthInputValueToFirstDay(monthRange.monthTo);
      if (from > to) [from, to] = [to, from];
      const rangeSet = new Set(buildMonthRange(from, to).map(normalizeMonthKey));

      const itemEntries = entries.filter((e) => e.item_id === id);
      const outside = itemEntries.filter((e) => !rangeSet.has(normalizeMonthKey(e.month)));
      if (outside.length > 0) {
        const { error: delErr } = await supabase
          .from('finance_expense_entries')
          .delete()
          .in(
            'id',
            outside.map((e) => e.id),
          );
        if (delErr) throw new Error(delErr.message);
      }

      const mergedDefault =
        patch.default_amount !== undefined ? patch.default_amount : prev.default_amount;
      const fillAmt =
        mergedDefault != null && !Number.isNaN(Number(mergedDefault)) && Number(mergedDefault) > 0
          ? Number(mergedDefault)
          : 0;

      const keptKeys = new Set(
        itemEntries
          .filter((e) => rangeSet.has(normalizeMonthKey(e.month)))
          .map((e) => normalizeMonthKey(e.month)),
      );
      const rows = [...rangeSet]
        .sort()
        .filter((m) => !keptKeys.has(m))
        .map((m) => ({
          user_id: user.id,
          item_id: id,
          month: m,
          amount: fillAmt,
        }));
      if (rows.length > 0) {
        const { error: upErr } = await supabase.from('finance_expense_entries').upsert(rows, {
          onConflict: 'user_id,item_id,month',
        });
        if (upErr) throw new Error(upErr.message);
      }
      await fetchAll();
    }
  }

  function getEntry(itemId: string, month: string): ExpenseEntry | undefined {
    return entries.find(
      (e) => e.item_id === itemId && normalizeMonthKey(e.month) === normalizeMonthKey(month),
    );
  }

  const activeItems = items.filter((i) => i.is_active);

  function getEffectiveExpenseAmount(itemId: string, month: string): number {
    const item = items.find((i) => i.id === itemId);
    if (!item) return 0;
    const e = getEntry(itemId, month);
    if (e) return Number(e.amount ?? 0);
    if (item.is_recurring && item.default_amount != null && Number(item.default_amount) > 0) {
      return Number(item.default_amount);
    }
    return 0;
  }

  function getMonthlyTotal(month: string): number {
    return activeItems.reduce((sum, item) => sum + getEffectiveExpenseAmount(item.id, month), 0);
  }

  function getCategoryTotal(categoryId: string, month: string): number {
    return activeItems
      .filter((i) => i.category_id === categoryId)
      .reduce((sum, item) => sum + getEffectiveExpenseAmount(item.id, month), 0);
  }

  function getUncategorizedTotal(month: string): number {
    return activeItems
      .filter((i) => !i.category_id)
      .reduce((sum, item) => sum + getEffectiveExpenseAmount(item.id, month), 0);
  }

  return {
    categories,
    items,
    activeItems,
    entries,
    isLoading,
    refetch: fetchAll,
    upsertEntry,
    togglePaid,
    addCategory,
    updateCategory,
    deleteCategory,
    addItem,
    updateItem,
    getEntry,
    getMonthlyTotal,
    getCategoryTotal,
    getUncategorizedTotal,
    getEffectiveExpenseAmount,
    ensureRecurringExpenseEntriesForMonths,
    fillItemColumnForMonths,
  };
}
