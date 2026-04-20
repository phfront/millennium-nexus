'use client';

import { Zap } from 'lucide-react';
import { formatKcal } from '@/lib/health/nutrition';

interface WeeklyBufferBadgeProps {
  used: number;
  total: number;
}

export function WeeklyBufferBadge({ used, total }: WeeklyBufferBadgeProps) {
  if (total <= 0) return null;

  const remaining = Math.max(0, total - used);
  const percent = total > 0 ? Math.round((used / total) * 100) : 0;
  const isOver = used > total;

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        isOver
          ? 'bg-red-500/15 text-red-400'
          : percent > 70
            ? 'bg-amber-500/15 text-amber-400'
            : 'bg-surface-3 text-text-secondary'
      }`}
    >
      <Zap size={12} />
      <span className="tabular-nums">
        {formatKcal(remaining)} / {formatKcal(total)} kcal
      </span>
      <span className="text-[10px] opacity-70">buffer</span>
    </div>
  );
}
