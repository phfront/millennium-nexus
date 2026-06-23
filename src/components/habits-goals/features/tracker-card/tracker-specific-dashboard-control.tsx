'use client';

import { useState } from 'react';
import { Droplets, Plus, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button, Modal } from '@phfront/millennium-ui';
import { getTrackerAccentTheme } from '@/components/habits-goals/features/tracker-card/tracker-accent-themes';

type TrackerSpecificDashboardControlProps = {
  current: number;
  goal: number;
  unit: string;
  entries: number[];
  readonly?: boolean;
  quickValues: number[];
  onSaveEntries: (entries: number[]) => void;
};

function ProgressRing({ pct, strokeClass }: { pct: number; strokeClass: string }) {
  const ringRadius = 15;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (pct / 100) * ringCircumference;

  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={ringRadius}
          fill="none"
          className={strokeClass}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={ringCircumference}
          strokeDashoffset={ringOffset}
          style={{ transition: 'stroke-dashoffset 300ms ease-out' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums text-text-primary">
        {pct}%
      </span>
    </div>
  );
}

export function TrackerSpecificDashboardControl({
  current,
  goal,
  unit,
  entries,
  readonly = false,
  quickValues,
  onSaveEntries,
}: TrackerSpecificDashboardControlProps) {
  const accentClass = 'bg-sky-400';
  const theme = getTrackerAccentTheme(accentClass);
  const progress = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;
  const fillPct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
  const goalLabel = goal > 0 ? goal : '—';

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customValue, setCustomValue] = useState('');

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

  const quickBtnClass = [
    'group flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.03] px-1',
    'transition-all duration-150 active:scale-[0.97]',
    theme.btnHover,
    'disabled:cursor-not-allowed disabled:opacity-35',
  ].join(' ');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Hoje</p>
          <p className="mt-0.5 flex items-baseline gap-1 tabular-nums">
            <span className="text-3xl font-semibold tracking-tight text-text-primary">
              {current.toLocaleString('pt-BR')}
            </span>
            <span className="text-sm text-text-muted">
              / {goalLabel.toLocaleString('pt-BR')}
              {unit ? ` ${unit}` : ''}
            </span>
          </p>
        </div>
        <ProgressRing pct={progress} strokeClass={theme.stroke} />
      </div>

      <div className="relative h-12 overflow-visible rounded-xl border border-white/10 bg-black/30" aria-hidden>
        <div className="pointer-events-none absolute inset-x-2 inset-y-2 overflow-hidden rounded-lg">
          <div
            className={`h-full rounded-lg bg-gradient-to-r ${theme.fill} shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]`}
            style={{ width: `${fillPct}%`, transition: 'width 300ms ease-out' }}
          />
        </div>
        <div
          className={[
            'pointer-events-none absolute top-1/2 z-10 h-7 w-7 -translate-y-1/2 rounded-full border border-white/80 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] ring-4',
            theme.ring,
          ].join(' ')}
          style={{
            left: `clamp(0.35rem, calc(${fillPct}% - 0.875rem), calc(100% - 1.15rem))`,
          }}
        />
      </div>

      {!readonly && (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-2">
          <div className="grid grid-cols-5 gap-1.5">
            {quickValues.map((value) => (
              <button key={value} type="button" onClick={() => addEntry(value)} className={quickBtnClass}>
                <Plus size={13} className={theme.btnIdle} aria-hidden />
                <span className={`text-[11px] font-bold tabular-nums sm:text-xs ${theme.btnIdle}`}>
                  {value.toLocaleString('pt-BR')}
                </span>
              </button>
            ))}
            <button type="button" onClick={() => setShowCustomModal(true)} className={quickBtnClass}>
              <SlidersHorizontal size={13} className={theme.btnIdle} aria-hidden />
              <span className={`text-[10px] font-semibold sm:text-[11px] ${theme.btnIdle}`}>Outro</span>
            </button>
            <button
              type="button"
              disabled={entries.length === 0}
              onClick={() => onSaveEntries(entries.slice(0, -1))}
              className={quickBtnClass}
            >
              <RotateCcw size={13} className="text-text-muted" aria-hidden />
              <span className="text-[10px] font-semibold text-text-muted sm:text-[11px]">Desfazer</span>
            </button>
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entries.map((entry, index) => (
            <span
              key={`${index}-${entry}`}
              className="inline-flex items-center gap-1 rounded-full bg-sky-400/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-sky-300 ring-1 ring-inset ring-sky-400/20"
            >
              <Droplets size={10} aria-hidden />
              +{entry.toLocaleString('pt-BR')}
            </span>
          ))}
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
              className="w-full rounded-lg border border-border bg-surface-3 px-3 py-2 text-sm text-text-primary tabular-nums outline-none focus:border-brand-primary"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={() => setShowCustomModal(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleCustomSave}>
              Adicionar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
