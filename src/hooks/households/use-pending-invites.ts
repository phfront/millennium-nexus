'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import type { Household, HouseholdMember } from '@/types/database';

export type PendingInvite = HouseholdMember & { household: Household | null };

export function usePendingInvites() {
  const user = useUserStore((s) => s.user);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    // Query 1: por user_id (funciona com RLS actual)
    // Query 2: por email onde user_id é null (requer migration 029)
    // Ambas em paralelo
    const [{ data: byUserId }, { data: byEmail }] = await Promise.all([
      supabase
        .from('household_members')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending'),
      user.email
        ? supabase
            .from('household_members')
            .select('*')
            .eq('invited_email', user.email)
            .is('user_id', null)
            .eq('status', 'pending')
        : Promise.resolve({ data: [] }),
    ]);

    // Merge sem duplicatas
    const combined = [
      ...((byUserId ?? []) as HouseholdMember[]),
      ...((byEmail ?? []) as HouseholdMember[]),
    ].filter(
      (inv, idx, self) => self.findIndex((i) => i.id === inv.id) === idx,
    );

    if (combined.length === 0) {
      setInvites([]);
      setIsLoading(false);
      return;
    }

    // Busca os household names para todos os convites de uma vez
    const householdIds = [...new Set(combined.map((i) => i.household_id))];
    const { data: households } = await supabase
      .from('households')
      .select('*')
      .in('id', householdIds);

    const householdMap = Object.fromEntries(
      ((households ?? []) as Household[]).map((h) => [h.id, h]),
    );

    setInvites(
      combined.map((inv) => ({
        ...inv,
        household: householdMap[inv.household_id] ?? null,
      })),
    );
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { invites, isLoading, refetch: fetch };
}
