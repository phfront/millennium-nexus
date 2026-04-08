'use client';

import Link from 'next/link';
import type { Household, HouseholdMember } from '@/types/database';
import { useUserStore } from '@/store/user-store';
import { Crown, ChevronRight, Users } from 'lucide-react';

interface HouseholdCardProps {
  household: Household & { members: HouseholdMember[] };
}

export function HouseholdCard({ household }: HouseholdCardProps) {
  const user = useUserStore((s) => s.user);
  const isOwner = household.owner_id === user?.id;

  const activeMembers = household.members.filter((m) => m.status === 'active');
  const pendingCount = household.members.filter((m) => m.status === 'pending').length;

  return (
    <Link
      href={`/households/${household.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-surface-2 px-5 py-4 hover:border-brand-primary/40 hover:bg-surface-3 transition-all duration-200"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-primary/15 text-2xl">
        🏠
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-text-primary truncate">{household.name}</p>
          {isOwner && (
            <Crown size={13} className="text-amber-400 shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-xs text-text-muted flex items-center gap-1">
            <Users size={11} />
            {activeMembers.length}{' '}
            {activeMembers.length === 1 ? 'membro' : 'membros'}
          </p>
          {pendingCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
              {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <ChevronRight
        size={16}
        className="text-text-muted shrink-0 group-hover:text-brand-primary transition-colors"
      />
    </Link>
  );
}
