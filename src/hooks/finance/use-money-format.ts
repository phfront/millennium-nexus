'use client';

import { useMemo } from 'react';
import { useFinanceSpreadsheetSettings } from '@/contexts/FinanceSpreadsheetSettingsContext';
import {
  currencySymbol,
  formatMoney,
  formatMoneyCompact,
  parseMoneyInput,
} from '@/lib/finance/currency';

export type MoneyFormat = {
  /** Moeda de exibição atual (ISO-4217). */
  currency: string;
  /** Símbolo curto para rótulos, ex.: `R$`. */
  symbol: string;
  /** Formata na moeda de exibição. */
  format: (value: number) => string;
  /** Idem, compacto acima de 1M (gráficos). */
  formatCompact: (value: number) => string;
  /** Formata explicitamente noutra moeda (ex.: valor original de uma fonte estrangeira). */
  formatIn: (value: number, currency: string) => string;
  parse: (raw: string) => number;
};

/** Formatação monetária do módulo Finanças, na moeda escolhida em Configurações. */
export function useMoneyFormat(): MoneyFormat {
  const { displayCurrency } = useFinanceSpreadsheetSettings();

  return useMemo(
    () => ({
      currency: displayCurrency,
      symbol: currencySymbol(displayCurrency),
      format: (value: number) => formatMoney(value, displayCurrency),
      formatCompact: (value: number) => formatMoneyCompact(value, displayCurrency),
      formatIn: (value: number, currency: string) => formatMoney(value, currency),
      parse: parseMoneyInput,
    }),
    [displayCurrency],
  );
}
