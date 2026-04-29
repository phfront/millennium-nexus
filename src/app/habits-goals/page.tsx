'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Skeleton } from '@phfront/millennium-ui';
import { DailyProgressHeader } from '@/components/habits-goals/features/daily-progress-header/daily-progress-header';
import { TrackerCard } from '@/components/habits-goals/features/tracker-card/tracker-card';
import { useTrackers } from '@/hooks/habits-goals/use-trackers';
import { useLogs } from '@/hooks/habits-goals/use-logs';
import { useUserStore } from '@/store/user-store';
import { useHabitsGoalsStore } from '@/store/use-habits-goals-store';
import { isTrackerScheduledForDate } from '@/lib/habits-goals/scheduling';
import { maxPossiblePointsForTracker } from '@/lib/habits-goals/scoring';
import { getGoalValuesForDate } from '@/lib/habits-goals/goal-history';
import { getLocalDateStr } from '@/lib/habits-goals/timezone';
import {
  getPeriodWindowForDate,
  isTrackerCompletedForView,
  sumNumericInWindow,
} from '@/lib/habits-goals/period';
import type { Log } from '@/types/habits-goals';

export default function DashboardPage() {
  const user = useUserStore((s) => s.user);
  const selectedDate = useHabitsGoalsStore((s) => s.selectedDate);
  const today = getLocalDateStr(user?.profile?.timezone);
  const { trackers: allTrackers, isLoading } = useTrackers(true);
  const { logs, getLogForTracker, upsertLog, savingTrackerId } = useLogs(selectedDate, allTrackers);

  // Busca valores históricos de meta quando visualizando data diferente
  const [historicalGoals, setHistoricalGoals] = useState<Map<string, number | null>>(new Map());
  const isViewingPast = selectedDate !== today;

  useEffect(() => {
    if (isViewingPast) {
      const trackerIds = allTrackers.map(t => t.id);
      getGoalValuesForDate(trackerIds, selectedDate).then(setHistoricalGoals);
    } else {
      setHistoricalGoals(new Map());
    }
  }, [isViewingPast, selectedDate, allTrackers]);

  // Filtra apenas trackers agendados para o dia selecionado
  const trackers = allTrackers.filter((t) =>
    isTrackerScheduledForDate(t, selectedDate, user?.profile?.timezone),
  );

  const dailyForHeader = trackers.filter((t) => (t.period_kind ?? 'daily') === 'daily');
  const nonDailyInPanel = trackers.filter((t) => (t.period_kind ?? 'daily') !== 'daily');

  const completed = dailyForHeader.filter((t) => {
    const log = getLogForTracker(t);
    const effectiveGoalValue = historicalGoals.get(t.id) ?? t.goal_value;
    const w = getPeriodWindowForDate(t, selectedDate);
    const periodSum =
      (t.period_aggregation ?? 'single') === 'aggregate' && (t.type === 'counter' || t.type === 'slider')
        ? sumNumericInWindow(t, logs, w)
        : null;
    return isTrackerCompletedForView(t, log, periodSum, effectiveGoalValue ?? null);
  }).length;

  const pointsEarned = trackers.reduce((sum, t) => {
    const log = getLogForTracker(t);
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
        total={dailyForHeader.length}
        pointsEarned={pointsEarned}
        pointsMax={pointsMax}
      />
      {nonDailyInPanel.length > 0 && (
        <p className="text-xs text-text-muted -mt-1">
          Este painel inclui também {nonDailyInPanel.length} meta
          {nonDailyInPanel.length !== 1 ? 's' : ''} semanal(is), mensal(is) ou personalizada(s). O resumo
          acima conta só as <strong>diárias</strong>.
        </p>
      )}

      {trackers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-text-primary font-semibold">Nenhuma meta ativa</p>
          <p className="text-sm text-text-muted mt-1">Crie sua primeira meta para começar a rastrear.</p>
          <Link
            href="/habits-goals/config/new"
            className="mt-4 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer inline-flex"
          >
            Criar meta
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trackers.map((tracker) => {
            const w = getPeriodWindowForDate(tracker, selectedDate);
            const periodNumericSum =
              (tracker.period_aggregation ?? 'single') === 'aggregate' &&
              (tracker.type === 'counter' || tracker.type === 'slider')
                ? sumNumericInWindow(tracker, logs, w)
                : null;
            return (
              <TrackerCard
                key={tracker.id}
                tracker={tracker}
                log={getLogForTracker(tracker)}
                periodNumericSum={periodNumericSum}
                isSaving={savingTrackerId === tracker.id}
                readonly={isViewingPast}
                viewDate={isViewingPast ? selectedDate : undefined}
                onLogChange={handleLogChange}
              />
            );
          })}
        </div>
      )}

      {/* FAB */}
      <Link
        href="/habits-goals/config/new"
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full bg-brand-primary shadow-lg flex items-center justify-center text-white hover:opacity-90 active:scale-95 transition-all z-40 cursor-pointer"
        aria-label="Nova meta"
      >
        <Plus size={24} />
      </Link>
    </div>
  );
}
