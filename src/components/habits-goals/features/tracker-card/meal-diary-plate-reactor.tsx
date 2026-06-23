'use client';

type MealDiaryPlateReactorProps = {
  fillPct: number;
  goalMet?: boolean;
  mealBands: { label: string; ratio: number }[];
};

export function MealDiaryPlateReactor({ fillPct, goalMet = false, mealBands }: MealDiaryPlateReactorProps) {
  const clampedFill = Math.min(100, Math.max(0, fillPct));

  return (
    <div className="relative h-full min-h-[6.25rem] w-full overflow-visible" aria-hidden>
      {goalMet && (
        <div className="pointer-events-none absolute -inset-x-2 -top-1 bottom-2 animate-[pulse_2.8s_ease-in-out_infinite] rounded-[1.5rem] bg-emerald-400/10 blur-md" />
      )}

      <div
        className={[
          'pointer-events-none absolute inset-0 overflow-hidden',
          goalMet
            ? 'border-emerald-400/55 shadow-[inset_0_0_28px_rgba(52,211,153,0.28),0_0_16px_rgba(52,211,153,0.12)]'
            : 'border-emerald-500/35 shadow-[inset_0_0_24px_rgba(0,0,0,0.55)]',
        ].join(' ')}
        style={{
          clipPath: 'polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)',
          borderRadius: '0 0 1.25rem 1.25rem',
          border: '1px solid',
          background: 'linear-gradient(165deg, rgba(6,24,16,0.96) 0%, rgba(4,14,10,0.98) 100%)',
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(52,211,153,0.12),transparent_60%)]" />

        <div className="absolute inset-x-1 bottom-0 top-2 flex flex-col-reverse gap-0.5 p-1">
          {mealBands.map((band) => (
            <div
              key={band.label}
              className="relative min-h-[0.85rem] flex-1 overflow-hidden rounded-md bg-white/[0.04]"
            >
              <div
                className={[
                  'absolute inset-y-0 left-0 transition-all duration-500',
                  goalMet
                    ? 'bg-gradient-to-r from-emerald-700 via-emerald-500 to-lime-400'
                    : 'bg-gradient-to-r from-emerald-900 via-emerald-600 to-emerald-400',
                ].join(' ')}
                style={{ width: `${Math.min(100, band.ratio * 100)}%` }}
              />
            </div>
          ))}
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 transition-[height] duration-500 ease-out opacity-35"
          style={{ height: `${clampedFill}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/80 via-emerald-600/40 to-transparent" />
        </div>

        <div className="pointer-events-none absolute inset-y-3 left-1.5 w-1 rounded-full bg-gradient-to-b from-white/20 via-white/6 to-transparent" />
      </div>
    </div>
  );
}
