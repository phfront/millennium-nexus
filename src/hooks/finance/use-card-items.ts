'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';

/** Item de despesa marcado como fatura de cartão (`is_card`). */
export type CardItemOption = {
  id: string;
  name: string;
};

/**
 * Só os cartões, sem o resto da planilha. `useExpenses` também os expõe em
 * `cardItems`, mas traz categorias, itens e TODOS os lançamentos junto — peso
 * que uma tela que só precisa dos nomes não tem por que pagar.
 */
export function useCardItems() {
  const user = useUserStore((s) => s.user);
  const [cardItems, setCardItems] = useState<CardItemOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('finance_expense_items')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('is_card', true)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    setCardItems((data ?? []) as CardItemOption[]);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { cardItems, isLoading, refetch: fetchAll };
}
