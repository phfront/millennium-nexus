'use client';

import { Droplets } from 'lucide-react';
import { Skeleton, useToast } from '@phfront/millennium-ui';
import { useWaterTracker } from '@/hooks/health/use-water-tracker';
import { formatMl } from '@/lib/health/nutrition';
import { HydrationMorphingWaves } from './hydration-morphing-waves';
import { WidgetSectionHeader } from '@/components/widgets/WidgetSectionHeader';

const QUICK_ADD_OPTIONS = [100, 500, 1000] as const;

interface WaterTrackerProps {
  targetMl?: number;
  /** Classes Tailwind opcionais para altura mínima do card (só onde o layout não é a grelha da home). */
  cardMinHeightClass?: string;
  hasBackground?: boolean;
}

export function WaterTracker({ targetMl = 2500, cardMinHeightClass, hasBackground = true }: WaterTrackerProps) {
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
    return <Skeleton variant="block" className="h-full min-h-0 w-full" />;
  }

  const fillPct = Math.min(100, Math.max(0, progress));
  const lastMl = logs.length > 0 ? logs[logs.length - 1].amount_ml : 0;

  return (
    <div
      className={[
        'relative flex h-full min-h-0 flex-col overflow-hidden',
        cardMinHeightClass ?? '',
        hasBackground ? 'rounded-2xl border border-white/10 bg-surface-2/25 shadow-sm backdrop-blur-md' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out"
        style={{ height: `${fillPct}%` }}
        aria-hidden
      >
        {/* Com meta incompleta: reforço só na base + máscara para fundir com a crista do SVG. A 100%: preenchimento até ao topo (sem máscara). */}
        <div
          className={
            fillPct >= 100
              ? 'absolute inset-0 bg-linear-to-b from-sky-400/18 via-sky-600/14 to-sky-600/22'
              : 'absolute inset-0 bg-linear-to-t from-sky-950/28 via-transparent to-transparent'
          }
          style={
            fillPct >= 100
              ? undefined
              : {
                  maskImage: 'linear-gradient(to top, black 0%, black 42%, transparent 78%)',
                  WebkitMaskImage: 'linear-gradient(to top, black 0%, black 42%, transparent 78%)',
                }
          }
        />
        {fillPct > 0 && (
          <div className="absolute inset-0 overflow-hidden">
            {/* scale-y < 1 + origin-bottom: menos amplitude visual; o gradiente por baixo tapa o espaço acima. */}
            <div className="pointer-events-none h-full w-full origin-bottom scale-y-[0.78] transform-gpu">
              <HydrationMorphingWaves />
            </div>
          </div>
        )}
      </div>

      {/* A 100% não há véu (evita faixa escura no topo e no fundo). Com meta incompleta, só suaviza o topo para contraste. */}
      {fillPct < 100 ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-b from-surface-2/55 via-transparent to-transparent"
          aria-hidden
        />
      ) : null}

      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-2 p-3">
        <WidgetSectionHeader
          variant="sky"
          icon={<Droplets className="h-3.5 w-3.5" aria-hidden />}
          title="Hidratação"
          subtitle="Registe a quantidade de água."
          trailing={
            <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-medium tabular-nums text-sky-100/90 ring-1 ring-white/10 sm:text-[11px]">
              {progress}%
            </span>
          }
        />

        <div className="shrink-0 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
            <span className="text-lg font-semibold tabular-nums leading-none text-text-primary sm:text-xl">
              {formatMl(totalMl)}
            </span>
            <span className="text-[11px] text-text-muted sm:text-xs">/ {formatMl(targetMl)}</span>
          </div>
          <div
            className="h-1 overflow-hidden rounded-full bg-black/35 ring-1 ring-inset ring-white/10"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da meta de água"
          >
            <div
              className="h-full rounded-full bg-linear-to-r from-sky-600 to-sky-300 transition-[width] duration-500 ease-out"
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
          {QUICK_ADD_OPTIONS.map((ml) => (
            <button
              key={ml}
              type="button"
              onClick={() => void handleAdd(ml)}
              className={[
                'flex min-h-0 min-w-0 cursor-pointer flex-col items-center justify-center rounded-xl py-1',
                'border border-white/12 bg-white/6 text-center',
                'text-xs font-semibold tabular-nums leading-none text-text-primary sm:text-sm',
                'transition hover:border-sky-400/35 hover:bg-sky-500/15 hover:text-sky-50',
                'active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-400/70',
              ].join(' ')}
            >
              {`${ml}ml`}
            </button>
          ))}
          <button
            type="button"
            disabled={logs.length === 0}
            onClick={() => void handleRemoveLast()}
            aria-label={
              logs.length > 0
                ? `Desfazer último registo (${lastMl} ml)`
                : 'Desfazer último registo (indisponível sem histórico)'
            }
            className={[
              'flex min-h-0 min-w-0 cursor-pointer flex-col items-center justify-center rounded-xl py-1',
              'border border-white/12 bg-white/6 text-center',
              'text-xs font-semibold leading-none text-text-primary sm:text-sm',
              'transition hover:border-amber-400/35 hover:bg-amber-500/12 hover:text-amber-50',
              'active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-400/60',
              'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/12 disabled:hover:bg-white/6 disabled:hover:text-text-primary',
            ].join(' ')}
          >
            Desfazer
          </button>
        </div>
      </div>
    </div>
  );
}
