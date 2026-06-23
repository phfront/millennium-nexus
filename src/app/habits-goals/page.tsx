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
  getCalendarWeekWindow,
  isTrackerCompletedForView,
  mealDiaryWeekLogsForTracker,
  sumNumericInWindow,
} from '@/lib/habits-goals/period';
import type { Log, Tracker } from '@/types/habits-goals';

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

  function renderTrackerCard(tracker: Tracker) {
    const weekWindow = getCalendarWeekWindow(selectedDate);
    const periodNumericSum =
      tracker.source_key === 'calories_burned'
        ? sumNumericInWindow(tracker, logs, weekWindow)
        : (tracker.period_aggregation ?? 'single') === 'aggregate' &&
            (tracker.type === 'counter' || tracker.type === 'slider')
          ? sumNumericInWindow(tracker, logs, getPeriodWindowForDate(tracker, selectedDate))
          : null;
    const mealDiaryWeekLogs = mealDiaryWeekLogsForTracker(tracker, logs, selectedDate);

    return (
      <TrackerCard
        key={tracker.id}
        tracker={tracker}
        log={getLogForTracker(tracker)}
        periodNumericSum={periodNumericSum}
        mealDiaryWeekLogs={mealDiaryWeekLogs}
        isSaving={savingTrackerId === tracker.id}
        readonly={isViewingPast}
        viewDate={isViewingPast ? selectedDate : undefined}
        onLogChange={handleLogChange}
        variant="dashboard"
      />
    );
  }

  const leftColumnTrackers = trackers.filter((_, index) => index % 2 === 0);
  const rightColumnTrackers = trackers.filter((_, index) => index % 2 === 1);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-5 max-md:pb-28">
        <Skeleton variant="block" className="h-28 w-full rounded-2xl" />
        <div className="flex flex-col gap-3 sm:hidden">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="block" className="h-44 w-full rounded-xl" />
          ))}
        </div>
        <div className="hidden gap-4 sm:flex">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Skeleton variant="block" className="h-44 w-full rounded-2xl" />
            <Skeleton variant="block" className="h-36 w-full rounded-2xl" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Skeleton variant="block" className="h-36 w-full rounded-2xl" />
            <Skeleton variant="block" className="h-44 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 max-md:pb-24">
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
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-surface-2/50 px-6 py-16 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary ring-1 ring-inset ring-brand-primary/20">
            <Plus size={24} aria-hidden />
          </span>
          <p className="font-semibold text-text-primary">Nenhuma meta ativa</p>
          <p className="mt-1 max-w-sm text-sm text-text-muted">
            Crie sua primeira meta para começar a acompanhar hábitos e progresso diário.
          </p>
          <Link
            href="/habits-goals/config/new"
            className="mt-5 inline-flex rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Criar meta
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:hidden">{trackers.map((tracker) => renderTrackerCard(tracker))}</div>
          <div className="hidden gap-4 sm:flex">
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {leftColumnTrackers.map((tracker) => renderTrackerCard(tracker))}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {rightColumnTrackers.map((tracker) => renderTrackerCard(tracker))}
            </div>
          </div>
        </>
      )}

      {/* FAB */}
      <Link
        href="/habits-goals/config/new"
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary text-white shadow-lg shadow-brand-primary/20 transition-all hover:opacity-90 active:scale-95 md:bottom-6 md:right-6"
        aria-label="Nova meta"
      >
        <Plus size={24} />
      </Link>
    </div>
  );
}
