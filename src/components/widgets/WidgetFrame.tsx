'use client';

import Link from 'next/link';
import { Card } from '@phfront/millennium-ui';
import { ExternalLink } from 'lucide-react';

type WidgetFrameProps = {
  children: React.ReactNode;
  className?: string;
  /** Sem título, subtítulo nem “Abrir” — só o conteúdo (ex.: carrossel). */
  contentOnly?: boolean;
  title?: string;
  subtitle?: string;
  href?: string;
  /** Útil quando `contentOnly` (sem cabeçalho visível). */
  'aria-label'?: string;
};

export function WidgetFrame({
  title,
  subtitle,
  href,
  children,
  className,
  contentOnly = false,
  'aria-label': ariaLabel,
}: WidgetFrameProps) {
  const shellClass = [
    'flex h-full min-h-0 flex-col overflow-hidden',
    contentOnly ? 'p-3' : 'p-4',
    className ?? '',
  ].join(' ');
  const bodyClass = [
    'min-h-0 flex-1',
    contentOnly ? 'flex min-h-0 flex-col overflow-hidden' : 'overflow-auto pr-1',
  ].join(' ');

  /** `contentOnly`: só layout + padding — o `Card` da grelha (`WidgetGrid`) já traz a borda. */
  if (contentOnly) {
    return (
      <div aria-label={ariaLabel} className={shellClass}>
        <div className={bodyClass}>{children}</div>
      </div>
    );
  }

  return (
    <Card className={shellClass}>
      {title ? (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-text-primary">{title}</h3>
            {subtitle ? <p className="mt-1 text-xs text-text-muted">{subtitle}</p> : null}
          </div>
          {href ? (
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-primary"
            >
              Abrir
              <ExternalLink size={12} />
            </Link>
          ) : null}
        </div>
      ) : null}
      <div className={bodyClass}>{children}</div>
    </Card>
  );
}
