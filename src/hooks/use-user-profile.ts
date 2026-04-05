'use client';

import { useUserStore } from '@/store/user-store';
import type { Profile } from '@/lib/auth-types';

type UseUserProfileResult = {
  profile: Profile | null;
  isLoading: boolean;
};

export function useUserProfile(): UseUserProfileResult {
  const user = useUserStore((state) => state.user);
  const isLoading = useUserStore((state) => state.isLoading);
  return {
    profile: user?.profile ?? null,
    isLoading,
  };
}
