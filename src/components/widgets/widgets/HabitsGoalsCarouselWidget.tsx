'use client';

import { useMemo } from 'react';
import { Skeleton } from '@phfront/millennium-ui';
import { useTrackers } from '@/hooks/habits-goals/use-trackers';
import { useHabitsGoalsTodayLogs } from '@/components/widgets/HabitsGoalsTodayLogsProvider';
import { useUserStore } from '@/store/user-store';
import { isTrackerScheduledForDate } from '@/lib/habits-goals/scheduling';
import { getPeriodWindowForDate, sumNumericInWindow } from '@/lib/habits-goals/period';
import { getLocalDateStr } from '@/lib/habits-goals/timezone';
import type { Tracker } from '@/types/habits-goals';
import { Target } from 'lucide-react';
import { WidgetFrame } from '@/components/widgets/WidgetFrame';
import { WidgetSectionHeader } from '@/components/widgets/WidgetSectionHeader';
import { useWidgetSlotOptional } from '@/components/widgets/widget-slot-context';
import { TrackerCard } from '@/components/habits-goals/features/tracker-card/tracker-card';

function chunkTrackers(trackers: Tracker[], chunkSize: number): Tracker[][] {
  if (chunkSize < 1) return [];
  const out: Tracker[][] = [];
  for (let i = 0; i < trackers.length; i += chunkSize) {
    out.push(trackers.slice(i, i + chunkSize));
  }
  return out;
}

export function HabitsGoalsCarouselWidget() {
  const user = useUserStore((s) => s.user);
  const today = getLocalDateStr(user?.profile?.timezone);
  const slot = useWidgetSlotOptional();
  const rowSpan = Math.max(1, slot?.rowSpan ?? 1);
  /** Com 1 linha na grelha: um card por slide. Com 2+: empilha até `rowSpan` cards por coluna (scroll horizontal). */
  const cardsPerSlide = rowSpan >= 2 ? rowSpan : 1;

  const { trackers: allTrackers, isLoading: trackersLoading } = useTrackers(true);
  const { getLogForTracker, upsertLog, savingTrackerId, isLoading: logsLoading, logs } =
    useHabitsGoalsTodayLogs();

  const trackers = useMemo(
    () =>
      allTrackers.filter((tracker) =>
        isTrackerScheduledForDate(tracker, today, user?.profile?.timezone),
      ),
    [allTrackers, today, user?.profile?.timezone],
  );

  const carouselColumns = useMemo(() => {
    if (trackers.length === 0) return [];
    return chunkTrackers(trackers, cardsPerSlide);
  }, [trackers, cardsPerSlide]);

  if (trackersLoading || logsLoading) {
    return <Skeleton variant="block" className="h-full min-h-[220px] w-full" />;
  }

  return (
    <WidgetFrame
      contentOnly
      aria-label={
        cardsPerSlide > 1
          ? `Metas de hoje — carrossel, ${cardsPerSlide} linhas por slide`
          : 'Metas de hoje — carrossel'
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-2">
        <WidgetSectionHeader
          className="shrink-0"
          variant="emerald"
          icon={<Target className="h-3.5 w-3.5" aria-hidden />}
          title="Metas de hoje"
          subtitle="Diárias, semanais, mensais e personalizadas. Deslize para ver mais e atualize o progresso."
        />
        {trackers.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhuma meta ativa para hoje.</p>
        ) : (
          <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden pb-1">
            {carouselColumns.map((column) => (
              <div
                key={column.map((t) => t.id).join('-')}
                className="flex h-full min-h-0 w-full min-w-[280px] max-w-[320px] shrink-0 snap-start flex-col gap-2"
              >
                {column.map((tracker) => {
                  const w = getPeriodWindowForDate(tracker, today);
                  const periodNumericSum =
                    (tracker.period_aggregation ?? 'single') === 'aggregate' &&
                    (tracker.type === 'counter' || tracker.type === 'slider')
                      ? sumNumericInWindow(tracker, logs, w)
                      : null;
                  return (
                    <div key={tracker.id} className="flex min-h-0 min-w-0 flex-1 flex-col">
                      <TrackerCard
                        tracker={tracker}
                        log={getLogForTracker(tracker)}
                        periodNumericSum={periodNumericSum}
                        isSaving={savingTrackerId === tracker.id}
                        hideSettingsLink
                        onLogChange={upsertLog}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </WidgetFrame>
  );
}
