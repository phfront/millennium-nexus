'use client';

import { CircularProgress, StreakBadge } from '@phfront/millennium-ui';
import { useStreak } from '@/hooks/daily-goals/use-streak';
import { formatScore, getScoreColor, pointsPercentOfMax } from '@/lib/daily-goals/scoring';

interface DailyProgressHeaderProps {
  completed: number;
  total: number;
  pointsEarned: number;
  pointsMax: number;
  /**
   * Quando true (ex.: widget na home), ocupa toda a altura do slot: coluna à direita
   * reparte espaço (texto + streak), anel maior e sem cartão interior duplicado.
   */
  fillContainer?: boolean;
}

export function DailyProgressHeader({
  completed,
  total,
  pointsEarned,
  pointsMax,
  fillContainer = false,
}: DailyProgressHeaderProps) {
  const { streak } = useStreak();
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const pointsPct = pointsPercentOfMax(pointsEarned, pointsMax);

  const titleClass = fillContainer
    ? 'text-xs font-semibold tabular-nums text-text-primary sm:text-sm'
    : 'text-sm font-semibold text-text-primary';
  const subtitleClass = fillContainer
    ? 'text-[11px] leading-snug text-text-muted sm:text-xs'
    : 'text-xs text-text-muted';
  const pointsClass = fillContainer
    ? 'text-[11px] text-text-muted tabular-nums leading-snug sm:text-xs'
    : 'text-xs text-text-muted tabular-nums leading-relaxed';
  const pointsScoreClass = fillContainer
    ? 'text-[11px] font-semibold sm:text-xs'
    : 'text-xs font-semibold';

  if (!fillContainer) {
    return (
      <div className="flex items-start gap-4 rounded-xl border border-border bg-surface-2 p-4">
        <CircularProgress value={completed} max={total || 1} size={64} className="shrink-0" />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className={titleClass}>
            {completed} de {total} meta{total !== 1 ? 's' : ''} — {percent}%
          </p>
          <p className={subtitleClass}>
            {completed === total && total > 0 ? '🎉 Dia perfeito!' : 'Continue assim!'}
          </p>

          {pointsMax > 0 ? (
            <p className={pointsClass}>
              <span className="text-text-secondary">Pontos</span>{' '}
              <span className={`${pointsScoreClass} ${getScoreColor(pointsEarned)}`}>
                {pointsEarned} de {pointsMax}
              </span>
              {pointsPct !== null && (
                <span className="text-text-secondary font-medium"> ({pointsPct}%)</span>
              )}
              <span className="text-text-muted"> · hoje</span>
            </p>
          ) : pointsEarned !== 0 ? (
            <p className={`${pointsScoreClass} tabular-nums ${getScoreColor(pointsEarned)}`}>
              {formatScore(pointsEarned)}
              <span className="text-text-muted font-normal"> · hoje</span>
            </p>
          ) : null}

          {streak > 0 && <StreakBadge count={streak} className="mt-1" />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 items-stretch gap-2.5 px-3 py-3 sm:gap-3 sm:px-4">
      <div className="flex w-[min(22%,3.75rem)] min-w-16 shrink-0 flex-col items-center justify-center">
        <CircularProgress value={completed} max={total || 1} size={64} className="shrink-0" />
      </div>

      <div
        className={[
          'flex min-h-0 min-w-0 flex-1 flex-col',
          streak > 0 ? 'justify-between' : 'justify-center',
        ].join(' ')}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <p className={titleClass}>
            {completed} de {total} meta{total !== 1 ? 's' : ''} — {percent}%
          </p>
          <p className={subtitleClass}>
            {completed === total && total > 0 ? '🎉 Dia perfeito!' : 'Continue assim!'}
          </p>

          {pointsMax > 0 ? (
            <p className={pointsClass}>
              <span className="text-text-secondary">Pontos</span>{' '}
              <span className={`${pointsScoreClass} ${getScoreColor(pointsEarned)}`}>
                {pointsEarned} de {pointsMax}
              </span>
              <span className="whitespace-nowrap">
                {pointsPct !== null && (
                  <span className="text-text-secondary font-medium"> ({pointsPct}%)</span>
                )}
                <span className="text-text-muted"> · hoje</span>
              </span>
            </p>
          ) : pointsEarned !== 0 ? (
            <p className={`${pointsScoreClass} tabular-nums ${getScoreColor(pointsEarned)}`}>
              {formatScore(pointsEarned)}
              <span className="whitespace-nowrap text-text-muted font-normal"> · hoje</span>
            </p>
          ) : null}
        </div>

        {streak > 0 ? (
          <div className="shrink-0 border-t border-border/50 pt-3">
            <StreakBadge count={streak} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
