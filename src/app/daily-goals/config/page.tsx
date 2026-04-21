'use client';

import Link from 'next/link';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { PageHeader, Switch, Skeleton, EmptyState } from '@phfront/millennium-ui';
import { useTrackers } from '@/hooks/daily-goals/use-trackers';
import { useToast } from '@phfront/millennium-ui';

export default function ConfigPage() {
  const { trackers, isLoading, updateTracker, deleteTracker } = useTrackers(false);
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
        `Remover a meta "${label}"?\n\nOs registos dos dias anteriores mantêm-se no histórico; esta meta deixa de aparecer no dia a dia.`,
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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} variant="block" className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      <div className="flex items-start justify-between">
        <PageHeader title="Metas" subtitle="Gerencie seus trackers diários." />
        <Link
          href="/daily-goals/config/new"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
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
        <ul className="flex flex-col gap-2">
          {trackers.map((tracker) => (
            <li
              key={tracker.id}
              className="flex items-center justify-between gap-3 p-4 bg-surface-2 rounded-xl border border-border"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary truncate">{tracker.label}</p>
                <p className="text-xs text-text-muted capitalize">
                  {tracker.type}{tracker.unit ? ` · ${tracker.unit}` : ''}
                  {tracker.goal_value ? ` · meta: ${tracker.goal_value}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={tracker.active}
                  onChange={() => toggleActive(tracker.id, tracker.active)}
                />
                <Link
                  href={`/daily-goals/config/${tracker.id}`}
                  className="p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer inline-flex"
                  aria-label="Editar meta"
                >
                  <Pencil size={15} />
                </Link>
                <button
                  type="button"
                  onClick={() => handleRemove(tracker.id, tracker.label)}
                  className="p-2 rounded-md text-text-muted hover:text-red-400 hover:bg-surface-3 transition-colors cursor-pointer inline-flex"
                  aria-label="Remover meta"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
