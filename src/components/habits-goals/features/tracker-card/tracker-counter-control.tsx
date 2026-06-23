'use client';

import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { getTrackerAccentTheme } from '@/components/habits-goals/features/tracker-card/tracker-accent-themes';

type TrackerCounterControlProps = {
  value: number;
  max?: number | null;
  unit?: string | null;
  step?: number;
  disabled?: boolean;
  accentClass?: string;
  onChange: (value: number) => void;
};

const HOLD_BEFORE_REPEAT_MS = 450;
const REPEAT_INTERVAL_MS = 55;
const SEGMENT_COUNT = 10;

export function TrackerCounterControl({
  value,
  max,
  unit,
  step = 1,
  disabled = false,
  accentClass = 'bg-brand-primary',
  onChange,
}: TrackerCounterControlProps) {
  const theme = getTrackerAccentTheme(accentClass);
  const goalLabel = max != null && max > 0 ? max : '—';
  const pct =
    max != null && max > 0 ? Math.min(100, Math.round((value / max) * 100)) : value > 0 ? 100 : 0;
  const filledSegments = Math.min(SEGMENT_COUNT, Math.round((pct / 100) * SEGMENT_COUNT));
  const ringRadius = 15;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (pct / 100) * ringCircumference;

  const isPressingRef = useRef(false);
  const lastRef = useRef(value);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const repeatTimerRef = useRef<ReturnType<typeof setInterval>>();
  const [pressingSide, setPressingSide] = useState<'minus' | 'plus' | null>(null);

  useEffect(() => {
    if (!isPressingRef.current) {
      lastRef.current = value;
    }
  }, [value]);

  useEffect(
    () => () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (repeatTimerRef.current) clearInterval(repeatTimerRef.current);
    },
    [],
  );

  function clearRepeat() {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = undefined;
    }
    if (repeatTimerRef.current) {
      clearInterval(repeatTimerRef.current);
      repeatTimerRef.current = undefined;
    }
    isPressingRef.current = false;
    setPressingSide(null);
  }

  function startRepeat(direction: -1 | 1) {
    if (disabled) return;
    clearRepeat();
    isPressingRef.current = true;
    setPressingSide(direction === -1 ? 'minus' : 'plus');
    lastRef.current = value;

    const applyStep = () => {
      if (direction === -1) {
        if (lastRef.current <= 0) return false;
        lastRef.current = Math.max(0, lastRef.current - step);
      } else {
        if (max != null && lastRef.current >= max) return false;
        lastRef.current = max != null ? Math.min(max, lastRef.current + step) : lastRef.current + step;
      }
      onChange(lastRef.current);
      return true;
    };

    if (!applyStep()) {
      isPressingRef.current = false;
      setPressingSide(null);
      return;
    }

    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = undefined;
      repeatTimerRef.current = setInterval(() => {
        if (!applyStep()) {
          clearRepeat();
        }
      }, REPEAT_INTERVAL_MS);
    }, HOLD_BEFORE_REPEAT_MS);
  }

  const minusDisabled = disabled || value <= 0;
  const plusDisabled = disabled || (max != null && value >= max);

  const stepperBtnClass = (side: 'minus' | 'plus', isDisabled: boolean) =>
    [
      'relative z-10 flex h-full w-[4.25rem] shrink-0 items-center justify-center transition-all duration-150 select-none touch-manipulation',
      side === 'minus' ? 'border-r border-white/10' : 'border-l border-white/10',
      isDisabled
        ? 'cursor-not-allowed text-text-muted/35'
        : ['cursor-pointer', theme.btnIdle, theme.btnHover, theme.btnActive].join(' '),
      pressingSide === side && !isDisabled ? 'scale-[0.97] bg-white/[0.06]' : '',
    ].join(' ');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Progresso</p>
          <p className="mt-0.5 flex items-baseline gap-1 tabular-nums">
            <span className="text-3xl font-semibold tracking-tight text-text-primary">{value}</span>
            <span className="text-sm text-text-muted">
              / {goalLabel}
              {unit ? ` ${unit}` : ''}
            </span>
          </p>
        </div>

        <div className="relative shrink-0">
          <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90" aria-hidden>
            <circle
              cx="18"
              cy="18"
              r={ringRadius}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r={ringRadius}
              fill="none"
              className={theme.stroke}
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
      </div>

      <div className="relative flex h-14 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        <div
          className={`pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r ${theme.fill} opacity-[0.18]`}
          style={{ width: `${pct}%`, transition: 'width 250ms ease-out' }}
          aria-hidden
        />

        <button
          type="button"
          disabled={minusDisabled}
          className={stepperBtnClass('minus', minusDisabled)}
          aria-label="Diminuir valor"
          onPointerDown={(event) => {
            event.preventDefault();
            startRepeat(-1);
          }}
          onPointerUp={clearRepeat}
          onPointerLeave={clearRepeat}
          onPointerCancel={clearRepeat}
        >
          <Minus size={20} strokeWidth={2.25} aria-hidden />
        </button>

        <div className="relative z-10 flex min-w-0 flex-1 items-center justify-center px-3">
          <div className="flex items-center gap-1.5" aria-hidden>
            {Array.from({ length: SEGMENT_COUNT }, (_, index) => (
              <span
                key={index}
                className={[
                  'h-2 w-2 rounded-full transition-all duration-300',
                  index < filledSegments ? theme.segmentActive : 'bg-white/10',
                ].join(' ')}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={plusDisabled}
          className={stepperBtnClass('plus', plusDisabled)}
          aria-label="Aumentar valor"
          onPointerDown={(event) => {
            event.preventDefault();
            startRepeat(1);
          }}
          onPointerUp={clearRepeat}
          onPointerLeave={clearRepeat}
          onPointerCancel={clearRepeat}
        >
          <Plus size={20} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
    </div>
  );
}
