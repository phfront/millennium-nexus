'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import {
  applyBrandCssVariables,
  readBrandCookieFromDocument,
  resolveBrandColors,
} from '@/lib/brand-colors';
import { useUserStore } from '@/store/user-store';

export function BrandColorsProvider({ children }: { children: ReactNode }) {
  const profile = useUserStore((s) => s.user?.profile ?? null);

  useEffect(() => {
    const cookie = readBrandCookieFromDocument();
    const resolved = resolveBrandColors({ profile: profile ?? null, cookie });
    applyBrandCssVariables(document.documentElement, resolved);
  }, [profile, profile?.brand_primary_hex, profile?.brand_secondary_hex]);

  return <>{children}</>;
}
