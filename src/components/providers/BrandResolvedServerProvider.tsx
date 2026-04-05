'use client';

import { createContext, type ReactNode, useContext } from 'react';
import type { ResolvedBrandColors } from '@/lib/brand-colors';

const BrandResolvedServerContext = createContext<ResolvedBrandColors>({});

export function BrandResolvedServerProvider({
  value,
  children,
}: {
  value: ResolvedBrandColors;
  children: ReactNode;
}) {
  return <BrandResolvedServerContext.Provider value={value}>{children}</BrandResolvedServerContext.Provider>;
}

export function useBrandResolvedFromServer(): ResolvedBrandColors {
  return useContext(BrandResolvedServerContext);
}
