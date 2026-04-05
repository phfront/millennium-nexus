'use client';

import { useUserStore } from '@/store/user-store';

export function useIsAuthenticated(): boolean {
  return useUserStore((state) => state.user !== null);
}
