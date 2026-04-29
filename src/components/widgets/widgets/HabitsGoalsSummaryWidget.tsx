'use client';

import { Target } from 'lucide-react';
import { Skeleton } from '@phfront/millennium-ui';
import { DailyProgressHeader } from '@/components/habits-goals/features/daily-progress-header/daily-progress-header';
import { WidgetSectionHeader } from '@/components/widgets/WidgetSectionHeader';
import { useTrackers } from '@/hooks/habits-goals/use-trackers';
import { useHabitsGoalsTodayLogs } from '@/components/widgets/HabitsGoalsTodayLogsProvider';
import { useUserStore } from '@/store/user-store';
import { isTrackerScheduledForDate } from '@/lib/habits-goals/scheduling';
import { maxPossiblePointsForTracker } from '@/lib/habits-goals/scoring';
import { getLocalDateStr } from '@/lib/habits-goals/timezone';
import {
  getPeriodWindowForDate,
  isTrackerCompletedForView,
  sumNumericInWindow,
} from '@/lib/habits-goals/period';

export function HabitsGoalsSummaryWidget() {
  const user = useUserStore((s) => s.user);
  const today = getLocalDateStr(user?.profile?.timezone);
  const { trackers: allTrackers, isLoading: trackersLoading } = useTrackers(true);
  const { getLogForTracker, isLoading: logsLoading, logs } = useHabitsGoalsTodayLogs();

  if (trackersLoading || logsLoading) {
    return <Skeleton variant="block" className="h-full min-h-[180px] w-full" />;
  }

  const trackers = allTrackers.filter((tracker) =>
    isTrackerScheduledForDate(tracker, today, user?.profile?.timezone),
  );

  const completed = trackers.filter((tracker) => {
    const log = getLogForTracker(tracker);
    const w = getPeriodWindowForDate(tracker, today);
    const periodSum =
      (tracker.period_aggregation ?? 'single') === 'aggregate' &&
      (tracker.type === 'counter' || tracker.type === 'slider')
        ? sumNumericInWindow(tracker, logs, w)
        : null;
    return isTrackerCompletedForView(tracker, log, periodSum, tracker.goal_value ?? null);
  }).length;

  const pointsEarned = trackers.reduce(
    (sum, tracker) => sum + Number(getLogForTracker(tracker)?.points_earned ?? 0),
    0,
  );
  const pointsMax = trackers.reduce((sum, tracker) => sum + maxPossiblePointsForTracker(tracker), 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      <WidgetSectionHeader
        className="shrink-0 px-3 pt-3"
        variant="emerald"
        icon={<Target className="h-3.5 w-3.5" aria-hidden />}
        title="Metas de hoje"
        subtitle="Progresso e pontos de todas as metas agendadas para hoje (qualquer período)."
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3">
        <DailyProgressHeader
          fillContainer
          completed={completed}
          total={trackers.length}
          pointsEarned={pointsEarned}
          pointsMax={pointsMax}
        />
      </div>
    </div>
  );
}
