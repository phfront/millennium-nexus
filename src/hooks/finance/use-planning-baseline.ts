'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import { useMonthlySummary } from '@/hooks/finance/use-monthly-summary';
import { useCurrencyConversion } from '@/hooks/finance/use-currency-conversion';
import { useFinanceSpreadsheetSettings } from '@/contexts/FinanceSpreadsheetSettingsContext';
import { usePlanningHorizonListener } from '@/hooks/finance/use-planning-horizon-listener';
import { shiftMonthBy, toMonthDate } from '@/lib/finance/finance';
import { buildBaseline, type PlanningBaseMonth } from '@/lib/finance/planning';
import { incomeEntryCurrency, type IncomeSource } from '@/types/finance';

/** Maior horizonte que a tela oferece (6, 12 ou 24 meses). */
export const PLANNING_MAX_MONTHS = 24;

type SourceDefaults = Pick<
  IncomeSource,
  'is_active' | 'default_monthly_amount' | 'currency' | 'currency_since'
>;

type ItemDefaults = {
  is_active: boolean;
  is_recurring: boolean;
  default_amount: number | null;
  paid_with_item_id: string | null;
};

/**
 * O que sobra em cada um dos próximos meses ANTES das compras planejadas.
 *
 * Dentro do horizonte da planilha usa `finance_monthly_summary` (o realizado e
 * o que já foi digitado). Além dele, estima com os mesmos valores padrão que a
 * planilha usaria para preencher o mês — fontes ativas pelo `default_monthly_amount`
 * convertido pela cotação atual, itens recorrentes pelo `default_amount`. Itens
 * pagos dentro de um cartão ficam de fora, como na view: o cartão já conta
 * pela fatura. Assinaturas ficam de fora (decisão do Pedro), igual ao dashboard.
 */
export function usePlanningBaseline() {
  const user = useUserStore((s) => s.user);
  const { summaries, isLoading: summariesLoading } = useMonthlySummary();
  const { maxPlanningMonth, displayCurrency } = useFinanceSpreadsheetSettings();
  const { convert } = useCurrencyConversion();
  const [sources, setSources] = useState<SourceDefaults[]>([]);
  const [items, setItems] = useState<ItemDefaults[]>([]);
  const [defaultsLoading, setDefaultsLoading] = useState(true);

  const fetchDefaults = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const [{ data: srcData }, { data: itemData }] = await Promise.all([
      supabase
        .from('finance_income_sources')
        .select('is_active, default_monthly_amount, currency, currency_since')
        .eq('user_id', user.id),
      supabase
        .from('finance_expense_items')
        .select('is_active, is_recurring, default_amount, paid_with_item_id')
        .eq('user_id', user.id),
    ]);
    setSources((srcData ?? []) as SourceDefaults[]);
    setItems((itemData ?? []) as ItemDefaults[]);
    setDefaultsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchDefaults();
  }, [fetchDefaults]);
  usePlanningHorizonListener(fetchDefaults);

  const months = useMemo(() => {
    const first = toMonthDate(new Date());
    return Array.from({ length: PLANNING_MAX_MONTHS }, (_, i) => shiftMonthBy(first, i));
  }, []);

  const recurringExpenses = useMemo(
    () =>
      items
        .filter((it) => it.is_active && it.is_recurring && !it.paid_with_item_id)
        .reduce((sum, it) => sum + Math.max(0, Number(it.default_amount ?? 0)), 0),
    [items],
  );

  const estimateFree = useCallback(
    (month: string) => {
      const income = sources
        .filter((s) => s.is_active)
        .reduce(
          (sum, s) =>
            sum +
            convert(
              Math.max(0, Number(s.default_monthly_amount ?? 0)),
              incomeEntryCurrency(s, month, displayCurrency),
            ),
          0,
        );
      return income - recurringExpenses;
    },
    [sources, recurringExpenses, convert, displayCurrency],
  );

  const base: PlanningBaseMonth[] = useMemo(
    () => buildBaseline({ months, summaries, horizonEnd: maxPlanningMonth, estimateFree }),
    [months, summaries, maxPlanningMonth, estimateFree],
  );

  return {
    base,
    /** Último mês com linhas reais; depois dele, os meses são estimados. */
    horizonEnd: maxPlanningMonth,
    isLoading: summariesLoading || defaultsLoading,
  };
}

/**
 * "Me avise se o acumulado ficar abaixo de X" — guardado em
 * `finance_user_settings.planning_alert_amount`. O upsert manda só esta
 * coluna, então não pisa nas outras configurações do módulo.
 */
export function usePlanningAlert() {
  const user = useUserStore((s) => s.user);
  const [alertAmount, setAlertAmount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from('finance_user_settings')
      .select('planning_alert_amount')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const v = Number((data as { planning_alert_amount?: number } | null)?.planning_alert_amount ?? 0);
        setAlertAmount(Number.isFinite(v) ? v : 0);
      });
  }, [user]);

  const saveAlertAmount = useCallback(
    async (value: number) => {
      if (!user) return;
      const v = Math.max(0, Math.round(value * 100) / 100);
      setAlertAmount(v);
      const supabase = createClient();
      const { error } = await supabase
        .from('finance_user_settings')
        .upsert({ user_id: user.id, planning_alert_amount: v }, { onConflict: 'user_id' });
      if (error) throw new Error(error.message);
    },
    [user],
  );

  return { alertAmount, setAlertAmount, saveAlertAmount };
}
