'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import type { Household, HouseholdMember } from '@/types/database';

export type HouseholdWithMembers = Household & { members: HouseholdMember[] };

export function useHouseholds() {
  const user = useUserStore((s) => s.user);
  const [households, setHouseholds] = useState<HouseholdWithMembers[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const supabase = createClient();

    // Dispara owned + memberships em paralelo
    const [{ data: owned }, { data: memberRows }] = await Promise.all([
      supabase.from('households').select('*').eq('owner_id', user.id),
      supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .eq('status', 'active'),
    ]);

    const ownedIds = (owned ?? []).map((h: Household) => h.id);
    const foreignIds = (memberRows ?? [])
      .map((r) => r.household_id)
      .filter((id) => !ownedIds.includes(id));

    // Busca foreign households e members de todos em paralelo
    const [foreignResult, membersResult] = await Promise.all([
      foreignIds.length > 0
        ? supabase.from('households').select('*').in('id', foreignIds)
        : Promise.resolve({ data: [] }),
      ownedIds.length > 0 || foreignIds.length > 0
        ? supabase
            .from('household_members')
            .select('*')
            .in('household_id', [...ownedIds, ...foreignIds])
        : Promise.resolve({ data: [] }),
    ]);

    const allHouseholds: Household[] = [
      ...((owned ?? []) as Household[]),
      ...((foreignResult.data ?? []) as Household[]),
    ];

    setHouseholds(
      allHouseholds.map((h) => ({
        ...h,
        members: ((membersResult.data ?? []) as HouseholdMember[]).filter(
          (m) => m.household_id === h.id,
        ),
      })),
    );
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { households, isLoading, refetch: fetch };
}
