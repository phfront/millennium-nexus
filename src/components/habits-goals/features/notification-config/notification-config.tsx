'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Switch, Button, TimePicker } from '@phfront/millennium-ui';
import type { Tracker, TrackerNotification, NotificationType } from '@/types/habits-goals';

interface NotificationConfigProps {
  tracker: Tracker;
}

/** Forma estável para comparar alterações (sem id / created_at). */
function comparableNotification(n: Partial<TrackerNotification>): string {
  const type = n.type ?? 'fixed_time';
  const enabled = n.enabled ?? true;
  let fields: Record<string, unknown> = { type, enabled };

  if (type === 'fixed_time') {
    fields = {
      ...fields,
      scheduled_times: [...(n.scheduled_times?.length ? n.scheduled_times : ['08:00'])],
      frequency_minutes: null,
      window_start: null,
      window_end: null,
      target_time: null,
      lead_time: null,
    };
  } else if (type === 'interval') {
    fields = {
      ...fields,
      scheduled_times: null,
      frequency_minutes: n.frequency_minutes ?? 30,
      window_start: n.window_start ?? '08:00',
      window_end: n.window_end ?? '22:00',
      target_time: null,
      lead_time: null,
    };
  } else {
    fields = {
      ...fields,
      scheduled_times: null,
      frequency_minutes: null,
      window_start: null,
      window_end: null,
      target_time: n.target_time ?? '20:00',
      lead_time: n.lead_time ?? 30,
    };
  }

  return JSON.stringify(fields);
}

function defaultNotification(trackerId: string): Partial<TrackerNotification> {
  return {
    tracker_id: trackerId,
    type: 'fixed_time',
    enabled: true,
    scheduled_times: ['08:00'],
  };
}

const PERIOD_BADGE: Record<string, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  custom: 'Personalizado',
};

export function NotificationConfig({ tracker }: NotificationConfigProps) {
  const [notification, setNotification] = useState<Partial<TrackerNotification>>(() =>
    defaultNotification(tracker.id),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [baselineStr, setBaselineStr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    setBaselineStr(null);
    setNotification(defaultNotification(tracker.id));

    supabase
      .from('tracker_notifications')
      .select('*')
      .eq('tracker_id', tracker.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          const row = data as TrackerNotification;
          setNotification(row);
          setBaselineStr(comparableNotification(row));
        } else {
          const d = defaultNotification(tracker.id);
          setNotification(d);
          setBaselineStr(comparableNotification(d));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tracker.id]);

  const currentKey = useMemo(() => comparableNotification(notification), [notification]);
  const isDirty = baselineStr !== null && currentKey !== baselineStr;

  async function handleSave() {
    if (!isDirty) return;
    setIsLoading(true);
    try {
      const supabase = createClient();
      const payload = { ...notification, tracker_id: tracker.id };
      if (notification.id) {
        await supabase.from('tracker_notifications').update(payload).eq('id', notification.id);
        setBaselineStr(currentKey);
      } else {
        const { data, error } = await supabase
          .from('tracker_notifications')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        if (data) {
          const row = data as TrackerNotification;
          setNotification(row);
          setBaselineStr(comparableNotification(row));
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
    } finally {
      setIsLoading(false);
    }
  }

  const TYPE_LABELS: Record<NotificationType, string> = {
    fixed_time: 'Horário fixo',
    interval: 'Intervalo',
    reminder: 'Lembrete',
  };

  const pk = tracker.period_kind ?? 'daily';

  return (
    <div className="flex flex-col gap-4 p-4 bg-surface-2 rounded-xl border border-border">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {tracker.label}
            {pk !== 'daily' && (
              <span className="ml-2 inline-flex rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                {PERIOD_BADGE[pk] ?? pk}
              </span>
            )}
          </p>
          <p className="text-xs text-text-muted">{tracker.unit ? `Unidade: ${tracker.unit}` : tracker.type}</p>
        </div>
        <Switch
          checked={notification.enabled ?? true}
          onCheckedChange={(v) => setNotification((prev) => ({ ...prev, enabled: v }))}
        />
      </div>

      {pk !== 'daily' && (
        <p className="text-xs leading-relaxed text-text-muted">
          Esta meta não é diária: o lembrete dispara nos <strong>dias da semana</strong> que definiu na meta; deixa de
          enviar push quando o <strong>período corrente</strong> já estiver concluído.
        </p>
      )}
      {pk === 'monthly' && tracker.period_aggregation === 'single' && (
        <p className="text-xs leading-relaxed text-amber-700/90 dark:text-amber-400/90">
          <strong>Dica:</strong> para metas mensais únicas, combine <strong>horário fixo</strong> com um único dia da
          semana (ex.: só sextas), para o lembrete fazer sentido no calendário.
        </p>
      )}

      {notification.enabled && (
        <>
          <div className="flex gap-2">
            {(Object.keys(TYPE_LABELS) as NotificationType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setNotification((prev) => ({ ...prev, type: t }))}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  notification.type === t
                    ? 'bg-brand-primary text-white'
                    : 'bg-surface-3 text-text-secondary hover:bg-surface-3/80'
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {notification.type === 'fixed_time' && (
            <div className="flex flex-col gap-2">
              {(notification.scheduled_times ?? ['08:00']).map((time, i) => (
                <TimePicker
                  key={i}
                  value={time}
                  label={`Horário ${i + 1}`}
                  clearable={false}
                  onChange={(v) => {
                    const times = [...(notification.scheduled_times ?? [])];
                    times[i] = v ?? time;
                    setNotification((prev) => ({ ...prev, scheduled_times: times }));
                  }}
                />
              ))}
              <button
                type="button"
                className="text-xs text-brand-primary hover:underline self-start cursor-pointer"
                onClick={() =>
                  setNotification((prev) => ({
                    ...prev,
                    scheduled_times: [...(prev.scheduled_times ?? []), '08:00'],
                  }))
                }
              >
                + Adicionar horário
              </button>
            </div>
          )}

          {notification.type === 'interval' && (
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:gap-3">
              <div className="flex min-w-0 w-full flex-col gap-1 sm:w-auto sm:max-w-30 sm:shrink-0">
                <label className="text-xs font-medium text-text-secondary">A cada (min)</label>
                <input
                  type="number"
                  min={5}
                  value={notification.frequency_minutes ?? 30}
                  onChange={(e) =>
                    setNotification((prev) => ({ ...prev, frequency_minutes: Number(e.target.value) }))
                  }
                  className="min-w-0 w-full rounded-lg border border-border bg-surface-3 px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                />
              </div>
              <div className="grid min-w-0 w-full grid-cols-2 gap-3 sm:flex sm:min-w-0 sm:flex-1">
                <TimePicker
                  className="min-w-0 w-full"
                  value={notification.window_start ?? '08:00'}
                  label="Das"
                  clearable={false}
                  onChange={(v) =>
                    setNotification((prev) => ({ ...prev, window_start: v ?? prev.window_start ?? '08:00' }))
                  }
                />
                <TimePicker
                  className="min-w-0 w-full"
                  value={notification.window_end ?? '22:00'}
                  label="Até"
                  clearable={false}
                  onChange={(v) =>
                    setNotification((prev) => ({ ...prev, window_end: v ?? prev.window_end ?? '22:00' }))
                  }
                />
              </div>
            </div>
          )}

          {notification.type === 'reminder' && (
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:gap-3">
              <TimePicker
                className="min-w-0 w-full sm:flex-1"
                value={notification.target_time ?? '20:00'}
                label="Horário alvo"
                clearable={false}
                onChange={(v) =>
                  setNotification((prev) => ({ ...prev, target_time: v ?? prev.target_time ?? '20:00' }))
                }
              />
              <div className="flex min-w-0 w-full flex-col gap-1 sm:flex-1">
                <label className="text-xs font-medium text-text-secondary">Antecedência (min)</label>
                <input
                  type="number"
                  min={5}
                  value={notification.lead_time ?? 30}
                  onChange={(e) =>
                    setNotification((prev) => ({ ...prev, lead_time: Number(e.target.value) }))
                  }
                  className="min-w-0 w-full rounded-lg border border-border bg-surface-3 px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                />
              </div>
            </div>
          )}
        </>
      )}

      {baselineStr !== null &&
        (isDirty ? (
          <Button variant="primary" size="sm" onClick={handleSave} disabled={isLoading}>
            {saved ? '✓ Salvo' : isLoading ? 'Salvando…' : 'Salvar configuração'}
          </Button>
        ) : (
          <p className="text-xs text-text-muted text-center py-2">Nenhuma alteração</p>
        ))}
    </div>
  );
}
