'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import type { List } from '@/types/database';

export type ListWithCounts = List & { item_count: number; checked_count: number };

export function useLists() {
  const user = useUserStore((s) => s.user);
  const [lists, setLists] = useState<ListWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const supabase = createClient();

    // Round 1: listas pessoais + memberships + owned households — tudo em paralelo
    const [{ data: personal }, { data: memberRows }, { data: ownedHH }] =
      await Promise.all([
        supabase
          .from('lists')
          .select('*')
          .eq('owner_id', user.id)
          .is('household_id', null)
          .eq('is_archived', false)
          .order('sort_order', { ascending: true }),
        supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', user.id)
          .eq('status', 'active'),
        supabase.from('households').select('id').eq('owner_id', user.id),
      ]);

    const memberIds = (memberRows ?? []).map((r) => r.household_id);
    const ownedHHIds = (ownedHH ?? []).map((h: { id: string }) => h.id);
    const allHHIds = [...new Set([...memberIds, ...ownedHHIds])];

    // Round 2: household lists (se existirem households) — em paralelo com nada, mas
    // não bloqueia caso não haja nenhum household
    const { data: householdListsData } = allHHIds.length > 0
      ? await supabase
          .from('lists')
          .select('*')
          .in('household_id', allHHIds)
          .eq('is_archived', false)
          .order('sort_order', { ascending: true })
      : { data: [] };

    const allLists: List[] = [
      ...((personal ?? []) as List[]),
      ...((householdListsData ?? []) as List[]),
    ];

    if (allLists.length === 0) {
      setLists([]);
      setIsLoading(false);
      return;
    }

    // Round 3: contagem de itens para todas as listas de uma vez só
    const { data: items } = await supabase
      .from('list_items')
      .select('list_id, is_checked')
      .in('list_id', allLists.map((l) => l.id));

    setLists(
      allLists.map((list) => {
        const its = (items ?? []).filter((i) => i.list_id === list.id);
        return {
          ...list,
          item_count: its.length,
          checked_count: its.filter((i) => i.is_checked).length,
        };
      }),
    );
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { lists, isLoading, refetch: fetch };
}
