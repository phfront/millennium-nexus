'use client';

import { useState } from 'react';
import { Flame } from 'lucide-react';
import { Button, Modal, Skeleton, useToast } from '@phfront/millennium-ui';
import type { CaloriasLog, CaloriasSettings } from '@/types/calorias';
import { formatKcal } from '@/lib/health/nutrition';
import { formatActiveDaysLabel } from '@/lib/health/calorias';
import { WidgetSectionHeader } from '@/components/widgets/WidgetSectionHeader';

const QUICK_ADD = [100, 250, 500] as const;

export type CaloriasTrackerProps = {
  settings: CaloriasSettings;
  logs: CaloriasLog[];
  isLoading: boolean;
  addKcal: (amount: number, note?: string | null, loggedDate?: string) => Promise<CaloriasLog>;
  undoLast: () => Promise<void>;
  today: string;
  weekTotalKcal: number;
  weeklyTargetKcal: number;
  weeklyRemaining: number;
  effectiveTargetToday: number;
  todayTotal: number;
  todayRemaining: number;
  progressToday: number;
};

export function CaloriasTracker({
  settings,
  logs,
  isLoading,
  addKcal,
  undoLast,
  today,
  weekTotalKcal,
  weeklyTargetKcal,
  weeklyRemaining,
  effectiveTargetToday,
  todayTotal,
  todayRemaining,
  progressToday,
}: CaloriasTrackerProps) {
  const { toast } = useToast();
  const [showOther, setShowOther] = useState(false);
  const [otherAmount, setOtherAmount] = useState('');
  const [otherNote, setOtherNote] = useState('');
  const [saving, setSaving] = useState(false);

  const todayLogs = logs.filter((l) => l.logged_date === today);
  const subtitle = `${formatActiveDaysLabel(settings.active_days)} · ${formatKcal(settings.daily_target_kcal)}/dia · ${formatKcal(weeklyTargetKcal)}/sem`;

  async function handleAdd(amount: number) {
    try {
      await addKcal(amount);
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao registrar');
    }
  }

  async function handleOtherSave() {
    const n = Math.round(Number(otherAmount));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Valor inválido', 'Indique um número positivo de kcal.');
      return;
    }
    setSaving(true);
    try {
      await addKcal(n, otherNote || null);
      setShowOther(false);
      setOtherAmount('');
      setOtherNote('');
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao registrar');
    }
    setSaving(false);
  }

  async function handleUndo() {
    try {
      await undoLast();
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao desfazer');
    }
  }

  if (isLoading) {
    return <Skeleton variant="block" className="h-full min-h-[220px] w-full rounded-2xl" />;
  }

  const fillPct = Math.min(100, Math.max(0, progressToday));
  const lastToday = todayLogs.length > 0 ? todayLogs[todayLogs.length - 1].amount_kcal : 0;

  return (
    <div className="relative flex min-h-[220px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface-2/25 shadow-sm backdrop-blur-md">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out"
        style={{ height: `${fillPct}%` }}
        aria-hidden
      >
        <div
          className={
            fillPct >= 100
              ? 'absolute inset-0 bg-linear-to-b from-brand-primary/20 via-brand-primary/14 to-brand-primary/24'
              : 'absolute inset-0 bg-linear-to-t from-brand-primary/25 via-transparent to-transparent'
          }
          style={
            fillPct >= 100
              ? undefined
              : {
                  maskImage: 'linear-gradient(to top, black 0%, black 42%, transparent 78%)',
                  WebkitMaskImage: 'linear-gradient(to top, black 0%, black 42%, transparent 78%)',
                }
          }
        />
      </div>

      {fillPct < 100 ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-b from-surface-2/55 via-transparent to-transparent"
          aria-hidden
        />
      ) : null}

      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-2 p-3">
        <WidgetSectionHeader
          variant="primary"
          icon={<Flame className="h-3.5 w-3.5" aria-hidden />}
          title="Calorias"
          subtitle={subtitle}
          trailing={
            <span className="rounded-full bg-brand-primary/20 px-2 py-0.5 text-[10px] font-medium tabular-nums text-brand-primary ring-1 ring-brand-primary/25 sm:text-[11px]">
              {progressToday}%
            </span>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          {weeklyRemaining <= 0 ? (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/25">
              Meta semanal atingida
            </span>
          ) : (
            <span className="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-medium text-text-secondary ring-1 ring-white/10">
              <span className="tabular-nums text-text-primary">
                Faltam {formatKcal(weeklyRemaining)} kcal
              </span>
              <span className="ml-1 text-[10px] opacity-70">na semana</span>
            </span>
          )}
        </div>

        <div className="shrink-0 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
            <span className="text-lg font-semibold tabular-nums leading-none text-text-primary sm:text-xl">
              {formatKcal(todayTotal)}
            </span>
            <span className="text-[11px] text-text-muted sm:text-xs">
              / {effectiveTargetToday > 0 ? `${formatKcal(effectiveTargetToday)}` : '—'} kcal hoje
            </span>
          </div>
          {effectiveTargetToday > 0 && (
            <p className="text-[10px] text-text-muted sm:text-[11px]">
              Restam <span className="tabular-nums font-medium text-text-secondary">{formatKcal(todayRemaining)}</span> kcal para a meta de hoje
            </p>
          )}
          <div
            className="h-1 overflow-hidden rounded-full bg-black/35 ring-1 ring-inset ring-white/10"
            role="progressbar"
            aria-valuenow={progressToday}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso das calorias de hoje"
          >
            <div
              className="h-full rounded-full bg-linear-to-r from-brand-primary to-brand-secondary transition-[width] duration-500 ease-out"
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <p className="text-[10px] text-text-muted tabular-nums">
            Semana: {formatKcal(weekTotalKcal)} / {formatKcal(weeklyTargetKcal)} kcal
          </p>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          {QUICK_ADD.map((kcal) => (
            <button
              key={kcal}
              type="button"
              onClick={() => void handleAdd(kcal)}
              className={[
                'flex min-h-0 min-w-0 cursor-pointer flex-col items-center justify-center rounded-xl py-2',
                'border border-white/12 bg-white/6 text-center',
                'text-xs font-semibold tabular-nums leading-none text-text-primary sm:text-sm',
                'transition hover:border-brand-primary/40 hover:bg-brand-primary/12 hover:text-text-primary',
                'active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-primary/60',
              ].join(' ')}
            >
              +{formatKcal(kcal)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowOther(true)}
            className={[
              'flex min-h-0 min-w-0 cursor-pointer flex-col items-center justify-center rounded-xl py-2',
              'border border-white/12 bg-white/6 text-center',
              'text-xs font-semibold leading-none text-text-primary sm:text-sm',
              'transition hover:border-brand-primary/40 hover:bg-brand-primary/12 hover:text-text-primary',
              'active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-primary/60',
            ].join(' ')}
          >
            + Outro
          </button>
          <button
            type="button"
            disabled={todayLogs.length === 0}
            onClick={() => void handleUndo()}
            aria-label={
              todayLogs.length > 0
                ? `Desfazer último registo (${lastToday} kcal)`
                : 'Desfazer último registo (indisponível sem histórico hoje)'
            }
            className={[
              'flex min-h-0 min-w-0 cursor-pointer flex-col items-center justify-center rounded-xl py-2',
              'border border-white/12 bg-white/6 text-center',
              'text-xs font-semibold leading-none text-text-primary sm:text-sm',
              'transition hover:border-amber-400/35 hover:bg-amber-500/12 hover:text-amber-50',
              'active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-400/60',
              'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/12 disabled:hover:bg-white/6 disabled:hover:text-text-primary',
            ].join(' ')}
          >
            Desfazer
          </button>
        </div>
      </div>

      <Modal isOpen={showOther} onClose={() => !saving && setShowOther(false)} title="Outro valor (kcal)">
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Kcal</label>
            <input
              type="number"
              min={1}
              step={1}
              value={otherAmount}
              onChange={(e) => setOtherAmount(e.target.value)}
              placeholder="Ex: 150"
              className="w-full rounded-lg border border-border bg-surface-3 px-3 py-2 text-sm text-text-primary tabular-nums outline-none focus:border-brand-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Nota (opcional)</label>
            <input
              type="text"
              value={otherNote}
              onChange={(e) => setOtherNote(e.target.value)}
              placeholder="Ex: corrida, HIIT…"
              className="w-full rounded-lg border border-border bg-surface-3 px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" disabled={saving} onClick={() => setShowOther(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleOtherSave()}>
              Registrar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
