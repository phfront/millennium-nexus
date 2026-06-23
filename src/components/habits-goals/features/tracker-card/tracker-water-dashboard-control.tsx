'use client';

import { useState } from 'react';
import { PenLine, RotateCcw } from 'lucide-react';
import { Button, Modal } from '@phfront/millennium-ui';
import { HydrationSpringReactor } from '@/components/habits-goals/features/tracker-card/hydration-spring-reactor';

type TrackerWaterDashboardControlProps = {
  current: number;
  goal: number;
  unit: string;
  entries: number[];
  readonly?: boolean;
  quickValues: number[];
  onSaveEntries: (entries: number[]) => void;
};

export function TrackerWaterDashboardControl({
  current,
  goal,
  unit,
  entries,
  readonly = false,
  quickValues,
  onSaveEntries,
}: TrackerWaterDashboardControlProps) {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const fillPct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
  const progress = Math.round(fillPct);
  const goalMet = goal > 0 && current >= goal;
  const remaining = Math.max(0, goal - current);

  function addEntry(value: number) {
    onSaveEntries([...entries, value]);
  }

  function handleCustomSave() {
    const value = Math.round(Number(customValue));
    if (!Number.isFinite(value) || value <= 0) return;
    addEntry(value);
    setCustomValue('');
    setShowCustomModal(false);
  }

  const actionBtnHeight = 'h-[3.75rem]';

  const actionBtnBaseClass = [
    'flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-sky-400/25',
    'bg-gradient-to-b from-sky-500/14 to-cyan-600/6 px-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
    actionBtnHeight,
    'transition-all duration-150 hover:border-sky-400/45 hover:from-sky-500/22 active:scale-[0.97]',
    'disabled:cursor-not-allowed disabled:opacity-35',
  ].join(' ');

  const quickBtnClass = ['min-w-0 flex-1', actionBtnBaseClass].join(' ');
  const iconBtnClass = ['w-11 shrink-0 text-sky-300/90', actionBtnBaseClass].join(' ');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        <div className="relative w-[3.25rem] shrink-0 self-stretch overflow-visible">
          <HydrationSpringReactor fillPct={fillPct} goalMet={goalMet} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <div className="space-y-1">
            <div className="flex items-end justify-between gap-2">
              <p className="text-[1.65rem] font-bold leading-none tabular-nums tracking-tight text-text-primary sm:text-[1.75rem]">
                {current.toLocaleString('pt-BR')}
                <span className="ml-1 text-xs font-medium text-text-muted">{unit}</span>
              </p>
              {goal > 0 && (
                <span className="shrink-0 text-xs font-bold tabular-nums text-sky-300/90">{progress}%</span>
              )}
            </div>
            <p className="text-[11px] leading-snug text-text-muted">
              {goal > 0 ? (
                remaining > 0 ? (
                  <>
                    Meta {goal.toLocaleString('pt-BR')} {unit} · faltam{' '}
                    <span className="font-semibold text-sky-300/90">{remaining.toLocaleString('pt-BR')}</span>
                  </>
                ) : (
                  <span className="font-semibold text-cyan-300">Meta diária atingida</span>
                )
              ) : (
                'Sem meta definida'
              )}
            </p>
          </div>

          {goal > 0 && (
            <div className="h-1 min-w-0 overflow-hidden rounded-full bg-white/8">
              <div
                className={[
                  'h-full rounded-full transition-all duration-500',
                  goalMet
                    ? 'bg-gradient-to-r from-sky-500 via-cyan-400 to-teal-300'
                    : 'bg-gradient-to-r from-sky-700 via-sky-500 to-cyan-400',
                ].join(' ')}
                style={{ width: `${fillPct}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          )}
        </div>
      </div>

      {!readonly && (
        <div className="flex items-stretch gap-2">
          {quickValues.map((value) => (
            <button key={value} type="button" onClick={() => addEntry(value)} className={quickBtnClass}>
              <span className="text-base font-bold tabular-nums text-sky-100 sm:text-lg">
                +{value.toLocaleString('pt-BR')}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-400/75">{unit}</span>
            </button>
          ))}
          <button
            type="button"
            disabled={goal <= 0}
            onClick={() => addEntry(goal)}
            className={quickBtnClass}
            aria-label={goal > 0 ? `Adicionar meta diária de ${goal} ${unit}` : 'Meta diária não definida'}
          >
            <span className="text-base font-bold tabular-nums text-sky-100 sm:text-lg">
              +{goal > 0 ? goal.toLocaleString('pt-BR') : '—'}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-400/75">meta</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCustomModal(true)}
            className={iconBtnClass}
            aria-label="Outro valor"
          >
            <PenLine size={18} strokeWidth={2.25} aria-hidden />
          </button>
          <button
            type="button"
            disabled={entries.length === 0}
            onClick={() => onSaveEntries(entries.slice(0, -1))}
            className={iconBtnClass}
            aria-label="Desfazer último lançamento"
          >
            <RotateCcw size={18} strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      )}

      <Modal isOpen={showCustomModal} onClose={() => setShowCustomModal(false)} title={`Outro valor (${unit})`}>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Valor em {unit}</label>
            <input
              type="number"
              min={1}
              step={1}
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
              placeholder="Ex: 350"
              className="w-full rounded-lg border border-border bg-surface-3 px-3 py-2 text-sm text-text-primary tabular-nums outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={() => setShowCustomModal(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCustomSave}
              className="bg-sky-500 text-white hover:bg-sky-600 focus-visible:shadow-[0_0_0_3px_rgba(56,189,248,0.35)]"
            >
              Adicionar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
