'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const ICON_VARIANT_CLASS = {
  sky: 'bg-sky-500/20 text-sky-300',
  amber: 'bg-amber-500/15 text-amber-300',
  orange: 'bg-orange-500/15 text-orange-300',
  primary: 'bg-brand-primary/15 text-brand-primary',
  secondary: 'bg-brand-secondary/15 text-brand-secondary',
  emerald: 'bg-emerald-500/15 text-emerald-300',
  violet: 'bg-violet-500/15 text-violet-300',
  rose: 'bg-rose-500/15 text-rose-300',
} as const;

export type WidgetSectionHeaderIconVariant = keyof typeof ICON_VARIANT_CLASS;

const ICON_BOX =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-white/10';

const TITLE_CLASS =
  'truncate text-xs font-semibold tracking-tight text-text-primary sm:text-sm';
const SUBTITLE_CLASS =
  'mt-0.5 text-[11px] leading-snug text-text-muted sm:text-xs';

export type WidgetSectionHeaderProps = {
  variant?: WidgetSectionHeaderIconVariant;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  className?: string;
};

/**
 * Cabeçalho comum dos widgets da home (ícone em cápsula + título + subtítulo opcional).
 * Mesmo padrão visual que Hidratação e Refeições do dia.
 */
export function WidgetSectionHeader({
  variant = 'sky',
  icon,
  title,
  subtitle,
  trailing,
  className,
}: WidgetSectionHeaderProps) {
  const v = ICON_VARIANT_CLASS[variant];

  if (subtitle) {
    return (
      <header className={cn('flex shrink-0 items-start gap-2', className)}>
        <span className={cn(ICON_BOX, v)} aria-hidden>
          {icon}
        </span>
        <div className="flex min-h-0 min-w-0 flex-1 items-start justify-between gap-2">
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className={TITLE_CLASS}>{title}</h2>
            <p className={SUBTITLE_CLASS}>{subtitle}</p>
          </div>
          {trailing ? <div className="shrink-0 pt-0.5">{trailing}</div> : null}
        </div>
      </header>
    );
  }

  return (
    <header className={cn('flex shrink-0 items-center justify-between gap-2', className)}>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className={cn(ICON_BOX, v)} aria-hidden>
          {icon}
        </span>
        <h2 className={TITLE_CLASS}>{title}</h2>
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </header>
  );
}
