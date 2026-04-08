'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Household, HouseholdMember } from '@/types/database';
import { HouseholdMembersList } from '../components/HouseholdMembersList';
import { InviteMemberModal } from '../components/InviteMemberModal';
import { deleteHousehold } from '@/lib/households/actions';
import { ArrowLeft, UserPlus, Trash2, Crown } from 'lucide-react';
import { Button } from '@phfront/millennium-ui';

interface HouseholdDetailClientProps {
  household: Household & { members: HouseholdMember[] };
  currentUserId: string;
}

export function HouseholdDetailClient({
  household,
  currentUserId,
}: HouseholdDetailClientProps) {
  const router = useRouter();
  const isOwner = household.owner_id === currentUserId;
  const [showInvite, setShowInvite] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteHousehold(household.id);
      router.push('/households');
      router.refresh();
    });
  }

  const activeCount = household.members.filter((m) => m.status === 'active').length;

  return (
    <>
      {/* Back + Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/households"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-3 text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary">{household.name}</h1>
            {isOwner && <Crown size={15} className="text-amber-400" />}
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            {activeCount} {activeCount === 1 ? 'membro ativo' : 'membros ativos'}
          </p>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={() => setShowInvite(true)}
              leftIcon={<UserPlus size={15} />}
            >
              <span className="hidden sm:inline">Convidar</span>
            </Button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/30 hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
              title="Excluir grupo"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="rounded-2xl border border-border bg-surface-2 p-5">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">
          Membros
        </p>
        <HouseholdMembersList
          household={household}
          members={household.members}
          onUpdate={() => router.refresh()}
        />
      </div>

      {/* Modals */}
      {showInvite && (
        <InviteMemberModal
          householdId={household.id}
          householdName={household.name}
          onClose={() => setShowInvite(false)}
          onSuccess={() => router.refresh()}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-surface-2 border border-border shadow-2xl p-6 space-y-5">
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
                  <Trash2 size={20} className="text-red-400" />
                </div>
              </div>
              <h2 className="text-base font-semibold text-text-primary">Excluir grupo?</h2>
              <p className="text-sm text-text-muted">
                Todas as listas partilhadas deste grupo ficarão sem household. Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={handleDelete}
                isLoading={isPending}
              >
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
