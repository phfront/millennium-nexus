'use client';

import { Check } from 'lucide-react';
import { formatScore } from '@/lib/habits-goals/scoring';
import type { ChecklistItem } from '@/types/habits-goals';

type TrackerChecklistVariant = 'default' | 'dashboard';

interface TrackerChecklistControlProps {
  items: ChecklistItem[];
  checked: boolean[];
  disabled?: boolean;
  onToggle: (index: number, checked: boolean) => void;
  variant?: TrackerChecklistVariant;
}

export function TrackerChecklistControl({
  items,
  checked,
  disabled = false,
  onToggle,
  variant = 'default',
}: TrackerChecklistControlProps) {
  const isDashboard = variant === 'dashboard';

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-text-muted">
        Nenhum item na checklist.
      </p>
    );
  }

  return (
    <ul className={`flex flex-col ${isDashboard ? 'gap-1.5' : 'gap-2'}`}>
      {items.map((item, index) => {
        const isChecked = checked[index] ?? false;
        const points = Number(item.points ?? 0);
        const showPoints = points !== 0;

        return (
          <li key={`${index}-${item.label}`}>
            <button
              type="button"
              disabled={disabled}
              aria-pressed={isChecked}
              onClick={() => onToggle(index, !isChecked)}
              className={[
                'group flex w-full items-center gap-3 rounded-xl border text-left transition-all duration-200',
                isDashboard ? 'px-3 py-2.5' : 'px-3 py-2',
                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer active:scale-[0.99]',
                isChecked
                  ? isDashboard
                    ? 'border-violet-400/35 bg-violet-500/12 shadow-sm shadow-violet-500/10 ring-1 ring-inset ring-violet-400/20'
                    : 'border-brand-primary/35 bg-brand-primary/8 ring-1 ring-inset ring-brand-primary/15'
                  : isDashboard
                    ? 'border-white/8 bg-black/15 hover:border-violet-400/25 hover:bg-violet-500/5'
                    : 'border-border bg-surface-3 hover:border-brand-primary/25 hover:bg-surface-3/90',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200',
                  isChecked
                    ? isDashboard
                      ? 'border-violet-400 bg-violet-500 text-white shadow-sm shadow-violet-500/30'
                      : 'border-brand-primary bg-brand-primary text-white'
                    : 'border-white/25 bg-white/[0.03] group-hover:border-violet-400/40',
                ].join(' ')}
                aria-hidden
              >
                {isChecked ? <Check size={11} strokeWidth={3} /> : null}
              </span>

              <span
                className={[
                  'min-w-0 flex-1 text-sm leading-snug transition-colors',
                  isChecked ? 'text-text-muted line-through decoration-text-muted/60' : 'text-text-primary',
                ].join(' ')}
              >
                {item.label}
              </span>

              {showPoints && (
                <span
                  className={[
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums',
                    points > 0
                      ? 'bg-emerald-500/12 text-emerald-400'
                      : points < 0
                        ? 'bg-red-500/12 text-red-400'
                        : 'bg-white/5 text-text-muted',
                  ].join(' ')}
                >
                  {formatScore(points)}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
