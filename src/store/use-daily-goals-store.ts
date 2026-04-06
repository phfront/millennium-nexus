'use client';

import { create } from 'zustand';
import { getLocalDateStr } from '@/lib/daily-goals/timezone';

type DailyGoalsStore = {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
};

/** “Hoje” no fuso default do produto até o perfil carregar (UserProvider sincroniza). */
function initialLocalToday(): string {
  return getLocalDateStr();
}

export const useDailyGoalsStore = create<DailyGoalsStore>((set) => ({
  selectedDate: initialLocalToday(),
  setSelectedDate: (date) => set({ selectedDate: date }),
}));
