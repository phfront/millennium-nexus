'use client';

import { create } from 'zustand';

type DailyGoalsStore = {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
};

// Valor inicial em UTC; será atualizado pelo UserProvider assim que o perfil for carregado
// (usando o fuso horário configurado pelo usuário em getLocalDateStr)
function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export const useDailyGoalsStore = create<DailyGoalsStore>((set) => ({
  selectedDate: todayISO(),
  setSelectedDate: (date) => set({ selectedDate: date }),
}));
