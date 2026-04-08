'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useHouseholds } from '@/hooks/households/use-households';
import { usePendingInvites } from '@/hooks/households/use-pending-invites';
import { acceptInvite, declineInvite } from '@/lib/households/actions';
import { HouseholdCard } from './components/HouseholdCard';
import { CreateHouseholdModal } from './components/CreateHouseholdModal';
import { Button } from '@phfront/millennium-ui';
import { Plus, Mail } from 'lucide-react';
import type { HouseholdWithMembers } from '@/hooks/households/use-households';

interface HouseholdsClientPageProps {
  initialHouseholds: HouseholdWithMembers[];
}

export function HouseholdsClientPage({ initialHouseholds }: HouseholdsClientPageProps) {
  const { households, refetch } = useHouseholds();
  const { invites: allInvites, isLoading: invitesLoading, refetch: refetchInvites } = usePendingInvites();
  const invites = allInvites; // mostra todos os convites, mesmo sem nome do grupo (usa fallback)
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [loadingInviteId, setLoadingInviteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const displayHouseholds = households.length > 0 ? households : initialHouseholds;

  async function handleAccept(inviteId: string) {
    setLoadingInviteId(inviteId);
    startTransition(async () => {
      try {
        await acceptInvite(inviteId);
        await Promise.all([refetchInvites(), refetch()]);
        router.refresh();
      } finally {
        setLoadingInviteId(null);
      }
    });
  }

  async function handleDecline(inviteId: string) {
    setLoadingInviteId(inviteId);
    startTransition(async () => {
      try {
        await declineInvite(inviteId);
        await refetchInvites();
      } finally {
        setLoadingInviteId(null);
      }
    });
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Grupos</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Colabore com família e amigos em qualquer módulo
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowCreate(true)}
          leftIcon={<Plus size={15} />}
        >
          <span className="hidden sm:inline">Novo grupo</span>
        </Button>
      </div>

      {/* ── Convites pendentes ─────────────────────────────── */}
      {!invitesLoading && invites.length > 0 && (
        <section className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-amber-400" />
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
              Convites pendentes ({invites.length})
            </p>
          </div>

          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center gap-4 rounded-2xl border border-amber-500/25 bg-amber-500/8 px-5 py-4"
            >
              {/* Ícone */}
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-xl">
                🏠
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary truncate">
                  {invite.household?.name ?? 'Grupo'}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  Você foi convidado para fazer parte deste grupo
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingInviteId === invite.id || isPending}
                  onClick={() => handleDecline(invite.id)}
                >
                  Recusar
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  isLoading={loadingInviteId === invite.id}
                  disabled={loadingInviteId === invite.id || isPending}
                  onClick={() => handleAccept(invite.id)}
                >
                  Aceitar
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Lista de grupos ────────────────────────────────── */}
      {displayHouseholds.length === 0 && (invitesLoading || invites.length === 0) ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-3 text-3xl">
            🏠
          </div>
          <div>
            <p className="font-semibold text-text-primary">Nenhum grupo ainda</p>
            <p className="text-sm text-text-muted mt-1 max-w-xs">
              Crie um grupo para partilhar listas, metas e muito mais com família e amigos.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowCreate(true)}
            leftIcon={<Plus size={15} />}
          >
            Criar primeiro grupo
          </Button>
        </div>
      ) : displayHouseholds.length > 0 ? (
        <div className="space-y-3">
          {displayHouseholds.map((h) => (
            <HouseholdCard key={h.id} household={h} />
          ))}
        </div>
      ) : null}

      {showCreate && (
        <CreateHouseholdModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            refetch();
            router.refresh();
          }}
        />
      )}
    </>
  );
}
