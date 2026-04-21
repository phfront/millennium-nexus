'use client';

import { Target } from 'lucide-react';
import { Skeleton } from '@phfront/millennium-ui';
import { DailyProgressHeader } from '@/components/daily-goals/features/daily-progress-header/daily-progress-header';
import { WidgetSectionHeader } from '@/components/widgets/WidgetSectionHeader';
import { useTrackers } from '@/hooks/daily-goals/use-trackers';
import { useDailyGoalsTodayLogs } from '@/components/widgets/DailyGoalsTodayLogsProvider';
import { useUserStore } from '@/store/user-store';
import { isTrackerScheduledForDate } from '@/lib/daily-goals/scheduling';
import { maxPossiblePointsForTracker } from '@/lib/daily-goals/scoring';
import { getLocalDateStr } from '@/lib/daily-goals/timezone';

export function DailyGoalsSummaryWidget() {
  const user = useUserStore((s) => s.user);
  const today = getLocalDateStr(user?.profile?.timezone);
  const { trackers: allTrackers, isLoading: trackersLoading } = useTrackers(true);
  const { getLogForTracker, isLoading: logsLoading } = useDailyGoalsTodayLogs();

  if (trackersLoading || logsLoading) {
    return <Skeleton variant="block" className="h-full min-h-[180px] w-full" />;
  }

  const trackers = allTrackers.filter((tracker) =>
    isTrackerScheduledForDate(tracker, today, user?.profile?.timezone),
  );

  const completed = trackers.filter((tracker) => {
    const log = getLogForTracker(tracker.id);
    if (!log) return false;
    if (tracker.type === 'boolean') return log.value === 1;
    if (tracker.type === 'counter' || tracker.type === 'slider') return (log.value ?? 0) >= (tracker.goal_value ?? 0);
    if (tracker.type === 'checklist') return (log.checked_items ?? []).every(Boolean);
    return false;
  }).length;

  const pointsEarned = trackers.reduce((sum, tracker) => sum + Number(getLogForTracker(tracker.id)?.points_earned ?? 0), 0);
  const pointsMax = trackers.reduce((sum, tracker) => sum + maxPossiblePointsForTracker(tracker), 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      <WidgetSectionHeader
        className="shrink-0 px-3 pt-3"
        variant="emerald"
        icon={<Target className="h-3.5 w-3.5" aria-hidden />}
        title="Metas de hoje"
        subtitle="Progresso e pontos das metas ativas para hoje."
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
