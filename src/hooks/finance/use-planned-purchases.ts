'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import type { PlannedPurchase } from '@/lib/finance/planning';

/** Campos que a tela escreve (o resto o banco preenche). */
export type PlannedPurchaseInput = Pick<
  PlannedPurchase,
  | 'name'
  | 'amount'
  | 'pay_mode'
  | 'installments'
  | 'installment_amounts'
  | 'start_month'
  | 'card_item_id'
  | 'is_included'
>;

/** PostgREST devolve numeric como número, mas o array pode vir como string em versões antigas. */
function normalize(row: PlannedPurchase): PlannedPurchase {
  return {
    ...row,
    amount: Number(row.amount),
    installments: Number(row.installments),
    installment_amounts: row.installment_amounts ? row.installment_amounts.map(Number) : null,
  };
}

/**
 * CRUD das compras planejadas. Atualização otimista: a tela recalcula os
 * meses a cada tecla, e esperar o banco a cada mudança de parcela deixaria a
 * tabela piscando. Se a gravação falha, volta ao que estava e repassa o erro.
 */
export function usePlannedPurchases() {
  const user = useUserStore((s) => s.user);
  const [purchases, setPurchases] = useState<PlannedPurchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('finance_planned_purchases')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    setPurchases(((data ?? []) as PlannedPurchase[]).map(normalize));
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const create = useCallback(
    async (input: PlannedPurchaseInput): Promise<PlannedPurchase> => {
      if (!user) throw new Error('Sessão inválida.');
      const supabase = createClient();
      const sortOrder = purchases.reduce((max, p) => Math.max(max, p.sort_order), 0) + 1;
      const { data, error } = await supabase
        .from('finance_planned_purchases')
        .insert({ ...input, user_id: user.id, sort_order: sortOrder })
        .select()
        .single();
      if (error) throw new Error(error.message);
      const row = normalize(data as PlannedPurchase);
      setPurchases((prev) => [...prev, row]);
      return row;
    },
    [user, purchases],
  );

  const update = useCallback(
    async (id: string, patch: Partial<PlannedPurchaseInput>) => {
      const before = purchases;
      setPurchases((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      const supabase = createClient();
      const { error } = await supabase
        .from('finance_planned_purchases')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        setPurchases(before);
        throw new Error(error.message);
      }
    },
    [purchases],
  );

  /** Apaga e devolve a linha, para o "Desfazer" poder pôr de volta. */
  const remove = useCallback(
    async (id: string): Promise<PlannedPurchase | null> => {
      const target = purchases.find((p) => p.id === id) ?? null;
      if (!target) return null;
      setPurchases((prev) => prev.filter((p) => p.id !== id));
      const supabase = createClient();
      const { error } = await supabase.from('finance_planned_purchases').delete().eq('id', id);
      if (error) {
        setPurchases((prev) => [...prev, target].sort((a, b) => a.sort_order - b.sort_order));
        throw new Error(error.message);
      }
      return target;
    },
    [purchases],
  );

  /** Desfazer de uma exclusão: grava a mesma linha de novo, com o mesmo id e ordem. */
  const restore = useCallback(async (row: PlannedPurchase) => {
    const supabase = createClient();
    const { error } = await supabase.from('finance_planned_purchases').insert({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      amount: row.amount,
      pay_mode: row.pay_mode,
      installments: row.installments,
      installment_amounts: row.installment_amounts,
      start_month: row.start_month,
      card_item_id: row.card_item_id,
      is_included: row.is_included,
      sort_order: row.sort_order,
    });
    if (error) throw new Error(error.message);
    setPurchases((prev) => [...prev, row].sort((a, b) => a.sort_order - b.sort_order));
  }, []);

  return { purchases, isLoading, refetch: fetchAll, create, update, remove, restore };
}
