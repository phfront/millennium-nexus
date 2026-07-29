'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import type { Subscription } from '@/types/finance';

export function useSubscriptions() {
  const user = useUserStore((s) => s.user);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('finance_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('is_active', { ascending: false });
    setSubscriptions(
      (data ?? []).map((raw) => {
        const s = raw as Subscription;
        return {
          ...s,
          amount: Number(s.amount ?? 0),
          paid_with_item_id: s.paid_with_item_id ?? null,
        };
      }),
    );
    setIsLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function addSubscription(values: Omit<Subscription, 'id' | 'user_id' | 'created_at'>) {
    if (!user) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('finance_subscriptions')
      .insert({ ...values, user_id: user.id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    setSubscriptions((prev) => [data as Subscription, ...prev]);
    return data as Subscription;
  }

  async function updateSubscription(id: string, patch: Partial<Omit<Subscription, 'id' | 'user_id' | 'created_at'>>) {
    if (!user) return;
    // Atualização otimista
    setSubscriptions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
    const supabase = createClient();
    const { data, error } = await supabase
      .from('finance_subscriptions')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) {
      await fetchAll();
      throw new Error(error.message);
    }
    setSubscriptions((prev) => prev.map((s) => (s.id === id ? (data as Subscription) : s)));
  }

  /**
   * Aponta várias assinaturas para o mesmo cartão de uma vez (`null` = tirar do
   * cartão). Uma chamada só: a tela de assinaturas é longa e arrumá-la item a
   * item era o trabalho que esta função existe para evitar.
   */
  async function setCardForMany(ids: string[], cardItemId: string | null) {
    if (!user || ids.length === 0) return;
    const previous = subscriptions;
    setSubscriptions((prev) =>
      prev.map((s) => (ids.includes(s.id) ? { ...s, paid_with_item_id: cardItemId } : s)),
    );
    const supabase = createClient();
    const { error } = await supabase
      .from('finance_subscriptions')
      .update({ paid_with_item_id: cardItemId })
      .in('id', ids)
      .eq('user_id', user.id);
    if (error) {
      setSubscriptions(previous);
      throw new Error(error.message);
    }
  }

  async function deleteSubscription(id: string) {
    if (!user) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('finance_subscriptions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) throw new Error(error.message);
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
  }

  /** Ordem alfabética: `localeCompare` e não a do banco, para acentos caírem onde se espera. */
  const byName = (a: Subscription, b: Subscription) => a.name.localeCompare(b.name, 'pt-BR');
  const active = subscriptions.filter((s) => s.is_active).sort(byName);
  const inactive = subscriptions.filter((s) => !s.is_active).sort(byName);
  const monthlyTotal = active.reduce((sum, s) => {
    return sum + (s.billing_cycle === 'yearly' ? s.amount / 12 : s.amount);
  }, 0);

  return { subscriptions, active, inactive, monthlyTotal, isLoading, refetch: fetchAll, addSubscription, updateSubscription, setCardForMany, deleteSubscription };
}
