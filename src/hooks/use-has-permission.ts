'use client';

import { useUserStore } from '@/store/user-store';

export function useHasPermission(_permission: string): boolean {
  const user = useUserStore((state) => state.user);
  return user !== null;
}
