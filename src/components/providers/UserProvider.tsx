'use client';

import { useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { useUserStore } from '@/store/user-store';
import { useThemeStore } from '@/store/useThemeStore';
import { useHabitsGoalsStore } from '@/store/use-habits-goals-store';
import { getLocalDateStr } from '@/lib/habits-goals/timezone';
import type { Profile } from '@/lib/auth-types';

interface UserProviderProps {
  user: User | null;
  profile: Profile | null;
  children: React.ReactNode;
}

export function UserProvider({ user, profile, children }: UserProviderProps) {
  const setUser = useUserStore((s) => s.setUser);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setSelectedDate = useHabitsGoalsStore((s) => s.setSelectedDate);

  useEffect(() => {
    if (user) {
      setUser({ id: user.id, email: user.email!, profile });
    } else {
      setUser(null);
    }
    if (profile?.theme_preference) {
      setTheme(profile.theme_preference);
    }
    if (profile) {
      setSelectedDate(getLocalDateStr(profile.timezone));
    }
  }, [user, profile, setUser, setTheme, setSelectedDate]);

  return <>{children}</>;
}
