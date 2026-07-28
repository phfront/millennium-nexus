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
  toMonthDate,
} from '@/lib/finance/finance';
import { emitPlanningHorizonChanged } from '@/lib/finance/finance-planning-events';
import { pruneFinanceEntriesAfterMonth } from '@/lib/finance/finance-prune-entries';
import { DEFAULT_DISPLAY_CURRENCY, isCurrencyCode, normalizeCurrencyCode } from '@/lib/finance/currency';

export type FinanceSpreadsheetSettingsContextValue = {
  monthsForward: number;
  /** Dias antes do vencimento para notificação push (vazio = desligado). */
  expenseDueReminderDaysBefore: number[];
  /** Hora local HH:MM para o push de vencimento. */
  expenseDueReminderTime: string;
  /** Moeda ISO-4217 em que o módulo apresenta os valores (não converte o que está guardado). */
  displayCurrency: string;
  /** Percentuais-alvo do orçamento (60/30/10 por omissão). */
  budgetPctEssential: number;
  budgetPctOptional: number;
  budgetPctInvestment: number;
  /** Receitas pontuais entram na base de cálculo do orçamento. */
  budgetIncludeOneTimeIncome: boolean;
  isLoading: boolean;
  /** Último mês permitido no seletor do dashboard (mês atual + meses à frente). */
  maxPlanningMonth: string;
  refresh: () => Promise<void>;
  updateMonthsForward: (n: number) => Promise<{ error?: string; pruned?: boolean }>;
  updateExpenseDueReminders: (
    daysBefore: number[],
    timeHm: string,
  ) => Promise<{ error?: string }>;
  updateDisplayCurrency: (currency: string) => Promise<{ error?: string }>;
  updateBudgetTargets: (targets: {
    essential: number;
    optional: number;
    investment: number;
    includeOneTimeIncome: boolean;
    /** Primeiro mês em que estes alvos valem ('YYYY-MM-01'). Omitido = mês corrente. */
    effectiveFrom?: string;
  }) => Promise<{ error?: string }>;
};

const FinanceSpreadsheetSettingsContext = createContext<FinanceSpreadsheetSettingsContextValue | null>(
  null,
);

const DEFAULT_REMINDER_TIME = '09:00';

/** Colunas de `finance_user_settings` escritas pelo módulo (sem `user_id`/`updated_at`). */
type PersistedSettings = {
  spreadsheet_months_forward: number;
  expense_due_reminder_days_before: number[];
  expense_due_reminder_time: string;
  display_currency: string;
  budget_pct_essential: number;
  budget_pct_optional: number;
  budget_pct_investment: number;
  budget_include_one_time_income: boolean;
};

const DEFAULT_BUDGET = { essential: 60, optional: 30, investment: 10 };

function normalizePct(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) return fallback;
  return Math.round(n * 100) / 100;
}

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
  const [displayCurrency, setDisplayCurrency] = useState(DEFAULT_DISPLAY_CURRENCY);
  const [budgetPctEssential, setBudgetPctEssential] = useState(DEFAULT_BUDGET.essential);
  const [budgetPctOptional, setBudgetPctOptional] = useState(DEFAULT_BUDGET.optional);
  const [budgetPctInvestment, setBudgetPctInvestment] = useState(DEFAULT_BUDGET.investment);
  const [budgetIncludeOneTimeIncome, setBudgetIncludeOneTimeIncome] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const resetBudgetDefaults = useCallback(() => {
    setBudgetPctEssential(DEFAULT_BUDGET.essential);
    setBudgetPctOptional(DEFAULT_BUDGET.optional);
    setBudgetPctInvestment(DEFAULT_BUDGET.investment);
    setBudgetIncludeOneTimeIncome(false);
  }, []);

  const fetchSettings = useCallback(async () => {
    if (!user?.id) {
      setMonthsForward(DEFAULT_SPREADSHEET_MONTHS_FORWARD);
      setExpenseDueReminderDaysBefore([]);
      setExpenseDueReminderTime(DEFAULT_REMINDER_TIME);
      setDisplayCurrency(DEFAULT_DISPLAY_CURRENCY);
      resetBudgetDefaults();
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('finance_user_settings')
      .select(
        'spreadsheet_months_forward, expense_due_reminder_days_before, expense_due_reminder_time, display_currency, budget_pct_essential, budget_pct_optional, budget_pct_investment, budget_include_one_time_income',
      )
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      const row = data as {
        spreadsheet_months_forward?: number;
        expense_due_reminder_days_before?: unknown;
        expense_due_reminder_time?: string;
        display_currency?: string;
        budget_pct_essential?: number | string;
        budget_pct_optional?: number | string;
        budget_pct_investment?: number | string;
        budget_include_one_time_income?: boolean;
      };
      if (typeof row.spreadsheet_months_forward === 'number') {
        setMonthsForward(row.spreadsheet_months_forward);
      } else {
        setMonthsForward(DEFAULT_SPREADSHEET_MONTHS_FORWARD);
      }
      setExpenseDueReminderDaysBefore(normalizeReminderDays(row.expense_due_reminder_days_before));
      const t = row.expense_due_reminder_time?.trim();
      setExpenseDueReminderTime(t && /^\d{2}:\d{2}$/.test(t) ? t : DEFAULT_REMINDER_TIME);
      setDisplayCurrency(normalizeCurrencyCode(row.display_currency));
      setBudgetPctEssential(normalizePct(row.budget_pct_essential, DEFAULT_BUDGET.essential));
      setBudgetPctOptional(normalizePct(row.budget_pct_optional, DEFAULT_BUDGET.optional));
      setBudgetPctInvestment(normalizePct(row.budget_pct_investment, DEFAULT_BUDGET.investment));
      setBudgetIncludeOneTimeIncome(Boolean(row.budget_include_one_time_income));
    } else {
      setMonthsForward(DEFAULT_SPREADSHEET_MONTHS_FORWARD);
      setExpenseDueReminderDaysBefore([]);
      setExpenseDueReminderTime(DEFAULT_REMINDER_TIME);
      setDisplayCurrency(DEFAULT_DISPLAY_CURRENCY);
      resetBudgetDefaults();
    }
    setIsLoading(false);
  }, [user?.id, resetBudgetDefaults]);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  /** Congela resumos dos meses já encerrados (histórico imutável); idempotente. */
  useEffect(() => {
    if (!user?.id) return;
    const supabase = createClient();
    void supabase.rpc('finance_ensure_month_snapshots');
  }, [user?.id]);

  /**
   * O upsert substitui a linha inteira, por isso todos os campos vão sempre
   * juntos: `patch` só diz o que muda em relação ao estado atual.
   */
  const persist = useCallback(
    async (patch: Partial<PersistedSettings>): Promise<{ error?: string }> => {
      if (!user?.id) return { error: 'Sessão inválida.' };
      const supabase = createClient();
      const { error } = await supabase.from('finance_user_settings').upsert(
        {
          user_id: user.id,
          spreadsheet_months_forward: monthsForward,
          expense_due_reminder_days_before: expenseDueReminderDaysBefore,
          expense_due_reminder_time: expenseDueReminderTime,
          display_currency: displayCurrency,
          budget_pct_essential: budgetPctEssential,
          budget_pct_optional: budgetPctOptional,
          budget_pct_investment: budgetPctInvestment,
          budget_include_one_time_income: budgetIncludeOneTimeIncome,
          ...patch,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      return error ? { error: error.message } : {};
    },
    [
      user?.id,
      monthsForward,
      expenseDueReminderDaysBefore,
      expenseDueReminderTime,
      displayCurrency,
      budgetPctEssential,
      budgetPctOptional,
      budgetPctInvestment,
      budgetIncludeOneTimeIncome,
    ],
  );

  const updateMonthsForward = useCallback(
    async (n: number) => {
      if (!user?.id) return { error: 'Sessão inválida.' };
      const clamped = Math.max(0, Math.min(36, Math.round(Number(n))));
      const previousForward = monthsForward;
      const { error } = await persist({ spreadsheet_months_forward: clamped });
      if (error) return { error };

      if (clamped < previousForward) {
        const supabase = createClient();
        const boundary = maxSpreadsheetPlanningMonth(clamped);
        const { error: pruneError } = await pruneFinanceEntriesAfterMonth(supabase, user.id, boundary);
        if (pruneError) {
          await persist({ spreadsheet_months_forward: previousForward });
          return { error: `Falha ao remover meses extra: ${pruneError}` };
        }
        emitPlanningHorizonChanged();
        setMonthsForward(clamped);
        return { pruned: true };
      }

      setMonthsForward(clamped);
      return {};
    },
    [user?.id, monthsForward, persist],
  );

  const updateExpenseDueReminders = useCallback(
    async (daysBefore: number[], timeHm: string) => {
      const days = normalizeReminderDays(daysBefore);
      const hm = timeHm.trim();
      if (!/^\d{2}:\d{2}$/.test(hm)) return { error: 'Hora inválida (usa HH:MM).' };
      const { error } = await persist({
        expense_due_reminder_days_before: days,
        expense_due_reminder_time: hm,
      });
      if (error) return { error };
      setExpenseDueReminderDaysBefore(days);
      setExpenseDueReminderTime(hm);
      return {};
    },
    [persist],
  );

  const updateDisplayCurrency = useCallback(
    async (currency: string) => {
      const code = currency.trim().toUpperCase();
      if (!isCurrencyCode(code)) return { error: 'Moeda inválida (usa o código ISO, ex.: USD).' };
      const { error } = await persist({ display_currency: code });
      if (error) return { error };
      setDisplayCurrency(code);
      return {};
    },
    [persist],
  );

  const updateBudgetTargets = useCallback(
    async (targets: {
      essential: number;
      optional: number;
      investment: number;
      includeOneTimeIncome: boolean;
      effectiveFrom?: string;
    }) => {
      const e = normalizePct(targets.essential, NaN);
      const o = normalizePct(targets.optional, NaN);
      const i = normalizePct(targets.investment, NaN);
      if (!Number.isFinite(e) || !Number.isFinite(o) || !Number.isFinite(i)) {
        return { error: 'Usa percentuais entre 0 e 100.' };
      }
      // O CHECK na BD rejeita soma > 100; validar aqui dá uma mensagem melhor.
      if (e + o + i > 100) {
        return { error: `A soma dá ${Math.round((e + o + i) * 10) / 10}% — não pode passar de 100%.` };
      }
      const { error } = await persist({
        budget_pct_essential: e,
        budget_pct_optional: o,
        budget_pct_investment: i,
        budget_include_one_time_income: targets.includeOneTimeIncome,
      });
      if (error) return { error };

      /**
       * A tela de Orçamento lê `finance_budget_targets`, não estas colunas: é o
       * que faz mudar o alvo hoje não reescrever o plano dos meses passados.
       * A linha em `finance_user_settings` fica como valor de arranque do
       * formulário.
       */
      if (user?.id) {
        const effectiveFrom = targets.effectiveFrom ?? toMonthDate(new Date());
        const supabase = createClient();
        const { error: targetError } = await supabase.from('finance_budget_targets').upsert(
          {
            user_id: user.id,
            effective_from: effectiveFrom,
            pct_essential: e,
            pct_optional: o,
            pct_investment: i,
            include_one_time_income: targets.includeOneTimeIncome,
          },
          { onConflict: 'user_id,effective_from' },
        );
        if (targetError) return { error: targetError.message };
      }

      setBudgetPctEssential(e);
      setBudgetPctOptional(o);
      setBudgetPctInvestment(i);
      setBudgetIncludeOneTimeIncome(targets.includeOneTimeIncome);
      return {};
    },
    [persist],
  );

  const maxPlanningMonth = useMemo(() => maxSpreadsheetPlanningMonth(monthsForward), [monthsForward]);

  const value = useMemo<FinanceSpreadsheetSettingsContextValue>(
    () => ({
      monthsForward,
      expenseDueReminderDaysBefore,
      expenseDueReminderTime,
      displayCurrency,
      budgetPctEssential,
      budgetPctOptional,
      budgetPctInvestment,
      budgetIncludeOneTimeIncome,
      isLoading,
      maxPlanningMonth,
      refresh: fetchSettings,
      updateMonthsForward,
      updateExpenseDueReminders,
      updateDisplayCurrency,
      updateBudgetTargets,
    }),
    [
      monthsForward,
      expenseDueReminderDaysBefore,
      expenseDueReminderTime,
      displayCurrency,
      budgetPctEssential,
      budgetPctOptional,
      budgetPctInvestment,
      budgetIncludeOneTimeIncome,
      isLoading,
      maxPlanningMonth,
      fetchSettings,
      updateMonthsForward,
      updateExpenseDueReminders,
      updateDisplayCurrency,
      updateBudgetTargets,
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
