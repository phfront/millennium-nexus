'use client';

import { useState } from 'react';
import { PageHeader } from '@phfront/millennium-ui';
import { HistoryHeatmap } from '@/components/habits-goals/features/history-heatmap/history-heatmap';
import { useLogs } from '@/hooks/habits-goals/use-logs';
import { useTrackers } from '@/hooks/habits-goals/use-trackers';
import { useUserStore } from '@/store/user-store';
import { TrackerCard } from '@/components/habits-goals/features/tracker-card/tracker-card';
import { isTrackerScheduledForDate } from '@/lib/habits-goals/scheduling';
import { getLocalDateStr } from '@/lib/habits-goals/timezone';
import { maxPossiblePointsForTracker, pointsPercentOfMax } from '@/lib/habits-goals/scoring';
import { getPeriodWindowForDate, sumNumericInWindow } from '@/lib/habits-goals/period';
import { NonDailyPeriodHistory } from '@/components/habits-goals/features/non-daily-period-history/non-daily-period-history';
import type { Log, Tracker } from '@/types/habits-goals';

export default function HistoryPage() {
  const user = useUserStore((s) => s.user);
  const today = getLocalDateStr(user?.profile?.timezone);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [heatmapKey, setHeatmapKey] = useState(0);
  const { trackers } = useTrackers(false, { includeDeleted: true });
  const { logs, getLogForTracker, upsertLog } = useLogs(selectedDate ?? today, trackers);

  const viewDate = selectedDate ?? today;
  const isPast = viewDate < today;

  function trackerVisibleOnHistoryDate(t: Tracker) {
    if (!isTrackerScheduledForDate(t, viewDate, user?.profile?.timezone)) return false;
    const log = getLogForTracker(t);
    if (t.deleted_at) return log != null;
    return t.active;
  }

  const schedForView = trackers.filter(trackerVisibleOnHistoryDate);
  const dailyForView = schedForView.filter((t) => (t.period_kind ?? 'daily') === 'daily');
  const nonDailyForView = schedForView.filter((t) => (t.period_kind ?? 'daily') !== 'daily');
  const historyPointsEarned = schedForView.reduce(
    (sum, t) => sum + Number(getLogForTracker(t)?.points_earned ?? 0),
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

      {!selectedDate && (
        <p className="text-center text-sm text-text-muted">
          Selecione um dia no calorário para ver metas diárias, semanais, mensais e personalizadas.
        </p>
      )}

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

          {dailyForView.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-text-secondary">Metas diárias</h3>
              {dailyForView.map((tracker) => {
                const w = getPeriodWindowForDate(tracker, viewDate);
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
                    readonly={isPast}
                    viewDate={viewDate}
                    onLogChange={handleLogChange}
                  />
                );
              })}
            </>
          )}

          <NonDailyPeriodHistory trackers={nonDailyForView} anchorDate={selectedDate} />
        </div>
      )}
    </div>
  );
}
