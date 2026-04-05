'use client';

import { CircularProgress, StreakBadge } from '@phfront/millennium-ui';
import { useStreak } from '@/hooks/daily-goals/use-streak';
import { formatScore, getScoreColor, pointsPercentOfMax } from '@/lib/daily-goals/scoring';

interface DailyProgressHeaderProps {
  completed: number;
  total: number;
  pointsEarned: number;
  pointsMax: number;
}

export function DailyProgressHeader({ completed, total, pointsEarned, pointsMax }: DailyProgressHeaderProps) {
  const { streak } = useStreak();
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const pointsPct = pointsPercentOfMax(pointsEarned, pointsMax);

  return (
    <div className="flex items-start gap-4 p-4 bg-surface-2 rounded-xl border border-border">
      <CircularProgress value={completed} max={total || 1} size={64} className="shrink-0" />

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-sm font-semibold text-text-primary">
          {completed} de {total} meta{total !== 1 ? 's' : ''} — {percent}%
        </p>
        <p className="text-xs text-text-muted">
          {completed === total && total > 0 ? '🎉 Dia perfeito!' : 'Continue assim!'}
        </p>

        {pointsMax > 0 ? (
          <p className="text-xs text-text-muted tabular-nums leading-relaxed">
            <span className="text-text-secondary">Pontos</span>{' '}
            <span className={`font-semibold ${getScoreColor(pointsEarned)}`}>
              {pointsEarned} de {pointsMax}
            </span>
            {pointsPct !== null && (
              <span className="text-text-secondary font-medium"> ({pointsPct}%)</span>
            )}
            <span className="text-text-muted"> · hoje</span>
          </p>
        ) : pointsEarned !== 0 ? (
          <p className={`text-xs font-semibold tabular-nums ${getScoreColor(pointsEarned)}`}>
            {formatScore(pointsEarned)}
            <span className="text-text-muted font-normal"> · hoje</span>
          </p>
        ) : null}

        {streak > 0 && <StreakBadge count={streak} className="mt-1" />}
      </div>
    </div>
  );
}
