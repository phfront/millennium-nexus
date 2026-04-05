'use client';

import { useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { useUserStore } from '@/store/user-store';
import { useThemeStore } from '@/store/useThemeStore';
import type { Profile } from '@/types/database';

interface UserProviderProps {
  user: User | null;
  profile: Profile | null;
  children: React.ReactNode;
}

export function UserProvider({ user, profile, children }: UserProviderProps) {
  const setUser = useUserStore((s) => s.setUser);
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    if (user) {
      setUser({ id: user.id, email: user.email!, profile });
    } else {
      setUser(null);
    }
    if (profile?.theme_preference) {
      setTheme(profile.theme_preference);
    }
  }, [user, profile, setUser, setTheme]);

  return <>{children}</>;
}
