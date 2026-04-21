'use client';

import { useState } from 'react';
import { PageHeader } from '@phfront/millennium-ui';
import { HistoryHeatmap } from '@/components/daily-goals/features/history-heatmap/history-heatmap';
import { useLogs } from '@/hooks/daily-goals/use-logs';
import { useTrackers } from '@/hooks/daily-goals/use-trackers';
import { useUserStore } from '@/store/user-store';
import { TrackerCard } from '@/components/daily-goals/features/tracker-card/tracker-card';
import { isTrackerScheduledForDate } from '@/lib/daily-goals/scheduling';
import { getLocalDateStr } from '@/lib/daily-goals/timezone';
import { maxPossiblePointsForTracker, pointsPercentOfMax } from '@/lib/daily-goals/scoring';
import type { Log, Tracker } from '@/types/daily-goals';

export default function HistoryPage() {
  const user = useUserStore((s) => s.user);
  const today = getLocalDateStr(user?.profile?.timezone);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [heatmapKey, setHeatmapKey] = useState(0);
  const { trackers } = useTrackers(false, { includeDeleted: true });
  const { getLogForTracker, upsertLog } = useLogs(selectedDate ?? today);

  const viewDate = selectedDate ?? today;
  const isPast = viewDate < today;

  function trackerVisibleOnHistoryDate(t: Tracker) {
    if (!isTrackerScheduledForDate(t, viewDate, user?.profile?.timezone)) return false;
    const log = getLogForTracker(t.id);
    if (t.deleted_at) return log != null;
    return t.active;
  }

  const schedForView = trackers.filter(trackerVisibleOnHistoryDate);
  const historyPointsEarned = schedForView.reduce(
    (sum, t) => sum + Number(getLogForTracker(t.id)?.points_earned ?? 0),
    0,
  );
  const historyPointsMax = schedForView.reduce(
    (sum, t) => sum + maxPossiblePointsForTracker(t),
    0,
  );
  const historyPointsPct = pointsPercentOfMax(historyPointsEarned, historyPointsMax);

  async function handleLogChange(tracker: Tracker, partial: Partial<Log>) {
    await upsertLog(tracker, partial);
    setHeatmapKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <PageHeader title="Histórico" subtitle="Veja seu progresso ao longo dos dias." />

      <HistoryHeatmap
        selectedDate={selectedDate}
        onSelectDate={(d) => setSelectedDate(d || null)}
        refreshKey={heatmapKey}
      />

      {selectedDate && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-secondary">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </h2>
            {isPast && (
              <span className="text-xs bg-surface-3 text-text-muted px-2 py-0.5 rounded-full">
                Somente leitura
              </span>
            )}
          </div>

          {historyPointsMax > 0 && (
            <p className="text-xs text-text-muted">
              Pontos:{' '}
              <span className="font-semibold text-text-secondary tabular-nums">
                {historyPointsEarned} de {historyPointsMax}
              </span>
              {historyPointsPct !== null && (
                <>
                  {' '}
                  —{' '}
                  <span className="font-semibold text-text-secondary tabular-nums">{historyPointsPct}%</span>
                </>
              )}
            </p>
          )}

          {trackers
            .filter(trackerVisibleOnHistoryDate)
            .map((tracker) => (
              <TrackerCard
                key={tracker.id}
                tracker={tracker}
                log={getLogForTracker(tracker.id)}
                readonly={isPast}
                viewDate={viewDate}
                onLogChange={handleLogChange}
              />
            ))}
        </div>
      )}
    </div>
  );
}
