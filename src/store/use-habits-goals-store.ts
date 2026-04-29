'use client';

import { create } from 'zustand';
import { getLocalDateStr } from '@/lib/habits-goals/timezone';

type HabitsGoalsStore = {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
};

/** “Hoje” no fuso default do produto até o perfil carregar (UserProvider sincroniza). */
function initialLocalToday(): string {
  return getLocalDateStr();
}

export const useHabitsGoalsStore = create<HabitsGoalsStore>((set) => ({
  selectedDate: initialLocalToday(),
  setSelectedDate: (date) => set({ selectedDate: date }),
}));
