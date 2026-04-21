'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useLogs } from '@/hooks/daily-goals/use-logs';
import { useUserStore } from '@/store/user-store';
import { getLocalDateStr } from '@/lib/daily-goals/timezone';

type DailyGoalsTodayLogsValue = ReturnType<typeof useLogs>;

const DailyGoalsTodayLogsContext = createContext<DailyGoalsTodayLogsValue | null>(null);

/**
 * Uma única instância de `useLogs` para o dia local de hoje, partilhada entre widgets
 * (ex.: resumo + carrossel) para o estado permanecer sincronizado após `upsertLog`.
 */
export function DailyGoalsTodayLogsProvider({ children }: { children: ReactNode }) {
  const user = useUserStore((s) => s.user);
  const today = getLocalDateStr(user?.profile?.timezone);
  const logsApi = useLogs(today);

  return (
    <DailyGoalsTodayLogsContext.Provider value={logsApi}>{children}</DailyGoalsTodayLogsContext.Provider>
  );
}

export function useDailyGoalsTodayLogs(): DailyGoalsTodayLogsValue {
  const ctx = useContext(DailyGoalsTodayLogsContext);
  if (!ctx) {
    throw new Error('useDailyGoalsTodayLogs deve ser usado dentro de DailyGoalsTodayLogsProvider');
  }
  return ctx;
}
