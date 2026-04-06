'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { PageHeader, Skeleton, EmptyState } from '@phfront/millennium-ui';
import { GoalForm } from '@/components/daily-goals/features/goal-form/goal-form';
import { useTrackers } from '@/hooks/daily-goals/use-trackers';

export default function EditGoalPage() {
  const params = useParams();
  const trackerId = typeof params.trackerId === 'string' ? params.trackerId : '';
  const { trackers, isLoading, updateTracker } = useTrackers(false);

  const tracker = useMemo(
    () => (trackerId ? trackers.find((t) => t.id === trackerId) : undefined),
    [trackers, trackerId],
  );

  if (!trackerId) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <EmptyState title="Meta inválida" description="Identificador em falta no URL." />
        <Link
          href="/daily-goals/config"
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-surface-3 px-4 text-sm font-medium text-text-primary hover:bg-surface-4"
        >
          Voltar às metas
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <Skeleton variant="block" className="h-10 w-48" />
        <Skeleton variant="block" className="h-64 w-full" />
      </div>
    );
  }

  if (!tracker) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <EmptyState
          title="Meta não encontrada"
          description="Esta meta não existe ou já foi removida."
        />
        <Link
          href="/daily-goals/config"
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-surface-3 px-4 text-sm font-medium text-text-primary hover:bg-surface-4"
        >
          Voltar às metas
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <PageHeader title="Editar meta" subtitle="Atualize as definições deste tracker." />
      <GoalForm
        key={tracker.id}
        initial={tracker}
        onSubmit={async (data) => {
          await updateTracker(tracker.id, data);
        }}
      />
    </div>
  );
}
