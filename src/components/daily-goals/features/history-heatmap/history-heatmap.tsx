'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import { CalendarHeatmap, Skeleton } from '@phfront/millennium-ui';
import { isTrackerScheduledForDate } from '@/lib/daily-goals/scheduling';
import { maxPossiblePointsForTracker } from '@/lib/daily-goals/scoring';
import type { DayCompletionData, Log, Tracker } from '@/types/daily-goals';

interface HistoryHeatmapProps {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  refreshKey?: number;
}

export function HistoryHeatmap({ selectedDate, onSelectDate, refreshKey }: HistoryHeatmapProps) {
  const user = useUserStore((s) => s.user);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [completionData, setCompletionData] = useState<DayCompletionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const now = new Date();
  const isCurrentMonth =
    month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();

  function prevMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    onSelectDate('');
  }

  function nextMonth() {
    if (isCurrentMonth) return;
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
    onSelectDate('');
  }

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const y = month.getFullYear();
    const m = month.getMonth();
    const monthNum = String(m + 1).padStart(2, '0');
    (async () => {
      const { data: trackersData } = await supabase
        .from('trackers')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true);

      const trackers = (trackersData ?? []) as Tracker[];
      const trackerIds = trackers.map((t) => t.id);
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const startDate = `${y}-${monthNum}-01`;
      const endDate = `${y}-${monthNum}-${String(daysInMonth).padStart(2, '0')}`;

      // Uma única query para todos os logs do mês
      const { data: logsData } =
        trackerIds.length > 0
          ? await supabase
              .from('logs')
              .select('*')
              .in('tracker_id', trackerIds)
              .gte('created_at', startDate)
              .lte('created_at', endDate)
          : { data: [] as Log[] };

      const allLogs = (logsData ?? []) as Log[];

      // Agrupa por data
      const logsByDate = new Map<string, Log[]>();
      for (const log of allLogs) {
        const d = String(log.created_at).slice(0, 10);
        if (!logsByDate.has(d)) logsByDate.set(d, []);
        logsByDate.get(d)!.push(log);
      }

      const allDates = Array.from({ length: daysInMonth }, (_, i) =>
        `${y}-${monthNum}-${String(i + 1).padStart(2, '0')}`,
      );

      const result: DayCompletionData[] = allDates.map((dateStr) => {
        const ts = trackers.filter((t) =>
          isTrackerScheduledForDate(t, dateStr, user?.profile?.timezone),
        );

        if (ts.length === 0) {
          return { date: dateStr, percent: 0, pointsEarned: 0, pointsMax: 0, pointsPercent: 0 };
        }

        const logsForDay = logsByDate.get(dateStr) ?? [];
        const logByTracker = new Map(logsForDay.map((l) => [l.tracker_id, l]));

        let completed = 0;
        for (const t of ts) {
          const log = logByTracker.get(t.id);
          if (!log) continue;
          let done = false;
          if (t.type === 'boolean') done = log.value === 1;
          else if (t.type === 'counter' || t.type === 'slider')
            done = (log.value ?? 0) >= (t.goal_value ?? 0);
          else if (t.type === 'checklist') done = (log.checked_items ?? []).every(Boolean);
          if (done) completed++;
        }

        const pointsEarned = ts.reduce(
          (sum, t) => sum + Number(logByTracker.get(t.id)?.points_earned ?? 0),
          0,
        );
        const pointsMax = ts.reduce((sum, t) => sum + maxPossiblePointsForTracker(t), 0);
        const percent = ts.length > 0 ? (completed / ts.length) * 100 : 0;
        const pointsPercent =
          pointsMax > 0 ? Math.min(100, Math.round((pointsEarned / pointsMax) * 100)) : 0;

        return { date: dateStr, percent, pointsEarned, pointsMax, pointsPercent };
      });

      setCompletionData(result);
      setIsLoading(false);
    })();
  }, [user, month, refreshKey]);

  useEffect(() => {
    setIsLoading(true);
  }, [month]);

  if (isLoading) return <Skeleton variant="block" className="h-52 w-full" />;

  return (
    <CalendarHeatmap
      data={completionData}
      month={month}
      selectedDate={selectedDate ?? undefined}
      onSelectDate={onSelectDate}
      onPrevMonth={prevMonth}
      onNextMonth={nextMonth}
      isCurrentMonth={isCurrentMonth}
    />
  );
}
