'use client';

import { useMemo } from 'react';
import { Skeleton } from '@phfront/millennium-ui';
import { useTrackers } from '@/hooks/daily-goals/use-trackers';
import { useDailyGoalsTodayLogs } from '@/components/widgets/DailyGoalsTodayLogsProvider';
import { useUserStore } from '@/store/user-store';
import { isTrackerScheduledForDate } from '@/lib/daily-goals/scheduling';
import { getLocalDateStr } from '@/lib/daily-goals/timezone';
import type { Tracker } from '@/types/daily-goals';
import { Target } from 'lucide-react';
import { WidgetFrame } from '@/components/widgets/WidgetFrame';
import { WidgetSectionHeader } from '@/components/widgets/WidgetSectionHeader';
import { useWidgetSlotOptional } from '@/components/widgets/widget-slot-context';
import { TrackerCard } from '@/components/daily-goals/features/tracker-card/tracker-card';

function chunkTrackers(trackers: Tracker[], chunkSize: number): Tracker[][] {
  if (chunkSize < 1) return [];
  const out: Tracker[][] = [];
  for (let i = 0; i < trackers.length; i += chunkSize) {
    out.push(trackers.slice(i, i + chunkSize));
  }
  return out;
}

export function DailyGoalsCarouselWidget() {
  const user = useUserStore((s) => s.user);
  const today = getLocalDateStr(user?.profile?.timezone);
  const slot = useWidgetSlotOptional();
  const rowSpan = Math.max(1, slot?.rowSpan ?? 1);
  /** Com 1 linha na grelha: um card por slide. Com 2+: empilha até `rowSpan` cards por coluna (scroll horizontal). */
  const cardsPerSlide = rowSpan >= 2 ? rowSpan : 1;

  const { trackers: allTrackers, isLoading: trackersLoading } = useTrackers(true);
  const { getLogForTracker, upsertLog, savingTrackerId, isLoading: logsLoading } = useDailyGoalsTodayLogs();

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
          ? `Metas do dia — carrossel, ${cardsPerSlide} linhas por slide`
          : 'Metas do dia — carrossel'
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-2">
        <WidgetSectionHeader
          className="shrink-0"
          variant="emerald"
          icon={<Target className="h-3.5 w-3.5" aria-hidden />}
          title="Metas do dia"
          subtitle="Deslize para ver mais metas e atualize o progresso de cada uma."
        />
        {trackers.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhum objetivo ativo para hoje.</p>
        ) : (
          <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden pb-1">
          {carouselColumns.map((column) => (
            <div
              key={column.map((t) => t.id).join('-')}
              className="flex h-full min-h-0 w-full min-w-[280px] max-w-[320px] shrink-0 snap-start flex-col gap-2"
            >
              {column.map((tracker) => (
                <div key={tracker.id} className="flex min-h-0 min-w-0 flex-1 flex-col">
                  <TrackerCard
                    tracker={tracker}
                    log={getLogForTracker(tracker.id)}
                    isSaving={savingTrackerId === tracker.id}
                    hideSettingsLink
                    onLogChange={upsertLog}
                  />
                </div>
              ))}
            </div>
          ))}
          </div>
        )}
      </div>
    </WidgetFrame>
  );
}
