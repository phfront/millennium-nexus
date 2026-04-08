'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { acceptInvite, declineInvite } from '@/lib/households/actions';
import { usePendingInvites } from '@/hooks/households/use-pending-invites';
import { Users, X, Check } from 'lucide-react';

export function PendingInvitesBanner() {
  const { invites, isLoading, refetch } = usePendingInvites();
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const validInvites = invites; // mostra todos — household pode ser null (usa fallback 'Grupo')
  if (isLoading || validInvites.length === 0) return null;

  async function handleAccept(inviteId: string) {
    setLoadingId(inviteId);
    try {
      await acceptInvite(inviteId);
      await refetch();
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDecline(inviteId: string) {
    setLoadingId(inviteId);
    try {
      await declineInvite(inviteId);
      await refetch();
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="mx-4 md:mx-6 mt-3 flex flex-col gap-2">
      {validInvites.map((invite) => (
        <div
          key={invite.id}
          className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
            <Users size={15} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-text-primary truncate">
              Convite para{' '}
              <span className="text-amber-400">{invite.household?.name ?? 'Grupo'}</span>
            </p>
            <p className="text-xs text-text-muted">
              Você foi convidado para fazer parte deste grupo
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => handleDecline(invite.id)}
              disabled={loadingId === invite.id}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-3 hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
              title="Recusar"
            >
              <X size={13} />
            </button>
            <button
              onClick={() => handleAccept(invite.id)}
              disabled={loadingId === invite.id}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 transition-colors disabled:opacity-50"
              title="Aceitar"
            >
              <Check size={13} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
