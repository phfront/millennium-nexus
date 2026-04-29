'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import { getLocalDateStr } from '@/lib/habits-goals/timezone';
import {
  getPeriodWindowForDate,
  getPreviousPeriodWindow,
  isPeriodCompleteFromLogs,
  sumNumericInWindow,
  type PeriodWindow,
} from '@/lib/habits-goals/period';
import type { Log, Tracker } from '@/types/habits-goals';

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

const PERIOD_KIND_LABEL: Record<string, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  custom: 'Personalizado',
};

type NumericPeriodEntry = {
  kind: 'numeric';
  range: string;
  total: number;
  goal: number;
  ok: boolean;
  isCurrent: boolean;
};
type CompletionPeriodEntry = {
  kind: 'completion';
  range: string;
  ok: boolean;
  isCurrent: boolean;
};
type PeriodEntry = NumericPeriodEntry | CompletionPeriodEntry;

function buildPeriodEntries(tracker: Tracker, anchorDate: string, logs: Log[]): PeriodEntry[] {
  const isNumericAggregate =
    (tracker.period_aggregation ?? 'single') === 'aggregate' &&
    (tracker.type === 'counter' || tracker.type === 'slider');
  let w: PeriodWindow = getPeriodWindowForDate(tracker, anchorDate);
  const out: PeriodEntry[] = [];
  for (let i = 0; i < 6; i++) {
    const range = `${w.startStr} → ${w.endStr}`;
    const isCurrent = i === 0;
    const ok = isPeriodCompleteFromLogs(tracker, w, logs);
    if (isNumericAggregate) {
      const total = sumNumericInWindow(tracker, logs, w);
      const goal = Number(tracker.goal_value ?? 0);
      out.push({ kind: 'numeric', range, total, goal, ok, isCurrent });
    } else {
      out.push({ kind: 'completion', range, ok, isCurrent });
    }
    w = getPreviousPeriodWindow(tracker, w);
  }
  return out;
}

function NumericPeriodRow({
  entry,
  unit,
  periodHighlightLabel,
}: {
  entry: NumericPeriodEntry;
  unit: string | null;
  periodHighlightLabel: string;
}) {
  const total = entry.total;
  const goal = entry.goal;
  const pct = goal > 0 ? Math.min(100, Math.max(0, (total / goal) * 100)) : total > 0 ? 100 : 0;
  const goalStr = goal > 0 ? String(goal) : '—';

  return (
    <div
      className={[
        'flex flex-col gap-2 rounded-lg p-3',
        entry.isCurrent
          ? 'bg-surface-3/40 ring-1 ring-inset ring-brand-primary/25'
          : 'bg-surface-3/20',
      ].join(' ')}
    >
      <div className="flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold tabular-nums text-text-primary">{total}</span>
          {unit ? <span className="text-xs text-text-muted">{unit}</span> : null}
          {entry.isCurrent ? (
            <span className="ml-1 rounded-full bg-brand-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-primary">
              {periodHighlightLabel}
            </span>
          ) : null}
        </div>
        <span className="shrink-0 text-xs text-text-muted">
          meta: {goalStr}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-3">
        <div
          className={[
            'h-full rounded-full transition-[width] duration-300',
            entry.ok ? 'bg-success' : 'bg-brand-primary',
          ].join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="font-mono text-sm text-text-secondary">{entry.range}</p>
    </div>
  );
}

function CompletionPeriodRow({
  entry,
  periodHighlightLabel,
}: {
  entry: CompletionPeriodEntry;
  periodHighlightLabel: string;
}) {
  return (
    <div
      className={[
        'flex items-center justify-between gap-2 rounded-lg p-3 text-xs',
        entry.isCurrent
          ? 'bg-surface-3/40 ring-1 ring-inset ring-brand-primary/25'
          : 'bg-surface-3/20',
      ].join(' ')}
    >
      <span className="min-w-0 truncate font-mono text-sm text-text-secondary">{entry.range}</span>
      <div className="flex shrink-0 items-center gap-2">
        {entry.isCurrent ? (
          <span className="rounded-full bg-brand-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-primary">
            {periodHighlightLabel}
          </span>
        ) : null}
        <span className={entry.ok ? 'text-success' : 'text-text-muted'}>
          {entry.ok ? 'Feita' : 'Não feita'}
        </span>
      </div>
    </div>
  );
}

export function NonDailyPeriodHistory({
  trackers,
  anchorDate,
  variant = 'embedded',
}: {
  trackers: Tracker[];
  /** Data de referência: o 1.º bloco é o período que contém este dia (ex.: dia clicado no calorário). */
  anchorDate: string;
  /** `embedded` = dentro do painel do dia; `standalone` = texto introdutório longo (heatmap). */
  variant?: 'embedded' | 'standalone';
}) {
  const user = useUserStore((s) => s.user);
  const tz = user?.profile?.timezone;
  const todayStr = getLocalDateStr(tz);
  const periodHighlightLabel = anchorDate === todayStr ? 'atual' : 'neste dia';

  const nonDaily = useMemo(
    () => trackers.filter((t) => (t.period_kind ?? 'daily') !== 'daily'),
    [trackers],
  );
  const nonDailyIds = useMemo(() => nonDaily.map((t) => t.id).join(','), [nonDaily]);
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<{ tracker: Tracker; entries: PeriodEntry[] }[]>([]);

  useEffect(() => {
    if (!user || nonDaily.length === 0) {
      setSections([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const today = getLocalDateStr(tz);
      const minDate = addDaysYmd(today, -400);
      const ids = nonDaily.map((t) => t.id);
      const { data: logRows } = await supabase
        .from('logs')
        .select('*')
        .in('tracker_id', ids)
        .gte('created_at', minDate)
        .lte('created_at', today);

      if (cancelled) return;
      const logs = (logRows ?? []) as Log[];
      const built = nonDaily.map((tracker) => ({
        tracker,
        entries: buildPeriodEntries(tracker, anchorDate, logs),
      }));
      setSections(built);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, tz, nonDailyIds, nonDaily, anchorDate]);

  if (nonDaily.length === 0) return null;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface-2 p-4">
        <p className="text-sm text-text-muted">A carregar metas por período…</p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-text-secondary">Semanais, mensais e personalizadas</h3>
      {variant === 'standalone' ? (
        <p className="text-xs text-text-muted">
          O mapa de calor acima reflete apenas metas <strong>diárias</strong>. Abaixo: o período que contém o dia
          selecionado e os períodos anteriores de cada meta.
        </p>
      ) : (
        <p className="text-xs text-text-muted">
          Progresso nos períodos que incluem este dia (1.ª linha = período desse dia).
        </p>
      )}
      <div className="flex flex-col gap-3">
        {sections.map(({ tracker, entries }) => (
          <div key={tracker.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-text-primary">{tracker.label}</span>
              <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                {PERIOD_KIND_LABEL[tracker.period_kind ?? ''] ?? tracker.period_kind}
              </span>
              {(tracker.period_aggregation ?? 'single') === 'aggregate' ? (
                <span className="text-[10px] text-text-muted">agregada</span>
              ) : (
                <span className="text-[10px] text-text-muted">única</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {entries.map((entry, i) =>
                entry.kind === 'numeric' ? (
                  <NumericPeriodRow
                    key={`${tracker.id}-${entry.range}-${i}`}
                    entry={entry}
                    unit={tracker.unit}
                    periodHighlightLabel={periodHighlightLabel}
                  />
                ) : (
                  <CompletionPeriodRow
                    key={`${tracker.id}-${entry.range}-${i}`}
                    entry={entry}
                    periodHighlightLabel={periodHighlightLabel}
                  />
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
