'use server';

import { cookies } from 'next/headers';
import {
  NEXUS_BRAND_COOKIE_NAME,
  serializeBrandCookie,
  normalizeBrandHex,
  getBrandCookieStoreOptions,
} from '@/lib/brand-colors';

export async function syncBrandCookieAction(primary: string | null, secondary: string | null): Promise<void> {
  const c = await cookies();
  const p = primary != null ? normalizeBrandHex(primary) : null;
  const s = secondary != null ? normalizeBrandHex(secondary) : null;
  if (!p && !s) {
    c.delete(NEXUS_BRAND_COOKIE_NAME);
    return;
  }
  c.set(NEXUS_BRAND_COOKIE_NAME, serializeBrandCookie({ primary: p, secondary: s }), getBrandCookieStoreOptions());
}
