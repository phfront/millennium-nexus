'use client';

import { useMemo } from 'react';
import { Select } from '@phfront/millennium-ui';
import { currencyName, DEFAULT_DISPLAY_CURRENCY } from '@/lib/finance/currency';

/** Moedas mais prováveis primeiro; o resto vem do provedor de câmbio, por ordem alfabética. */
const PINNED = ['BRL', 'USD', 'EUR', 'GBP', 'CHF', 'ARS', 'CAD', 'AUD', 'JPY', 'CNY'];

/** Valor usado pelo `Select` para "segue a moeda padrão" (o Select não lida com ''). */
const DEFAULT_OPTION_VALUE = '__default__';

/** Fallback quando ainda não há cotações carregadas — o usuário nunca fica sem escolha. */
const FALLBACK_CODES = PINNED;

export type CurrencySelectProps = {
  /** Código ISO, ou `null` para "moeda padrão" (só válido com `allowDefault`). */
  value: string | null;
  onChange: (currency: string | null) => void;
  /** Adiciona a opção "Moeda padrão", que devolve `null`. */
  allowDefault?: boolean;
  /** Código mostrado na opção "Moeda padrão", ex.: `BRL`. */
  defaultCurrency?: string;
  /** Códigos suportados pelo provedor; vazio cai no `FALLBACK_CODES`. */
  supportedCurrencies?: string[];
  label?: string;
  helperText?: string;
  disabled?: boolean;
  className?: string;
};

export function CurrencySelect({
  value,
  onChange,
  allowDefault = false,
  defaultCurrency = DEFAULT_DISPLAY_CURRENCY,
  supportedCurrencies,
  label,
  helperText,
  disabled = false,
  className,
}: CurrencySelectProps) {
  const options = useMemo(() => {
    const available = supportedCurrencies?.length ? supportedCurrencies : FALLBACK_CODES;
    // Garante que a moeda já guardada aparece mesmo que o provedor não a liste.
    const codes = new Set([...available, ...(value ? [value] : []), defaultCurrency]);
    const pinned = PINNED.filter((c) => codes.has(c));
    const rest = [...codes].filter((c) => !PINNED.includes(c)).sort();

    const list = [...pinned, ...rest].map((code) => ({
      value: code,
      label: `${code} — ${currencyName(code)}`,
    }));

    return allowDefault
      ? [{ value: DEFAULT_OPTION_VALUE, label: `Moeda padrão (${defaultCurrency})` }, ...list]
      : list;
  }, [supportedCurrencies, value, defaultCurrency, allowDefault]);

  return (
    <Select
      className={className}
      label={label}
      helperText={helperText}
      disabled={disabled}
      searchable
      placeholder="Seleciona a moeda"
      options={options}
      value={value ?? (allowDefault ? DEFAULT_OPTION_VALUE : '')}
      onChange={(next: string) => onChange(next === DEFAULT_OPTION_VALUE ? null : next)}
    />
  );
}
