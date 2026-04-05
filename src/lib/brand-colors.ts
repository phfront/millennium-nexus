import type { Profile } from './auth-types';

export const NEXUS_BRAND_COOKIE_NAME = 'nexus-brand';

export function normalizeBrandHex(input: string | null | undefined): string | null {
  if (input == null || typeof input !== 'string') return null;
  const t = input.trim();
  const m = t.match(/^#?([0-9a-f]{6})$/i);
  return m ? `#${m[1].toLowerCase()}` : null;
}

export function isValidBrandHex(input: string): boolean {
  return normalizeBrandHex(input) !== null;
}

export type BrandCookiePayload = {
  p?: string;
  s?: string;
};

export type ResolvedBrandColors = {
  primary?: string;
  secondary?: string;
};

export function parseBrandCookie(value: string | null | undefined): BrandCookiePayload | null {
  if (value == null || value === '') return null;
  try {
    const o = JSON.parse(value) as unknown;
    if (o === null || typeof o !== 'object' || Array.isArray(o)) return null;
    const p = (o as BrandCookiePayload).p;
    const s = (o as BrandCookiePayload).s;
    const out: BrandCookiePayload = {};
    if (typeof p === 'string') {
      const np = normalizeBrandHex(p);
      if (np) out.p = np;
    }
    if (typeof s === 'string') {
      const ns = normalizeBrandHex(s);
      if (ns) out.s = ns;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

export function readBrandCookieFromDocument(): BrandCookiePayload | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${NEXUS_BRAND_COOKIE_NAME}=`;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const s = part.trim();
    if (s.startsWith(prefix)) {
      const raw = decodeURIComponent(s.slice(prefix.length));
      return parseBrandCookie(raw);
    }
  }
  return null;
}

export function serializeBrandCookie(colors: { primary: string | null; secondary: string | null }): string {
  const o: BrandCookiePayload = {};
  const p = normalizeBrandHex(colors.primary ?? undefined);
  const s = normalizeBrandHex(colors.secondary ?? undefined);
  if (p) o.p = p;
  if (s) o.s = s;
  return JSON.stringify(o);
}

export function resolveBrandColors(params: {
  profile: Pick<Profile, 'brand_primary_hex' | 'brand_secondary_hex'> | null | undefined;
  cookie: BrandCookiePayload | null | undefined;
}): ResolvedBrandColors {
  const { profile, cookie } = params;
  const out: ResolvedBrandColors = {};

  const fromProfileP = normalizeBrandHex(profile?.brand_primary_hex ?? undefined);
  const fromProfileS = normalizeBrandHex(profile?.brand_secondary_hex ?? undefined);
  const fromCookieP = cookie?.p ? normalizeBrandHex(cookie.p) : null;
  const fromCookieS = cookie?.s ? normalizeBrandHex(cookie.s) : null;

  const primary = fromProfileP ?? fromCookieP ?? undefined;
  const secondary = fromProfileS ?? fromCookieS ?? undefined;

  if (primary) out.primary = primary;
  if (secondary) out.secondary = secondary;
  return out;
}

/** Cores da marca no raster `public/logo.png`; só nesse par exibimos o PNG. */
export const RASTER_BRAND_PRIMARY_HEX = '#006437';
export const RASTER_BRAND_SECONDARY_HEX = '#beac4e';

export function shouldUseRasterBrandLogo(resolved: ResolvedBrandColors): boolean {
  const p = resolved.primary ? normalizeBrandHex(resolved.primary) : null;
  const s = resolved.secondary ? normalizeBrandHex(resolved.secondary) : null;
  return p === RASTER_BRAND_PRIMARY_HEX && s === RASTER_BRAND_SECONDARY_HEX;
}

function hoverMix(base: string): string {
  return `color-mix(in srgb, ${base} 82%, black)`;
}

export function getTextColorFromLuminance(hex: string): string {
  const t = hex.replace('#', '');
  if (t.length !== 6) return '#ffffff';
  const r = parseInt(t.substring(0, 2), 16);
  const g = parseInt(t.substring(2, 4), 16);
  const b = parseInt(t.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#09090b' : '#ffffff';
}

export function brandColorsToCssProperties(resolved: ResolvedBrandColors): Record<string, string> {
  const props: Record<string, string> = {};
  if (resolved.primary) {
    props['--color-brand-primary'] = resolved.primary;
    props['--color-brand-primary-hover'] = hoverMix(resolved.primary);
    props['--color-brand-primary-text'] = getTextColorFromLuminance(resolved.primary);
  }
  if (resolved.secondary) {
    props['--color-brand-secondary'] = resolved.secondary;
    props['--color-brand-secondary-hover'] = hoverMix(resolved.secondary);
    props['--color-brand-secondary-text'] = getTextColorFromLuminance(resolved.secondary);
  }
  return props;
}

const BRAND_CSS_KEYS = [
  '--color-brand-primary',
  '--color-brand-primary-hover',
  '--color-brand-primary-text',
  '--color-brand-secondary',
  '--color-brand-secondary-hover',
  '--color-brand-secondary-text',
] as const;

export function applyBrandCssVariables(el: HTMLElement, resolved: ResolvedBrandColors): void {
  const props = brandColorsToCssProperties(resolved);
  for (const key of BRAND_CSS_KEYS) {
    el.style.removeProperty(key);
  }
  for (const [k, v] of Object.entries(props)) {
    el.style.setProperty(k, v);
  }
}

export function getBrandCookieStoreOptions(): {
  path: string;
  maxAge: number;
  sameSite: 'lax';
  httpOnly: false;
} {
  return {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
  };
}
