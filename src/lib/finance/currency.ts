/**
 * Moeda no módulo Finanças.
 *
 * - A moeda de exibição (`display_currency`) só muda a formatação: nenhum valor
 *   guardado é reescrito quando o usuário a troca.
 * - Fontes de renda com `currency` própria guardam o valor na moeda delas; a
 *   conversão para a moeda de exibição usa a cotação atual (ver
 *   `use-exchange-rates`), portanto o valor apresentado acompanha o câmbio.
 */

export const DEFAULT_DISPLAY_CURRENCY = 'BRL';

/** Locale usado para formatar: mantém o padrão pt-BR do resto do módulo. */
const MONEY_LOCALE = 'pt-BR';

export function isCurrencyCode(raw: unknown): raw is string {
  return typeof raw === 'string' && /^[A-Z]{3}$/.test(raw);
}

/** Normaliza o que vier da BD/input para um código ISO-4217 válido. */
export function normalizeCurrencyCode(raw: unknown, fallback = DEFAULT_DISPLAY_CURRENCY): string {
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return isCurrencyCode(code) ? code : fallback;
}

/** Igual a `normalizeCurrencyCode` mas mantém `null` (= "moeda padrão"). */
export function normalizeOptionalCurrencyCode(raw: unknown): string | null {
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return isCurrencyCode(code) ? code : null;
}

function moneyFormatter(currency: string, compact: boolean): Intl.NumberFormat {
  const options: Intl.NumberFormatOptions = compact
    ? { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }
    : { style: 'currency', currency, minimumFractionDigits: 2 };
  try {
    return new Intl.NumberFormat(MONEY_LOCALE, options);
  } catch {
    // Código fora do ISO-4217 (ou não suportado pelo runtime) — cai no padrão.
    return new Intl.NumberFormat(MONEY_LOCALE, { ...options, currency: DEFAULT_DISPLAY_CURRENCY });
  }
}

export function formatMoney(value: number, currency = DEFAULT_DISPLAY_CURRENCY): string {
  return moneyFormatter(normalizeCurrencyCode(currency), false).format(value);
}

export function formatMoneyCompact(value: number, currency = DEFAULT_DISPLAY_CURRENCY): string {
  if (Math.abs(value) >= 1_000_000) {
    return moneyFormatter(normalizeCurrencyCode(currency), true).format(value);
  }
  return formatMoney(value, currency);
}

/** Símbolo curto para rótulos, ex.: `R$`, `US$`, `€`. Cai no código se não houver. */
export function currencySymbol(currency = DEFAULT_DISPLAY_CURRENCY): string {
  const code = normalizeCurrencyCode(currency);
  try {
    const part = new Intl.NumberFormat(MONEY_LOCALE, { style: 'currency', currency: code })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part?.value ?? code;
  } catch {
    return code;
  }
}

/** Nome da moeda em pt-BR, ex.: `Real brasileiro`. Cai no código se não houver. */
export function currencyName(currency: string): string {
  const code = normalizeCurrencyCode(currency, currency);
  try {
    const name = new Intl.DisplayNames([MONEY_LOCALE], { type: 'currency' }).of(code);
    return name && name !== code ? name : code;
  } catch {
    return code;
  }
}

/** Aceita `1.234,56`, `1234.56`, `R$ 1.234,56` — mesma tolerância do input antigo. */
export function parseMoneyInput(raw: string): number {
  const cleaned = raw.replace(/[^\d,.-]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/**
 * Converte `amount` de `from` para `to` com cotações em unidades por 1 USD.
 * Sem cotação para algum dos lados devolve o valor intacto (mesmo fallback do
 * `finance_fx_factor` na BD) — melhor mostrar o número original do que zero.
 */
export function convertMoney(
  amount: number,
  from: string | null | undefined,
  to: string,
  ratesPerUsd: Record<string, number> | null | undefined,
): number {
  const src = normalizeCurrencyCode(from, to);
  const dst = normalizeCurrencyCode(to);
  if (src === dst) return amount;
  const fromRate = ratesPerUsd?.[src];
  const toRate = ratesPerUsd?.[dst];
  if (!fromRate || !toRate) return amount;
  return (amount * toRate) / fromRate;
}

/** Cotação de 1 unidade de `from` em `to` (para mostrar "1 USD = 5,42 BRL"). */
export function exchangeRateBetween(
  from: string,
  to: string,
  ratesPerUsd: Record<string, number> | null | undefined,
): number | null {
  const src = normalizeCurrencyCode(from);
  const dst = normalizeCurrencyCode(to);
  if (src === dst) return 1;
  const fromRate = ratesPerUsd?.[src];
  const toRate = ratesPerUsd?.[dst];
  if (!fromRate || !toRate) return null;
  return toRate / fromRate;
}
