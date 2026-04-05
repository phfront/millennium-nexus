'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useUserStore } from '@/store/user-store';
import { createClient } from '@/lib/supabase/client';
import {
  DEFAULT_SPREADSHEET_MONTHS_FORWARD,
  maxSpreadsheetPlanningMonth,
} from '@/lib/finance/finance';
import { emitPlanningHorizonChanged } from '@/lib/finance/finance-planning-events';
import { pruneFinanceEntriesAfterMonth } from '@/lib/finance/finance-prune-entries';

export type FinanceSpreadsheetSettingsContextValue = {
  monthsForward: number;
  /** Dias antes do vencimento para notificação push (vazio = desligado). */
  expenseDueReminderDaysBefore: number[];
  /** Hora local HH:MM para o push de vencimento. */
  expenseDueReminderTime: string;
  isLoading: boolean;
  /** Último mês permitido no seletor do dashboard (mês atual + meses à frente). */
  maxPlanningMonth: string;
  refresh: () => Promise<void>;
  updateMonthsForward: (n: number) => Promise<{ error?: string; pruned?: boolean }>;
  updateExpenseDueReminders: (
    daysBefore: number[],
    timeHm: string,
  ) => Promise<{ error?: string }>;
};

const FinanceSpreadsheetSettingsContext = createContext<FinanceSpreadsheetSettingsContextValue | null>(
  null,
);

const DEFAULT_REMINDER_TIME = '09:00';

function normalizeReminderDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const s = new Set<number>();
  for (const n of raw) {
    const x = Math.round(Number(n));
    if (Number.isFinite(x) && x >= 0 && x <= 60) s.add(x);
  }
  return [...s].sort((a, b) => a - b);
}

export function FinanceSpreadsheetSettingsProvider({ children }: { children: ReactNode }) {
  const user = useUserStore((s) => s.user);
  const [monthsForward, setMonthsForward] = useState(DEFAULT_SPREADSHEET_MONTHS_FORWARD);
  const [expenseDueReminderDaysBefore, setExpenseDueReminderDaysBefore] = useState<number[]>([]);
  const [expenseDueReminderTime, setExpenseDueReminderTime] = useState(DEFAULT_REMINDER_TIME);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user?.id) {
      setMonthsForward(DEFAULT_SPREADSHEET_MONTHS_FORWARD);
      setExpenseDueReminderDaysBefore([]);
      setExpenseDueReminderTime(DEFAULT_REMINDER_TIME);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('finance_user_settings')
      .select('spreadsheet_months_forward, expense_due_reminder_days_before, expense_due_reminder_time')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      const row = data as {
        spreadsheet_months_forward?: number;
        expense_due_reminder_days_before?: unknown;
        expense_due_reminder_time?: string;
      };
      if (typeof row.spreadsheet_months_forward === 'number') {
        setMonthsForward(row.spreadsheet_months_forward);
      } else {
        setMonthsForward(DEFAULT_SPREADSHEET_MONTHS_FORWARD);
      }
      setExpenseDueReminderDaysBefore(normalizeReminderDays(row.expense_due_reminder_days_before));
      const t = row.expense_due_reminder_time?.trim();
      setExpenseDueReminderTime(t && /^\d{2}:\d{2}$/.test(t) ? t : DEFAULT_REMINDER_TIME);
    } else {
      setMonthsForward(DEFAULT_SPREADSHEET_MONTHS_FORWARD);
      setExpenseDueReminderDaysBefore([]);
      setExpenseDueReminderTime(DEFAULT_REMINDER_TIME);
    }
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  /** Congela resumos dos meses já encerrados (histórico imutável); idempotente. */
  useEffect(() => {
    if (!user?.id) return;
    const supabase = createClient();
    void supabase.rpc('finance_ensure_month_snapshots');
  }, [user?.id]);

  const updateMonthsForward = useCallback(
    async (n: number) => {
      if (!user?.id) return { error: 'Sessão inválida.' };
      const clamped = Math.max(0, Math.min(36, Math.round(Number(n))));
      const previousForward = monthsForward;
      const supabase = createClient();
      const { error } = await supabase.from('finance_user_settings').upsert(
        {
          user_id: user.id,
          spreadsheet_months_forward: clamped,
          expense_due_reminder_days_before: expenseDueReminderDaysBefore,
          expense_due_reminder_time: expenseDueReminderTime,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (error) return { error: error.message };

      if (clamped < previousForward) {
        const boundary = maxSpreadsheetPlanningMonth(clamped);
        const { error: pruneError } = await pruneFinanceEntriesAfterMonth(supabase, user.id, boundary);
        if (pruneError) {
          await supabase.from('finance_user_settings').upsert(
            {
              user_id: user.id,
              spreadsheet_months_forward: previousForward,
              expense_due_reminder_days_before: expenseDueReminderDaysBefore,
              expense_due_reminder_time: expenseDueReminderTime,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
          );
          return { error: `Falha ao remover meses extra: ${pruneError}` };
        }
        emitPlanningHorizonChanged();
        setMonthsForward(clamped);
        return { pruned: true };
      }

      setMonthsForward(clamped);
      return {};
    },
    [user?.id, monthsForward, expenseDueReminderDaysBefore, expenseDueReminderTime],
  );

  const updateExpenseDueReminders = useCallback(
    async (daysBefore: number[], timeHm: string) => {
      if (!user?.id) return { error: 'Sessão inválida.' };
      const days = normalizeReminderDays(daysBefore);
      const hm = timeHm.trim();
      if (!/^\d{2}:\d{2}$/.test(hm)) return { error: 'Hora inválida (usa HH:MM).' };
      const supabase = createClient();
      const { error } = await supabase.from('finance_user_settings').upsert(
        {
          user_id: user.id,
          spreadsheet_months_forward: monthsForward,
          expense_due_reminder_days_before: days,
          expense_due_reminder_time: hm,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (error) return { error: error.message };
      setExpenseDueReminderDaysBefore(days);
      setExpenseDueReminderTime(hm);
      return {};
    },
    [user?.id, monthsForward],
  );

  const maxPlanningMonth = useMemo(() => maxSpreadsheetPlanningMonth(monthsForward), [monthsForward]);

  const value = useMemo<FinanceSpreadsheetSettingsContextValue>(
    () => ({
      monthsForward,
      expenseDueReminderDaysBefore,
      expenseDueReminderTime,
      isLoading,
      maxPlanningMonth,
      refresh: fetchSettings,
      updateMonthsForward,
      updateExpenseDueReminders,
    }),
    [
      monthsForward,
      expenseDueReminderDaysBefore,
      expenseDueReminderTime,
      isLoading,
      maxPlanningMonth,
      fetchSettings,
      updateMonthsForward,
      updateExpenseDueReminders,
    ],
  );

  return (
    <FinanceSpreadsheetSettingsContext.Provider value={value}>{children}</FinanceSpreadsheetSettingsContext.Provider>
  );
}

export function useFinanceSpreadsheetSettings(): FinanceSpreadsheetSettingsContextValue {
  const ctx = useContext(FinanceSpreadsheetSettingsContext);
  if (!ctx) {
    throw new Error('useFinanceSpreadsheetSettings deve estar dentro de FinanceSpreadsheetSettingsProvider');
  }
  return ctx;
}
