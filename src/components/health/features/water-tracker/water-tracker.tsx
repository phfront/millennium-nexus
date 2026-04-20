'use client';

import { Droplets, Plus, Minus } from 'lucide-react';
import { Button, Skeleton, useToast } from '@phfront/millennium-ui';
import { useWaterTracker } from '@/hooks/health/use-water-tracker';
import { formatMl } from '@/lib/health/nutrition';

const QUICK_ADD_OPTIONS = [200, 300, 500];

interface WaterTrackerProps {
  targetMl?: number;
}

export function WaterTracker({ targetMl = 2500 }: WaterTrackerProps) {
  const { totalMl, progress, isLoading, addWater, removeWater, logs } =
    useWaterTracker(targetMl);
  const { toast } = useToast();

  async function handleAdd(ml: number) {
    try {
      await addWater(ml);
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao registrar água');
    }
  }

  async function handleRemoveLast() {
    if (logs.length === 0) return;
    const last = logs[logs.length - 1];
    try {
      await removeWater(last.id);
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao remover');
    }
  }

  if (isLoading) {
    return <Skeleton variant="block" className="h-44 w-full" />;
  }

  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;

  return (
    <div className="p-5 bg-surface-2 rounded-xl border border-border">
      <div className="flex items-center gap-2 mb-4">
        <Droplets size={18} className="text-blue-400" />
        <h3 className="text-sm font-semibold text-text-primary">Hidratação</h3>
      </div>

      <div className="flex items-center justify-between gap-6">
        {/* Circular progress */}
        <div className="relative flex-shrink-0">
          <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-surface-3"
            />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="text-blue-400 transition-all duration-500 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold tabular-nums text-text-primary">
              {progress}%
            </span>
            <span className="text-[10px] text-text-muted">
              {formatMl(totalMl)}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 flex-1">
          <p className="text-xs text-text-muted">
            Meta: <span className="font-medium text-text-secondary">{formatMl(targetMl)}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_ADD_OPTIONS.map((ml) => (
              <Button
                key={ml}
                variant="outline"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => handleAdd(ml)}
              >
                {ml}ml
              </Button>
            ))}
          </div>
          {logs.length > 0 && (
            <button
              onClick={handleRemoveLast}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-red-400 transition-colors self-start cursor-pointer"
            >
              <Minus size={12} />
              Desfazer último ({logs[logs.length - 1].amount_ml}ml)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
