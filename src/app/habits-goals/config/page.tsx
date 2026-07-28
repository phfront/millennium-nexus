'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader, Skeleton, EmptyState, useToast } from '@phfront/millennium-ui';
import { TrackerConfigList } from '@/components/habits-goals/features/tracker-config-list/tracker-config-list';
import { useTrackers } from '@/hooks/habits-goals/use-trackers';

export default function ConfigPage() {
  const { trackers, isLoading, updateTracker, deleteTracker, reorderTrackers } = useTrackers(false);
  const { toast } = useToast();

  async function toggleActive(id: string, current: boolean) {
    try {
      await updateTracker(id, { active: !current });
      toast.success(!current ? 'Meta ativada' : 'Meta desativada');
    } catch {
      toast.error('Erro ao atualizar meta');
    }
  }

  async function handleRemove(id: string, label: string) {
    if (
      !confirm(
        `Remover a meta "${label}"?\n\nOs registros dos dias anteriores mantêm-se no histórico; esta meta deixa de aparecer no dia a dia.`,
      )
    ) {
      return;
    }
    try {
      await deleteTracker(id);
      toast.success('Meta removida');
    } catch {
      toast.error('Não foi possível remover a meta.');
    }
  }

  async function handleReorder(orderedIds: string[]) {
    try {
      await reorderTrackers(orderedIds);
    } catch {
      toast.error('Não foi possível salvar a ordem.');
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="block" className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-start justify-between">
        <PageHeader title="Metas" subtitle="Gerencie seus trackers diários." />
        <Link
          href="/habits-goals/config/new"
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <Plus size={15} />
          Nova meta
        </Link>
      </div>

      {trackers.length === 0 ? (
        <EmptyState
          title="Nenhuma meta criada"
          description="Crie sua primeira meta para começar a rastrear seu progresso diário."
        />
      ) : (
        <TrackerConfigList
          trackers={trackers}
          onReorder={handleReorder}
          onToggleActive={toggleActive}
          onRemove={handleRemove}
        />
      )}
    </div>
  );
}
