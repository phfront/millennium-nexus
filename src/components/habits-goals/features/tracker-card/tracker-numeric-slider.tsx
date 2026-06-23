'use client';

import { useCallback, useRef, useState } from 'react';
import { getTrackerAccentTheme } from '@/components/habits-goals/features/tracker-card/tracker-accent-themes';

function clampValue(next: number, rangeMax: number) {
  return Math.min(rangeMax, Math.max(0, Math.round(next)));
}

type TrackerNumericSliderProps = {
  value: number;
  max: number;
  unit?: string | null;
  disabled?: boolean;
  accentClass?: string;
  onChange: (value: number) => void;
};

export function TrackerNumericSlider({
  value,
  max,
  unit,
  disabled = false,
  accentClass = 'bg-brand-primary',
  onChange,
}: TrackerNumericSliderProps) {
  const theme = getTrackerAccentTheme(accentClass);
  const rangeMax = Math.max(max, value, 1);
  const goalLabel = max > 0 ? max : '—';
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : value > 0 ? 100 : 0;
  const fillPct = max > 0 ? Math.min(100, (value / max) * 100) : Math.min(100, (value / rangeMax) * 100);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const ringRadius = 15;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (pct / 100) * ringCircumference;

  const valueFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return value;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return clampValue(ratio * rangeMax, rangeMax);
    },
    [rangeMax, value],
  );

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    onChange(valueFromPointer(event.clientX));
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled || !isDragging) return;
    onChange(valueFromPointer(event.clientX));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function nudge(delta: number) {
    if (disabled) return;
    onChange(clampValue(value + delta, rangeMax));
  }

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
              style={{ transition: isDragging ? 'none' : 'stroke-dashoffset 300ms ease-out' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums text-text-primary">
            {pct}%
          </span>
        </div>
      </div>

      <div
        ref={trackRef}
        role="slider"
        aria-label={`Progresso: ${value} de ${goalLabel}${unit ? ` ${unit}` : ''}`}
        aria-valuemin={0}
        aria-valuemax={rangeMax}
        aria-valuenow={value}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault();
            nudge(-1);
          }
          if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault();
            nudge(1);
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={[
          'relative h-12 w-full touch-none overflow-visible rounded-xl border border-white/10 bg-black/30',
          disabled ? 'cursor-not-allowed opacity-45' : 'cursor-grab active:cursor-grabbing',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
        ].join(' ')}
      >
        <div className="pointer-events-none absolute inset-x-2 inset-y-2 overflow-hidden rounded-lg">
          <div
            className={`h-full rounded-lg bg-gradient-to-r ${theme.fill} shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]`}
            style={{
              width: `${fillPct}%`,
              transition: isDragging ? 'none' : 'width 250ms ease-out',
            }}
          />
        </div>

        <div
          className={[
            'pointer-events-none absolute top-1/2 z-10 h-7 w-7 -translate-y-1/2 rounded-full border border-white/80 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] ring-4',
            theme.ring,
            isDragging ? 'scale-110' : 'scale-100',
            'transition-transform duration-150',
          ].join(' ')}
          style={{
            left: `clamp(0.35rem, calc(${fillPct}% - 0.875rem), calc(100% - 1.15rem))`,
          }}
        />
      </div>
    </div>
  );
}
