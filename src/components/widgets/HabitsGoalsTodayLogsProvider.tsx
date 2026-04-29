'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useLogs } from '@/hooks/habits-goals/use-logs';
import { useTrackers } from '@/hooks/habits-goals/use-trackers';
import { useUserStore } from '@/store/user-store';
import { getLocalDateStr } from '@/lib/habits-goals/timezone';

type HabitsGoalsTodayLogsValue = ReturnType<typeof useLogs>;

const HabitsGoalsTodayLogsContext = createContext<HabitsGoalsTodayLogsValue | null>(null);

/**
 * Uma única instância de `useLogs` para o dia local de hoje, partilhada entre widgets
 * (ex.: resumo + carrossel). Inclui todas as metas ativas; o intervalo de logs cobre o
 * período de cada meta (diária, semanal, mensal ou personalizada).
 */
export function HabitsGoalsTodayLogsProvider({ children }: { children: ReactNode }) {
  const user = useUserStore((s) => s.user);
  const today = getLocalDateStr(user?.profile?.timezone);
  const { trackers: allTrackers } = useTrackers(true);
  const logsApi = useLogs(today, allTrackers);

  return (
    <HabitsGoalsTodayLogsContext.Provider value={logsApi}>{children}</HabitsGoalsTodayLogsContext.Provider>
  );
}

export function useHabitsGoalsTodayLogs(): HabitsGoalsTodayLogsValue {
  const ctx = useContext(HabitsGoalsTodayLogsContext);
  if (!ctx) {
    throw new Error('useHabitsGoalsTodayLogs deve ser usado dentro de HabitsGoalsTodayLogsProvider');
  }
  return ctx;
}
