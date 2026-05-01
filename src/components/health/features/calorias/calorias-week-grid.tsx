'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Button, Modal, Skeleton, useToast } from '@phfront/millennium-ui';
import type { CaloriasLog, CaloriasSettings } from '@/types/calorias';
import { formatKcal } from '@/lib/health/nutrition';
import {
  dayIndexMon0Sun6,
  effectiveTargetForDay,
  isActiveDay,
  parseLocalDateISO,
} from '@/lib/health/calorias';

const DAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;
const QUICK_ADD = [100, 250, 500] as const;

export type CaloriasWeekGridProps = {
  settings: CaloriasSettings;
  logs: CaloriasLog[];
  weekDates: string[];
  weekBounds: { monday: string; sunday: string };
  today: string;
  isLoading: boolean;
  addKcal: (amount: number, note?: string | null, loggedDate?: string) => Promise<CaloriasLog>;
  undoLastForDate: (loggedDate: string) => Promise<void>;
};

function formatDayHeading(dateISO: string): string {
  const d = parseLocalDateISO(dateISO);
  const label = DAY_SHORT[dayIndexMon0Sun6(d)];
  const br = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${label} · ${br}`;
}

export function CaloriasWeekGrid({
  settings,
  logs,
  weekDates,
  weekBounds,
  today,
  isLoading,
  addKcal,
  undoLastForDate,
}: CaloriasWeekGridProps) {
  const { toast } = useToast();
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [otherAmount, setOtherAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingDate) setOtherAmount('');
  }, [editingDate]);

  if (isLoading) {
    return <Skeleton variant="block" className="h-32 w-full rounded-2xl sm:h-28" />;
  }

  const dayLogs = editingDate ? logs.filter((l) => l.logged_date === editingDate) : [];
  const editingTotal = dayLogs.reduce((s, l) => s + l.amount_kcal, 0);

  async function handleAddToEditing(amount: number) {
    if (!editingDate) return;
    try {
      await addKcal(amount, null, editingDate);
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao registrar');
    }
  }

  async function handleOtherSave() {
    if (!editingDate) return;
    const n = Math.round(Number(otherAmount));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Valor inválido', 'Indique um número positivo de kcal.');
      return;
    }
    setSaving(true);
    try {
      await addKcal(n, null, editingDate);
      setOtherAmount('');
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao registrar');
    }
    setSaving(false);
  }

  async function handleUndoEditingDay() {
    if (!editingDate) return;
    try {
      await undoLastForDate(editingDate);
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao desfazer');
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-2 shadow-sm ring-1 ring-brand-primary/10 sm:p-4">
      <div className="mb-2 flex items-center gap-2 sm:mb-3">
        <span
          className="h-7 w-1 shrink-0 rounded-full bg-linear-to-b from-brand-primary to-brand-secondary sm:h-8"
          aria-hidden
        />
        <h3 className="text-sm font-semibold text-white sm:text-base">Esta semana</h3>
      </div>
      <div
        className={[
          '-mx-0.5 flex min-w-0 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain px-0.5 pb-2 pt-0.5 [-webkit-overflow-scrolling:touch]',
          'snap-x snap-mandatory [scrollbar-width:thin]',
          'sm:mx-0 sm:gap-2.5 sm:px-0',
        ].join(' ')}
      >
        {weekDates.map((dateISO) => {
          const d = parseLocalDateISO(dateISO);
          const label = DAY_SHORT[dayIndexMon0Sun6(d)];
          const active = isActiveDay(dateISO, settings.active_days);
          const effective = effectiveTargetForDay(dateISO, settings, logs, weekBounds);
          const total = logs
            .filter((l) => l.logged_date === dateISO)
            .reduce((s, l) => s + l.amount_kcal, 0);
          const met = effective > 0 ? total >= effective : total > 0;
          const isToday = dateISO === today;
          const isPast = dateISO < today;

          const shellClass = [
            'relative flex min-h-[6.75rem] w-[96px] min-w-[96px] max-w-[96px] flex-none shrink-0 snap-start flex-col items-center justify-between gap-1.5 overflow-hidden rounded-xl border-2 px-1.5 pb-3 pt-3.5 text-center touch-manipulation',
            'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]',
            'sm:min-h-[6rem] sm:gap-1 sm:px-1.5 sm:pb-3 sm:pt-3.5',
            active
              ? [
                  'border-brand-primary/85 bg-linear-to-b from-brand-primary/38 via-brand-primary/18 to-surface-3',
                  'shadow-[0_8px_22px_-8px_color-mix(in_oklab,var(--color-brand-primary)_45%,transparent)]',
                ].join(' ')
              : [
                  'border-brand-secondary/80 bg-linear-to-b from-brand-secondary/34 via-brand-secondary/16 to-surface-3',
                  'shadow-[0_8px_22px_-8px_color-mix(in_oklab,var(--color-brand-secondary)_40%,transparent)]',
                ].join(' '),
            isToday
              ? 'ring-2 ring-brand-primary ring-offset-1 ring-offset-surface-2 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-brand-primary)_35%,transparent),0_12px_28px_-10px_color-mix(in_oklab,var(--color-brand-primary)_50%,transparent)] sm:ring-offset-2'
              : '',
            isPast && active
              ? 'cursor-pointer transition-[filter,background-color] duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/70 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-2 sm:focus-visible:ring-offset-2'
              : '',
            isPast && !active
              ? 'cursor-pointer transition-[filter,background-color] duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary/70 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-2 sm:focus-visible:ring-offset-2'
              : '',
          ].join(' ');

          const capClass = active ? 'bg-brand-primary' : 'bg-brand-secondary';

          const inner = (
            <>
              <span
                className={`pointer-events-none absolute inset-x-0 top-0 z-0 h-1.5 ${capClass} opacity-95`}
                aria-hidden
              />
              <span className="relative z-1 text-[11px] font-bold uppercase tracking-wide text-white sm:text-[11px]">
                {label}
              </span>
              <span className="relative z-1 text-[15px] font-bold tabular-nums leading-none text-white sm:text-base">
                {formatKcal(total)}
              </span>
              <span className="relative z-1 line-clamp-2 text-[11px] font-semibold leading-snug text-white sm:text-[11px]">
                {effective > 0 ? `meta ${formatKcal(effective)}` : '—'}
              </span>
              {met ? (
                <span
                  className={[
                    'relative z-1 flex h-6 w-6 items-center justify-center rounded-full text-white sm:h-5 sm:w-5',
                    active
                      ? 'bg-brand-primary/35 shadow-sm ring-1 ring-brand-primary/40'
                      : 'bg-brand-secondary/35 shadow-sm ring-1 ring-brand-secondary/45',
                  ].join(' ')}
                >
                  <Check className="h-3.5 w-3.5 sm:h-3 sm:w-3" aria-hidden />
                </span>
              ) : (
                <span
                  className={[
                    'relative z-1 h-6 w-6 shrink-0 rounded-full border-2 bg-surface-2/80 sm:h-5 sm:w-5',
                    active ? 'border-brand-primary/50' : 'border-brand-secondary/50',
                  ].join(' ')}
                  aria-hidden
                />
              )}
            </>
          );

          if (isPast) {
            return (
              <button
                key={dateISO}
                type="button"
                className={shellClass}
                aria-label={`${label}, ${formatKcal(total)} kcal. Toque para registar ou corrigir.`}
                onClick={() => setEditingDate(dateISO)}
              >
                {inner}
              </button>
            );
          }

          return (
            <div key={dateISO} className={shellClass}>
              {inner}
            </div>
          );
        })}
      </div>
      <div className="mt-3 space-y-2 text-[11px] leading-relaxed text-white sm:mt-4 sm:space-y-1.5 sm:text-[13px]">
        <p className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-1.5 sm:gap-y-1">
          <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="font-semibold">Legenda:</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 shrink-0 rounded-sm bg-brand-primary" aria-hidden />
              meta diária
            </span>
          </span>
          <span className="hidden text-white/80 sm:inline" aria-hidden>
            ·
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 shrink-0 rounded-sm bg-brand-secondary" aria-hidden />
            saldo semanal (rollover).
          </span>
        </p>
        <p>
          <span className="font-medium">Dias antes de hoje</span> são clicáveis: adicione kcal ou desfaça o
          último registo desse dia.
        </p>
      </div>

      <Modal
        isOpen={editingDate != null}
        onClose={() => !saving && setEditingDate(null)}
        title={editingDate ? `Calorias · ${formatDayHeading(editingDate)}` : 'Calorias'}
      >
        {editingDate ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-white">
              Total neste dia:{' '}
              <span className="font-semibold tabular-nums text-white">{formatKcal(editingTotal)}</span> kcal
            </p>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_ADD.map((kcal) => (
                <button
                  key={kcal}
                  type="button"
                  onClick={() => void handleAddToEditing(kcal)}
                  className="min-h-11 rounded-lg border border-white/12 bg-white/6 py-2.5 text-sm font-semibold tabular-nums text-white touch-manipulation transition hover:border-brand-primary/40 hover:bg-brand-primary/10 sm:min-h-0 sm:py-2 sm:text-xs"
                >
                  +{formatKcal(kcal)}
                </button>
              ))}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white">Outro (kcal)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={otherAmount}
                  onChange={(e) => setOtherAmount(e.target.value)}
                  placeholder="Ex: 150"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-surface-3 px-3 py-2 text-sm text-white tabular-nums outline-none placeholder:text-white/55 focus:border-brand-primary"
                />
                <Button type="button" disabled={saving} onClick={() => void handleOtherSave()}>
                  OK
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-2">
              <Button
                variant="secondary"
                type="button"
                disabled={saving || dayLogs.length === 0}
                onClick={() => void handleUndoEditingDay()}
              >
                Desfazer último
              </Button>
              <Button variant="secondary" type="button" disabled={saving} onClick={() => setEditingDate(null)}>
                Fechar
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
