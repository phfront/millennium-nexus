'use client';

import { useUserStore } from '@/store/user-store';
import type { AuthUser } from '@/lib/auth-types';

export function useCurrentUser(): AuthUser | null {
  return useUserStore((state) => state.user);
}
