'use client';

import { useEffect, useRef } from 'react';
import { HydrationMorphingWaves } from '@/components/health/features/water-tracker/hydration-morphing-waves';

type HydrationSpringReactorProps = {
  fillPct: number;
  goalMet?: boolean;
};

type Ripple = {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
};

type Shimmer = {
  x: number;
  y: number;
  len: number;
  angle: number;
  drift: number;
  alpha: number;
  life: number;
};

type Spark = {
  x: number;
  y: number;
  r: number;
  life: number;
  maxLife: number;
};

const WAVE_MAX_FILL = 88;
const MAX_RIPPLES = 8;
const MAX_SHIMMERS = 16;
const MAX_SPARKS = 12;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clipFlask(ctx: CanvasRenderingContext2D, width: number, flaskHeight: number) {
  const cx = width * 0.5;
  const neckW = width * 0.34;
  const bellyW = width * 0.88;
  const neckY = flaskHeight * 0.08;
  const bellyY = flaskHeight * 0.55;
  const bottomY = flaskHeight;
  const r = width * 0.12;

  ctx.beginPath();
  ctx.moveTo(cx - neckW * 0.5, 0);
  ctx.lineTo(cx + neckW * 0.5, 0);
  ctx.quadraticCurveTo(cx + neckW * 0.55, neckY, cx + bellyW * 0.5, bellyY);
  ctx.quadraticCurveTo(cx + bellyW * 0.52, bottomY - r, cx, bottomY);
  ctx.quadraticCurveTo(cx - bellyW * 0.52, bottomY - r, cx - bellyW * 0.5, bellyY);
  ctx.quadraticCurveTo(cx - neckW * 0.55, neckY, cx - neckW * 0.5, 0);
  ctx.closePath();
  ctx.clip();
}

export function HydrationSpringReactor({ fillPct, goalMet = false }: HydrationSpringReactorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const shimmersRef = useRef<Shimmer[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const goalMetRef = useRef(goalMet);
  const fillRef = useRef(fillPct);
  const rafRef = useRef<number | null>(null);
  const visibleRef = useRef(true);
  const prevGoalMetRef = useRef(goalMet);

  fillRef.current = fillPct;
  goalMetRef.current = goalMet;

  const clampedFill = Math.min(100, Math.max(0, fillPct));
  const showSurfaceWaves = clampedFill > 4 && clampedFill < WAVE_MAX_FILL;
  const nearTop = clampedFill >= WAVE_MAX_FILL;
  const showGoalSurface = goalMet && nearTop;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let time = 0;
    let running = true;
    let rippleCooldown = 0;
    let shimmerCooldown = 0;
    let sparkCooldown = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const syncLayout = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    syncLayout();
    const observer = new ResizeObserver(syncLayout);
    observer.observe(container);

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry?.isIntersecting ?? true;
      },
      { threshold: 0.05 },
    );
    visibilityObserver.observe(container);

    const waterTop = () => height * (1 - Math.min(100, fillRef.current) / 100);

    const spawnRipple = (y: number, strong = false) => {
      if (ripplesRef.current.length >= MAX_RIPPLES) return;
      ripplesRef.current.push({
        x: width * 0.5 + rand(-width * (strong ? 0.28 : 0.2), width * (strong ? 0.28 : 0.2)),
        y: y + rand(-1, 2),
        r: rand(2, strong ? 8 : 5),
        maxR: rand(width * (strong ? 0.22 : 0.16), width * (strong ? 0.42 : 0.32)),
        alpha: rand(0.35, strong ? 0.75 : 0.55),
      });
    };

    const spawnShimmer = (top: number, bottom: number) => {
      if (shimmersRef.current.length >= MAX_SHIMMERS) return;
      shimmersRef.current.push({
        x: rand(width * 0.12, width * 0.88),
        y: rand(top + 6, bottom - 8),
        len: rand(width * 0.1, width * 0.26),
        angle: rand(-0.4, 0.4),
        drift: rand(0.012, 0.035),
        alpha: rand(0.18, 0.45),
        life: rand(0.55, 1),
      });
    };

    const spawnSpark = (top: number) => {
      if (sparksRef.current.length >= MAX_SPARKS) return;
      sparksRef.current.push({
        x: width * 0.5 + rand(-width * 0.3, width * 0.3),
        y: top + rand(-2, 4),
        r: rand(0.6, 1.6),
        life: rand(0.35, 0.9),
        maxLife: 1,
      });
    };

    const burstGoal = () => {
      const top = waterTop();
      for (let i = 0; i < 5; i += 1) spawnRipple(top, true);
      for (let i = 0; i < 6; i += 1) spawnSpark(top);
    };

    const tick = () => {
      if (!running) return;
      if (!visibleRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      time += 16;
      const hydrated = goalMetRef.current;
      const currentFill = fillRef.current;

      if (hydrated && !prevGoalMetRef.current) {
        burstGoal();
      }
      prevGoalMetRef.current = hydrated;

      ctx.clearRect(0, 0, width, height);

      if (!reducedMotion && hydrated && currentFill >= WAVE_MAX_FILL) {
        const top = waterTop();
        const bottom = height;

        rippleCooldown -= 16;
        shimmerCooldown -= 16;
        sparkCooldown -= 16;

        if (rippleCooldown <= 0) {
          spawnRipple(top);
          if (Math.random() < 0.45) spawnRipple(top);
          rippleCooldown = 520;
        }
        if (shimmerCooldown <= 0) {
          spawnShimmer(top, bottom);
          shimmerCooldown = 260;
        }
        if (sparkCooldown <= 0) {
          spawnSpark(top);
          sparkCooldown = 380;
        }

        ctx.save();
        clipFlask(ctx, width, height);

        for (let i = ripplesRef.current.length - 1; i >= 0; i -= 1) {
          const ripple = ripplesRef.current[i];
          ripple.r += 0.42;
          ripple.alpha *= 0.982;
          if (ripple.alpha < 0.02 || ripple.r > ripple.maxR) {
            ripplesRef.current.splice(i, 1);
            continue;
          }
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, ripple.r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(186, 245, 255, ${ripple.alpha * 0.65})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        for (let i = shimmersRef.current.length - 1; i >= 0; i -= 1) {
          const s = shimmersRef.current[i];
          s.life -= 0.007;
          s.x += Math.cos(s.angle) * s.drift * 18;
          s.y += Math.sin(s.angle) * s.drift * 6 + 0.04;
          if (s.life <= 0 || s.y < top || s.y > bottom) {
            shimmersRef.current.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(s.angle);
          const grad = ctx.createLinearGradient(-s.len * 0.5, 0, s.len * 0.5, 0);
          grad.addColorStop(0, 'rgba(255,255,255,0)');
          grad.addColorStop(0.5, `rgba(210, 250, 255, ${s.alpha * s.life})`);
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(-s.len * 0.5, 0);
          ctx.lineTo(s.len * 0.5, 0);
          ctx.stroke();
          ctx.restore();
        }

        const pulse = 0.12 + Math.sin(time * 0.0045) * 0.05;
        const caustic = ctx.createLinearGradient(0, top, width, bottom);
        caustic.addColorStop(0, `rgba(150, 235, 255, ${pulse})`);
        caustic.addColorStop(0.4, `rgba(90, 200, 255, ${pulse * 0.5})`);
        caustic.addColorStop(1, 'rgba(40, 120, 200, 0)');
        ctx.fillStyle = caustic;
        ctx.fillRect(0, top, width, bottom - top);

        ctx.restore();

        for (let i = sparksRef.current.length - 1; i >= 0; i -= 1) {
          const spark = sparksRef.current[i];
          spark.life -= 0.018;
          if (spark.life <= 0) {
            sparksRef.current.splice(i, 1);
            continue;
          }
          const ratio = spark.life / spark.maxLife;
          ctx.beginPath();
          ctx.arc(spark.x, spark.y, spark.r * ratio, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220, 250, 255, ${ratio * 0.75})`;
          ctx.fill();
        }

        const glowAlpha = 0.14 + Math.sin(time * 0.005) * 0.06;
        const glow = ctx.createRadialGradient(width * 0.5, top, 0, width * 0.5, top, width * 0.55);
        glow.addColorStop(0, `rgba(180, 240, 255, ${glowAlpha})`);
        glow.addColorStop(0.55, `rgba(56, 189, 248, ${glowAlpha * 0.35})`);
        glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
      } else {
        ripplesRef.current = [];
        shimmersRef.current = [];
        sparksRef.current = [];
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      observer.disconnect();
      visibilityObserver.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      ripplesRef.current = [];
      shimmersRef.current = [];
      sparksRef.current = [];
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={[
        'relative h-full min-h-[6.25rem] w-full',
        goalMet ? '-mt-2 overflow-visible pt-2' : 'overflow-visible',
      ].join(' ')}
      aria-hidden
    >
      {goalMet && (
        <div
          className="pointer-events-none absolute -inset-x-2 -top-1 bottom-2 animate-[pulse_2.8s_ease-in-out_infinite] rounded-[1.5rem] bg-cyan-400/10 blur-md"
          aria-hidden
        />
      )}

      <div
        className={[
          'pointer-events-none absolute inset-0 overflow-hidden',
          goalMet
            ? 'border-cyan-300/60 shadow-[inset_0_0_32px_rgba(56,189,248,0.35),0_0_22px_rgba(56,189,248,0.2)]'
            : 'border-sky-400/35 shadow-[inset_0_0_24px_rgba(0,0,0,0.55)]',
        ].join(' ')}
        style={{
          clipPath: 'polygon(33% 0%, 67% 0%, 88% 45%, 94% 100%, 6% 100%, 12% 45%)',
          borderRadius: '0 0 1.25rem 1.25rem',
          border: '1px solid',
          background: 'linear-gradient(165deg, rgba(8,28,48,0.95) 0%, rgba(4,16,32,0.98) 100%)',
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(56,189,248,0.14),transparent_60%)]" />

        {clampedFill > 0 && (
          <div
            className="absolute inset-x-0 bottom-0 transition-[height] duration-500 ease-out"
            style={{ height: `${clampedFill}%` }}
          >
            <div
              className={[
                'absolute inset-0 transition-all duration-700',
                goalMet || nearTop
                  ? 'bg-gradient-to-t from-sky-900 via-sky-500/90 to-cyan-300/60'
                  : 'bg-gradient-to-t from-sky-950/95 via-sky-700/70 to-sky-500/35',
              ].join(' ')}
            />

            {showSurfaceWaves && (
              <div className="absolute inset-x-0 top-0 h-[38%] min-h-[1.35rem] max-h-[2.75rem] overflow-hidden">
                <div className="h-full w-full [mask-image:linear-gradient(to_bottom,black_55%,transparent_100%)]">
                  <HydrationMorphingWaves />
                </div>
              </div>
            )}

            {showGoalSurface && (
              <div className="absolute inset-x-0 top-0 h-[42%] min-h-[1.5rem] max-h-[3rem] overflow-hidden opacity-90">
                <div className="h-full w-full origin-bottom scale-y-[1.1] [mask-image:linear-gradient(to_bottom,black_50%,transparent_100%)]">
                  <HydrationMorphingWaves />
                </div>
              </div>
            )}

            {nearTop && (
              <>
                <div
                  className={[
                    'absolute inset-x-0 top-0 h-full',
                    goalMet
                      ? 'animate-[pulse_3s_ease-in-out_infinite] bg-gradient-to-b from-cyan-300/35 via-sky-400/18 to-transparent'
                      : 'bg-gradient-to-b from-sky-400/30 via-sky-500/15 to-transparent',
                  ].join(' ')}
                />
                <div
                  className={[
                    'absolute inset-x-[14%] top-0 h-[4px] rounded-full',
                    goalMet
                      ? 'animate-[pulse_2.2s_ease-in-out_infinite] bg-cyan-100/70 blur-[1.5px]'
                      : 'bg-sky-300/40 blur-[1px]',
                  ].join(' ')}
                />
              </>
            )}

            {goalMet && (
              <>
                <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-white/20 to-transparent" />
                <div className="absolute inset-x-[20%] top-1 h-1 rounded-full bg-white/30 blur-[2px]" />
              </>
            )}
          </div>
        )}

        <div className="pointer-events-none absolute inset-y-3 left-1.5 w-1 rounded-full bg-gradient-to-b from-white/25 via-white/8 to-transparent" />
        <div className="pointer-events-none absolute inset-y-6 right-2 w-0.5 rounded-full bg-white/10" />
      </div>

      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[2] h-full w-full" />
    </div>
  );
}
