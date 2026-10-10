'use client';

import { useCallback, useMemo } from 'react';
import { useFinanceSpreadsheetSettings } from '@/contexts/FinanceSpreadsheetSettingsContext';
import { useExchangeRates } from '@/hooks/finance/use-exchange-rates';
import {
  convertMoney,
  convertMoneyAtLockedRate,
  exchangeRateBetween,
  normalizeCurrencyCode,
} from '@/lib/finance/currency';

/**
 * Conversão para a moeda de exibição do módulo, pela cotação atual.
 * Sem cotações disponíveis, `convert` devolve o valor intacto (mesmo fallback
 * do `finance_fx_factor` na BD) e `hasRates` fica false para a UI avisar.
 */
export function useCurrencyConversion() {
  const { displayCurrency } = useFinanceSpreadsheetSettings();
  const { rates, fetchedAt, isLoading, error, refresh } = useExchangeRates();

  const convert = useCallback(
    (amount: number, from: string | null | undefined) =>
      convertMoney(amount, from, displayCurrency, rates),
    [rates, displayCurrency],
  );

  /**
   * Igual a `convert`, mas um lançamento com cotação travada usa a dele — é o
   * que faz um mês já recebido parar de oscilar. Espelha
   * `finance_income_entry_factor` na BD.
   */
  const convertLocked = useCallback(
    (
      amount: number,
      from: string | null | undefined,
      lockedRate: number | null | undefined,
      lockedQuote: string | null | undefined,
    ) =>
      convertMoneyAtLockedRate(amount, from, displayCurrency, rates, lockedRate, lockedQuote),
    [rates, displayCurrency],
  );

  /** Quanto vale 1 unidade de `from` na moeda de exibição; null se não há cotação. */
  const rateOf = useCallback(
    (from: string | null | undefined) =>
      exchangeRateBetween(normalizeCurrencyCode(from, displayCurrency), displayCurrency, rates),
    [rates, displayCurrency],
  );

  /** true quando a fonte está numa moeda diferente da de exibição. */
  const isForeign = useCallback(
    (currency: string | null | undefined) =>
      !!currency && normalizeCurrencyCode(currency, displayCurrency) !== displayCurrency,
    [displayCurrency],
  );

  /** Lista de moedas ISO conhecidas pelo provedor (para os seletores). */
  const supportedCurrencies = useMemo(
    () => (rates ? Object.keys(rates).sort() : []),
    [rates],
  );

  return {
    displayCurrency,
    rates,
    supportedCurrencies,
    hasRates: !!rates,
    fetchedAt,
    isLoading,
    error,
    refresh,
    convert,
    convertLocked,
    rateOf,
    isForeign,
  };
}
