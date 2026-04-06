'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Skeleton } from '@phfront/millennium-ui';
import { DailyProgressHeader } from '@/components/daily-goals/features/daily-progress-header/daily-progress-header';
import { TrackerCard } from '@/components/daily-goals/features/tracker-card/tracker-card';
import { useTrackers } from '@/hooks/daily-goals/use-trackers';
import { useLogs } from '@/hooks/daily-goals/use-logs';
import { useUserStore } from '@/store/user-store';
import { useDailyGoalsStore } from '@/store/use-daily-goals-store';
import { isTrackerScheduledForDate } from '@/lib/daily-goals/scheduling';
import { maxPossiblePointsForTracker } from '@/lib/daily-goals/scoring';
import type { Log } from '@/types/daily-goals';

export default function DashboardPage() {
  const user = useUserStore((s) => s.user);
  const selectedDate = useDailyGoalsStore((s) => s.selectedDate);
  const { trackers: allTrackers, isLoading } = useTrackers(true);
  const { getLogForTracker, upsertLog, savingTrackerId } = useLogs(selectedDate);

  // Filtra apenas trackers agendados para o dia selecionado
  const trackers = allTrackers.filter((t) =>
    isTrackerScheduledForDate(t, selectedDate, user?.profile?.timezone),
  );

  const completed = trackers.filter((t) => {
    const log = getLogForTracker(t.id);
    if (!log) return false;
    if (t.type === 'boolean') return log.value === 1;
    if (t.type === 'counter' || t.type === 'slider') return (log.value ?? 0) >= (t.goal_value ?? 0);
    if (t.type === 'checklist') return (log.checked_items ?? []).every(Boolean);
    return false;
  }).length;

  const pointsEarned = trackers.reduce((sum, t) => {
    const log = getLogForTracker(t.id);
    return sum + Number(log?.points_earned ?? 0);
  }, 0);
  const pointsMax = trackers.reduce((sum, t) => sum + maxPossiblePointsForTracker(t), 0);

  async function handleLogChange(tracker: Parameters<typeof upsertLog>[0], partial: Partial<Log>) {
    await upsertLog(tracker, partial);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 max-w-3xl mx-auto max-md:pb-28">
        <Skeleton variant="block" className="h-24 w-full" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="block" className="h-36 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto max-md:pb-24">
      <DailyProgressHeader
        completed={completed}
        total={trackers.length}
        pointsEarned={pointsEarned}
        pointsMax={pointsMax}
      />

      {trackers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-text-primary font-semibold">Nenhuma meta ativa</p>
          <p className="text-sm text-text-muted mt-1">Crie sua primeira meta para começar a rastrear.</p>
          <Link
            href="/daily-goals/config/new"
            className="mt-4 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer inline-flex"
          >
            Criar meta
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trackers.map((tracker) => (
            <TrackerCard
              key={tracker.id}
              tracker={tracker}
              log={getLogForTracker(tracker.id)}
              isSaving={savingTrackerId === tracker.id}
              onLogChange={handleLogChange}
            />
          ))}
        </div>
      )}

      {/* FAB */}
      <Link
        href="/daily-goals/config/new"
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full bg-brand-primary shadow-lg flex items-center justify-center text-white hover:opacity-90 active:scale-95 transition-all z-40 cursor-pointer"
        aria-label="Nova meta"
      >
        <Plus size={24} />
      </Link>
    </div>
  );
}
