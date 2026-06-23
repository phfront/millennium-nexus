'use client';

import { useEffect, useRef } from 'react';

type CaloriesFireReactorProps = {
  fillPct: number;
  goalMet?: boolean;
};

type ParticleKind = 'core' | 'flame' | 'ember' | 'spark';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: ParticleKind;
  spin: number;
  wobble: number;
};

const MAX_PARTICLES = 280;
const MAX_PARTICLES_SURGE = 540;
const OVERFLOW_TOP_IDLE = 22;
const OVERFLOW_TOP_SURGE = 68;
const OVERFLOW_SIDE_IDLE = 10;
const OVERFLOW_SIDE_SURGE = 22;
const TANK_RADIUS = 24;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function tankRadius(width: number) {
  return Math.min(width / 2, TANK_RADIUS);
}

function clipTank(
  ctx: CanvasRenderingContext2D,
  tankWidth: number,
  tankHeight: number,
  topInset: number,
  sideInset: number,
) {
  const r = tankRadius(tankWidth);
  const x = sideInset;
  const y = topInset;
  const w = tankWidth;
  const h = tankHeight;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.clip();
}

function surfaceWaveY(x: number, surfaceY: number, time: number, surged: boolean) {
  const amp = surged ? 4.4 : 2.2;
  return (
    surfaceY +
    Math.sin(x * 0.11 + time * 0.003) * amp +
    Math.cos(x * 0.055 - time * 0.0025) * (amp * 0.55)
  );
}

function particleEdgeFade(
  x: number,
  y: number,
  tankWidth: number,
  sideInset: number,
  surfaceY: number,
  topInset: number,
  tankHeight: number,
  surged: boolean,
) {
  const tankLeft = sideInset;
  const tankRight = sideInset + tankWidth;
  const centerX = sideInset + tankWidth * 0.5;
  const halfW = tankWidth * 0.5;
  const relX = x - centerX;

  const overflowZone = surged ? OVERFLOW_TOP_SURGE : OVERFLOW_TOP_IDLE;
  const above = surfaceY - y;

  let horizontal = 1;
  if (above > 0) {
    const topBlend = Math.min(1, above / (overflowZone * 0.6));
    const distFromLeft = x - tankLeft;
    const distFromRight = tankRight - x;
    const nearestEdge = Math.min(distFromLeft, distFromRight);
    const outside = nearestEdge < 0 ? Math.min(sideInset, -nearestEdge) / sideInset : 0;

    if (nearestEdge < tankWidth * (surged ? 0.3 : 0.22)) {
      horizontal = 0.48 + topBlend * 0.52;
      if (outside > 0) {
        horizontal *= 1 - Math.pow(outside, 1.15);
      }
    } else {
      horizontal = 1 - Math.pow(Math.max(0, Math.abs(relX) / halfW - 0.26) / 0.74, 1.35);
    }
  } else {
    if (x < tankLeft - 1 || x > tankRight + 1) return 0;
    horizontal = 1 - Math.pow(Math.max(0, Math.abs(relX) / halfW - 0.42) / 0.58, 1.6);
  }

  let vertical = 1;
  if (above > 0) {
    vertical = 1 - Math.pow(Math.min(1, above / (overflowZone + tankHeight * (surged ? 0.28 : 0.18))), surged ? 1.15 : 1.35);
  }

  const bottom = topInset + tankHeight;
  if (y > bottom - 4) {
    vertical *= 1 - Math.min(1, (y - (bottom - 4)) / 8);
  }

  return Math.max(0, horizontal * vertical);
}

function spawnSideVent(
  tankWidth: number,
  sideInset: number,
  surfaceY: number,
  side: 'left' | 'right',
  surged: boolean,
): Particle {
  const rimInset = tankWidth * (surged ? 0.05 : 0.09);
  const x = side === 'left' ? sideInset + rimInset : sideInset + tankWidth - rimInset;
  const outward = side === 'left' ? -1 : 1;
  const speedMul = surged ? 1.65 : 1;
  const sizeMul = surged ? 1.55 : 1.12;
  const kind: ParticleKind = Math.random() < 0.55 ? 'flame' : 'core';

  return {
    x: x + rand(-2, 2),
    y: surfaceY + rand(-6, 2),
    vx: outward * rand(0.45, 1.5) * speedMul * (surged ? 1.35 : 1),
    vy: rand(-2.8, -0.9) * speedMul,
    life: rand(0.48, 0.95),
    maxLife: 1,
    size: rand(tankWidth * 0.08, tankWidth * 0.17) * sizeMul,
    kind,
    spin: rand(0, Math.PI * 2),
    wobble: rand(0.8, 1.7),
  };
}

function spawnParticle(
  tankWidth: number,
  sideInset: number,
  surfaceY: number,
  tankHeight: number,
  fillPct: number,
  kind: ParticleKind,
  surged: boolean,
): Particle {
  const spread = tankWidth * (surged ? 0.08 : 0.14);
  const x =
    sideInset +
    tankWidth * 0.5 +
    (Math.random() - 0.5) * (tankWidth - spread) +
    rand(-spread * 0.25, spread * 0.25);
  const depth = Math.min(100, fillPct) / 100;
  const sizeMul = surged ? 1.7 : 1;
  const speedMul = surged ? 1.65 : 1;

  if (kind === 'core') {
    return {
      x,
      y: surfaceY + rand(surged ? -10 : -6, surged ? 6 : 4),
      vx: rand(-0.35, 0.35) * (surged ? 1.55 : 1),
      vy: rand(-2.8, -1.1) * speedMul,
      life: rand(surged ? 0.65 : 0.55, 1),
      maxLife: 1,
      size: rand(tankWidth * (surged ? 0.16 : 0.12), tankWidth * (surged ? 0.3 : 0.22)) * sizeMul,
      kind,
      spin: rand(0, Math.PI * 2),
      wobble: rand(0.6, 1.4),
    };
  }

  if (kind === 'flame') {
    return {
      x,
      y: surfaceY + rand(surged ? -8 : -4, surged ? 8 : 6),
      vx: rand(-0.65, 0.65) * (surged ? 1.5 : 1),
      vy: rand(-3.2, -1) * speedMul,
      life: rand(0.45, 1),
      maxLife: 1,
      size: rand(tankWidth * (surged ? 0.1 : 0.07), tankWidth * (surged ? 0.2 : 0.14)) * sizeMul,
      kind,
      spin: rand(0, Math.PI * 2),
      wobble: rand(0.8, 1.8),
    };
  }

  if (kind === 'ember') {
    return {
      x: sideInset + tankWidth * 0.5 + (Math.random() - 0.5) * tankWidth * 0.7,
      y: surfaceY + rand(0, tankHeight * depth * 0.4),
      vx: rand(-0.5, 0.5) * (surged ? 1.35 : 1),
      vy: rand(-1.4, -0.3) * speedMul,
      life: rand(0.35, 1),
      maxLife: 1,
      size: rand(1, 2.8) * (surged ? 1.2 : 1),
      kind,
      spin: rand(0, Math.PI * 2),
      wobble: rand(1, 2.2),
    };
  }

  return {
    x: sideInset + tankWidth * 0.5 + (Math.random() - 0.5) * tankWidth * 0.85,
    y: surfaceY + rand(-3, 3),
    vx: rand(-1, 1) * (surged ? 1.45 : 1),
    vy: rand(-4, -2) * speedMul,
    life: rand(surged ? 0.28 : 0.2, surged ? 0.72 : 0.55),
    maxLife: 1,
    size: rand(surged ? 0.8 : 0.5, surged ? 1.8 : 1.2) * (surged ? 1.4 : 1),
    kind,
    spin: rand(0, Math.PI * 2),
    wobble: rand(1.5, 2.5),
  };
}

function drawParticle(
  ctx: CanvasRenderingContext2D,
  particle: Particle,
  time: number,
  surged: boolean,
  tankWidth: number,
  sideInset: number,
  surfaceY: number,
  topInset: number,
  tankHeight: number,
) {
  const lifeRatio = particle.life / particle.maxLife;
  const flicker = 0.88 + Math.sin(time * 0.02 + particle.spin * 4) * (surged ? 0.2 : 0.1);
  let alpha =
    lifeRatio *
    flicker *
    particleEdgeFade(particle.x, particle.y, tankWidth, sideInset, surfaceY, topInset, tankHeight, surged);
  if (surged && (particle.kind === 'core' || particle.kind === 'flame')) {
    alpha = Math.min(1, alpha * 1.18);
  }

  if (alpha <= 0.02) return;

  let r: number;
  let g: number;
  let b: number;
  let hotR: number;
  let hotG: number;
  let hotB: number;

  if (particle.kind === 'spark') {
    r = 255;
    g = 245;
    b = 180;
    hotR = 255;
    hotG = 255;
    hotB = 220;
  } else if (particle.kind === 'ember') {
    r = 255;
    g = 120 + lifeRatio * 80;
    b = 30;
    hotR = 255;
    hotG = 200;
    hotB = 80;
  } else {
    r = 255;
    g = 90 + lifeRatio * 120;
    b = 10 + lifeRatio * 30;
    hotR = 255;
    hotG = surged ? 255 : 240;
    hotB = surged ? 180 : 120;
  }

  const x =
    particle.x + Math.sin(time * 0.004 * particle.wobble + particle.spin) * (particle.size * 0.08);
  const y = particle.y;
  const radius = particle.size * (0.55 + lifeRatio * (surged ? 0.75 : 0.6));

  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${hotR},${hotG},${hotB},${Math.min(1, alpha * 0.9)})`);
  gradient.addColorStop(0.18, `rgba(${r},${g},${b},${alpha * 0.65})`);
  gradient.addColorStop(0.45, `rgba(${Math.floor(r * 0.85)},${Math.floor(g * 0.45)},0,${alpha * 0.22})`);
  gradient.addColorStop(0.72, `rgba(255,80,0,${alpha * 0.06})`);
  gradient.addColorStop(1, 'rgba(120,20,0,0)');

  ctx.fillStyle = gradient;

  if (particle.kind === 'core' || particle.kind === 'flame') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(particle.spin + Math.sin(time * 0.003 + particle.wobble) * 0.22);
    ctx.scale(1, (surged ? 1.58 : 1.28) + Math.sin(time * 0.005 + particle.wobble) * 0.12);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLiquidBase(
  ctx: CanvasRenderingContext2D,
  tankWidth: number,
  sideInset: number,
  tankHeight: number,
  topInset: number,
  fillPct: number,
  time: number,
  surged: boolean,
) {
  const clampedFill = Math.min(100, fillPct);
  const surfaceY = topInset + tankHeight * (1 - clampedFill / 100);
  const bottom = topInset + tankHeight;
  if (clampedFill <= 0) return;

  const liquidGradient = ctx.createLinearGradient(0, bottom, 0, surfaceY - 6);
  liquidGradient.addColorStop(0, surged ? '#991b1b' : '#7f1d1d');
  liquidGradient.addColorStop(0.35, surged ? '#f97316' : '#ea580c');
  liquidGradient.addColorStop(0.72, surged ? '#fdba74' : '#fb923c');
  liquidGradient.addColorStop(1, surged ? '#fef08a' : '#fde68a');

  ctx.save();
  clipTank(ctx, tankWidth, tankHeight, topInset, sideInset);

  ctx.beginPath();
  ctx.moveTo(sideInset, bottom);
  ctx.lineTo(sideInset + tankWidth, bottom);
  for (let x = sideInset + tankWidth; x >= sideInset; x -= 1) {
    ctx.lineTo(x, surfaceWaveY(x, surfaceY, time, surged));
  }
  ctx.closePath();
  ctx.fillStyle = liquidGradient;
  ctx.fill();

  const waveCount = surged ? 5 : 3;
  for (let i = 0; i < waveCount; i += 1) {
    const phase = time * (surged ? 0.0035 : 0.0025) + i * 1.4;
    const amp = (1.2 + i * 0.6) * (surged ? 1.25 : 1);
    const yBase = surfaceY + i * 1.8;

    ctx.beginPath();
    ctx.moveTo(sideInset, bottom);
    for (let x = sideInset; x <= sideInset + tankWidth; x += 2) {
      const y = yBase + Math.sin(x * 0.1 + phase) * amp + Math.cos(x * 0.045 - phase) * (amp * 0.45);
      ctx.lineTo(x, Math.min(bottom, y));
    }
    ctx.lineTo(sideInset + tankWidth, bottom);
    ctx.closePath();
    ctx.fillStyle = `rgba(255, ${190 - i * 22}, ${70 - i * 8}, ${(0.05 + i * 0.015) * (surged ? 1.25 : 1)})`;
    ctx.fill();
  }

  ctx.restore();
}

function drawSurfaceGlow(
  ctx: CanvasRenderingContext2D,
  tankWidth: number,
  sideInset: number,
  surfaceY: number,
  tankHeight: number,
  time: number,
  surged: boolean,
) {
  const centerX = sideInset + tankWidth * 0.5;
  const glowAlpha = surged ? 0.34 + Math.sin(time * 0.005) * 0.08 : 0.12 + Math.sin(time * 0.004) * 0.04;
  const glowRadiusX = tankWidth * (surged ? 0.72 : 0.38);
  const glowRadiusY = tankHeight * (surged ? 0.34 : 0.16);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const glowGradient = ctx.createRadialGradient(
    centerX,
    surfaceY,
    0,
    centerX,
    surfaceY,
    Math.max(glowRadiusX, glowRadiusY),
  );
  glowGradient.addColorStop(0, `rgba(255, 230, 140, ${glowAlpha})`);
  glowGradient.addColorStop(0.35, `rgba(255, 130, 50, ${glowAlpha * 0.35})`);
  glowGradient.addColorStop(0.65, `rgba(255, 80, 0, ${glowAlpha * 0.08})`);
  glowGradient.addColorStop(1, 'rgba(255, 60, 0, 0)');
  ctx.fillStyle = glowGradient;
  ctx.beginPath();
  ctx.ellipse(centerX, surfaceY, glowRadiusX, glowRadiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const sideGlowAlpha = surged ? 0.16 + Math.sin(time * 0.0045) * 0.05 : 0.07 + Math.sin(time * 0.0035) * 0.03;
  for (const side of ['left', 'right'] as const) {
    const cx = side === 'left' ? sideInset + tankWidth * 0.1 : sideInset + tankWidth * 0.9;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const sideGradient = ctx.createRadialGradient(cx, surfaceY - 2, 0, cx, surfaceY - 2, tankWidth * (surged ? 0.28 : 0.18));
    sideGradient.addColorStop(0, `rgba(255, 200, 100, ${sideGlowAlpha})`);
    sideGradient.addColorStop(0.45, `rgba(255, 110, 40, ${sideGlowAlpha * 0.35})`);
    sideGradient.addColorStop(1, 'rgba(255, 60, 0, 0)');
    ctx.fillStyle = sideGradient;
    ctx.beginPath();
    ctx.ellipse(cx, surfaceY - 2, tankWidth * (surged ? 0.22 : 0.14), tankHeight * (surged ? 0.16 : 0.1), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (surged) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const outerGlow = ctx.createRadialGradient(
      centerX,
      surfaceY - tankHeight * 0.04,
      0,
      centerX,
      surfaceY - tankHeight * 0.04,
      tankWidth * 0.95,
    );
    outerGlow.addColorStop(0, `rgba(255, 180, 80, ${0.12 + Math.sin(time * 0.004) * 0.04})`);
    outerGlow.addColorStop(0.5, 'rgba(255, 100, 30, 0.05)');
    outerGlow.addColorStop(1, 'rgba(255, 60, 0, 0)');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.ellipse(centerX, surfaceY - tankHeight * 0.04, tankWidth * 0.58, tankHeight * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function CaloriesFireReactor({ fillPct, goalMet = false }: CaloriesFireReactorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const fillRef = useRef(fillPct);
  const goalMetRef = useRef(goalMet);
  const displayFillRef = useRef(fillPct);
  const rafRef = useRef<number | null>(null);
  const visibleRef = useRef(true);

  fillRef.current = fillPct;
  goalMetRef.current = goalMet;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let tankWidth = 0;
    let sideInset = OVERFLOW_SIDE_IDLE;
    let canvasWidth = 0;
    let tankHeight = 0;
    let canvasHeight = 0;
    let topInset = OVERFLOW_TOP_IDLE;
    let dpr = 1;
    let time = 0;
    let running = true;
    let spawnCooldown = 0;
    let prevSurged = goalMetRef.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const syncLayout = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      tankWidth = container.clientWidth;
      sideInset = goalMetRef.current ? OVERFLOW_SIDE_SURGE : OVERFLOW_SIDE_IDLE;
      topInset = goalMetRef.current ? OVERFLOW_TOP_SURGE : OVERFLOW_TOP_IDLE;
      canvasWidth = tankWidth + sideInset * 2;
      tankHeight = container.clientHeight;
      canvasHeight = tankHeight + topInset;

      canvas.width = Math.max(1, Math.floor(canvasWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvasHeight * dpr));
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;
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

    const spawnBurst = (surfaceY: number, currentFill: number, surged: boolean) => {
      if (currentFill <= 2 || reducedMotion) return;
      const intensity = Math.min(1, currentFill / 100);
      const surgeMul = surged ? 3.2 : 1;
      const particles = particlesRef.current;

      const coreCount = Math.ceil((1 + intensity * 2.5) * surgeMul);
      const flameCount = Math.ceil((2 + intensity * 5) * surgeMul);
      const emberCount = Math.ceil((1 + intensity * 2.5) * (surged ? 2.2 : 1));
      const sparkChance = surged ? 1 : 0.45 + intensity * 0.35;
      const sparkCount =
        Math.random() < sparkChance ? Math.ceil(rand(surged ? 4 : 1, surged ? 9 : 3)) : 0;

      for (let i = 0; i < coreCount; i += 1) {
        particles.push(spawnParticle(tankWidth, sideInset, surfaceY, tankHeight, currentFill, 'core', surged));
      }
      for (let i = 0; i < flameCount; i += 1) {
        particles.push(spawnParticle(tankWidth, sideInset, surfaceY, tankHeight, currentFill, 'flame', surged));
      }
      for (let i = 0; i < emberCount; i += 1) {
        particles.push(spawnParticle(tankWidth, sideInset, surfaceY, tankHeight, currentFill, 'ember', surged));
      }
      for (let i = 0; i < sparkCount; i += 1) {
        particles.push(spawnParticle(tankWidth, sideInset, surfaceY, tankHeight, currentFill, 'spark', surged));
      }

      if (Math.random() < (surged ? 0.88 : 0.42)) {
        particles.push(spawnSideVent(tankWidth, sideInset, surfaceY, 'left', surged));
        particles.push(spawnSideVent(tankWidth, sideInset, surfaceY, 'right', surged));
      }

      const cap = surged ? MAX_PARTICLES_SURGE : MAX_PARTICLES;
      if (particles.length > cap) {
        particles.splice(0, particles.length - cap);
      }
    };

    const tick = () => {
      if (!running) return;

      if (!visibleRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const surged = goalMetRef.current;
      const expectedInset = surged ? OVERFLOW_TOP_SURGE : OVERFLOW_TOP_IDLE;
      const expectedSideInset = surged ? OVERFLOW_SIDE_SURGE : OVERFLOW_SIDE_IDLE;
      if (topInset !== expectedInset || sideInset !== expectedSideInset) {
        syncLayout();
      }

      time += 16;
      const targetFill = fillRef.current;
      displayFillRef.current += (targetFill - displayFillRef.current) * 0.1;
      const currentFill = displayFillRef.current;
      const surfaceY = topInset + tankHeight * (1 - Math.min(100, currentFill) / 100);

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      drawLiquidBase(ctx, tankWidth, sideInset, tankHeight, topInset, currentFill, time, surged);

      if (!reducedMotion && currentFill > 2) {
        if (surged && !prevSurged) {
          for (let burst = 0; burst < 4; burst += 1) {
            spawnBurst(surfaceY, currentFill, true);
          }
        }
        prevSurged = surged;

        spawnCooldown -= 16;
        if (spawnCooldown <= 0) {
          spawnBurst(surfaceY, currentFill, surged);
          if (surged && Math.random() < 0.55) {
            spawnBurst(surfaceY, currentFill, true);
          }
          spawnCooldown = surged ? 10 : 44;
        }

        const particles = particlesRef.current;
        const riseLimit = topInset - (surged ? tankHeight * 0.24 : tankHeight * 0.06);
        const tankLeft = sideInset;
        const tankRight = sideInset + tankWidth;

        for (let i = particles.length - 1; i >= 0; i -= 1) {
          const p = particles[i];
          p.life -= p.kind === 'spark' ? (surged ? 0.02 : 0.026) : p.kind === 'ember' ? 0.012 : surged ? 0.012 : 0.017;
          p.x += p.vx + Math.sin(time * 0.0035 + p.spin) * (surged ? 0.1 : 0.07) * p.wobble;
          p.y += p.vy;
          p.vy -= p.kind === 'spark' ? (surged ? 0.022 : 0.014) : surged ? 0.01 : 0.005;
          p.vx *= 0.986;

          if (p.y < surfaceY + 10) {
            if (p.x < tankLeft + tankWidth * 0.28) {
              p.vx -= surged ? 0.014 : 0.007;
            } else if (p.x > tankRight - tankWidth * 0.28) {
              p.vx += surged ? 0.014 : 0.007;
            }
          }

          if (
            p.life <= 0 ||
            p.y < riseLimit ||
            p.x < -sideInset * 0.35 ||
            p.x > canvasWidth + sideInset * 0.35
          ) {
            particles.splice(i, 1);
          }
        }

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        particles
          .slice()
          .sort((a, b) => a.size - b.size)
          .forEach((particle) =>
            drawParticle(ctx, particle, time, surged, tankWidth, sideInset, surfaceY, topInset, tankHeight),
          );

        ctx.restore();

        if (currentFill > 8) {
          drawSurfaceGlow(ctx, tankWidth, sideInset, surfaceY, tankHeight, time, surged);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      observer.disconnect();
      visibilityObserver.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      particlesRef.current = [];
    };
  }, []);

  const topOverflow = goalMet ? OVERFLOW_TOP_SURGE : OVERFLOW_TOP_IDLE;
  const sideOverflow = goalMet ? OVERFLOW_SIDE_SURGE : OVERFLOW_SIDE_IDLE;

  return (
    <div
      className="relative overflow-visible"
      style={{
        marginTop: goalMet ? -16 : 0,
        paddingTop: goalMet ? 16 : 0,
        marginLeft: -sideOverflow,
        marginRight: -sideOverflow,
        paddingLeft: sideOverflow,
        paddingRight: sideOverflow,
      }}
    >
      <div ref={containerRef} className="relative h-full min-h-[6.25rem] w-full" aria-hidden>
        <div
          className={[
            'pointer-events-none absolute inset-0 overflow-hidden rounded-[1.5rem] border bg-[#120806]',
            goalMet
              ? 'border-orange-400/55 shadow-[inset_0_0_32px_rgba(255,100,30,0.32)]'
              : 'border-orange-400/30 shadow-[inset_0_0_28px_rgba(0,0,0,0.65)]',
          ].join(' ')}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(255,120,40,0.12),transparent_55%)]" />
        </div>

        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute z-[2]"
          style={{ top: -topOverflow, left: -sideOverflow }}
        />
      </div>
    </div>
  );
}
