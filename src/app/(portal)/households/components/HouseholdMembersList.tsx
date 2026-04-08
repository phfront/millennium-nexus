'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeMember, leaveHousehold } from '@/lib/households/actions';
import type { Household, HouseholdMember } from '@/types/database';
import { useUserStore } from '@/store/user-store';
import { Crown, UserMinus, LogOut, Clock } from 'lucide-react';

interface HouseholdMembersListProps {
  household: Household;
  members: HouseholdMember[];
  onUpdate?: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  pending: 'Pendente',
};

export function HouseholdMembersList({
  household,
  members,
  onUpdate,
}: HouseholdMembersListProps) {
  const user = useUserStore((s) => s.user);
  const router = useRouter();
  const isOwner = household.owner_id === user?.id;
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const active = members.filter((m) => m.status === 'active');
  const pending = members.filter((m) => m.status === 'pending');

  async function handleRemove(memberId: string) {
    setLoadingId(memberId);
    startTransition(async () => {
      try {
        await removeMember(memberId);
        onUpdate?.();
        router.refresh();
      } finally {
        setLoadingId(null);
      }
    });
  }

  async function handleLeave() {
    startTransition(async () => {
      await leaveHousehold(household.id);
      router.push('/households');
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Membros ativos */}
      <div className="space-y-1.5">
        {active.map((member) => {
          const isSelf = member.user_id === user?.id;
          const isThisOwner = member.role === 'owner';

          return (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-xl bg-surface-3 px-4 py-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-primary/20 text-sm font-semibold text-brand-primary uppercase">
                {member.invited_email[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {member.invited_email}
                  {isSelf && (
                    <span className="ml-2 text-xs text-text-muted">(você)</span>
                  )}
                </p>
                <p className="text-xs text-text-muted flex items-center gap-1">
                  {isThisOwner && <Crown size={11} className="text-amber-400" />}
                  {isThisOwner ? 'Administrador' : 'Membro'}
                </p>
              </div>
              {isOwner && !isSelf && !isThisOwner && (
                <button
                  onClick={() => handleRemove(member.id)}
                  disabled={loadingId === member.id || isPending}
                  className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                  title="Remover membro"
                >
                  <UserMinus size={13} />
                </button>
              )}
              {!isOwner && isSelf && (
                <button
                  onClick={handleLeave}
                  disabled={isPending}
                  className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                  title="Sair do grupo"
                >
                  <LogOut size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Convites pendentes */}
      {pending.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide px-1">
            Convites pendentes
          </p>
          {pending.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 opacity-70"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-sm text-text-muted uppercase">
                {member.invited_email[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-muted truncate">{member.invited_email}</p>
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <Clock size={11} />
                  {STATUS_LABEL[member.status]}
                </p>
              </div>
              {isOwner && (
                <button
                  onClick={() => handleRemove(member.id)}
                  disabled={loadingId === member.id || isPending}
                  className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                  title="Cancelar convite"
                >
                  <UserMinus size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
