import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatMoney, formatMoneyCompact, parseMoneyInput } from '@/lib/finance/currency';

/**
 * Reexportado por conveniência: nos componentes usa antes `useMoneyFormat()`,
 * que já aplica a moeda de exibição escolhida em Finanças → Configurações.
 */
export { formatMoney, formatMoneyCompact, parseMoneyInput };

export function formatMonth(monthStr: string): string {
  // monthStr: 'YYYY-MM-DD'
  const d = parseISO(monthStr);
  return format(d, "MMM/yyyy", { locale: ptBR });
}

/** Eixo de gráficos em tela estreito: `04/26` em vez de `abr/2026`. */
export function formatMonthChartAxisShort(monthStr: string): string {
  const normalized =
    monthStr.length === 7 ? `${monthStr}-01` : monthStr.length >= 10 ? monthStr.slice(0, 10) : monthStr;
  const d = parseISO(normalized);
  if (Number.isNaN(d.getTime())) return monthStr;
  return format(d, 'MM/yy', { locale: ptBR });
}

/** Rótulo curto de coluna: `nov/26`. */
export function formatMonthShort(monthStr: string): string {
  return format(parseISO(monthStr.slice(0, 10)), 'MMM/yy', { locale: ptBR });
}

const amountPlainFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/**
 * Valor sem símbolo e sem centavos (`1.800`), para células apertadas de grade
 * em que a coluna já diz a moeda. Para valor solto, use `useMoneyFormat()`.
 */
export function formatAmountPlain(value: number): string {
  return amountPlainFormatter.format(Math.round(value));
}

/** Idem, com sinal explícito (`+2.700`, `−4.690`) para sobra e saldo. */
export function formatAmountSigned(value: number): string {
  const r = Math.round(value);
  if (r === 0) return '0';
  return (r > 0 ? '+' : '−') + amountPlainFormatter.format(Math.abs(r));
}

export function formatMonthLong(monthStr: string): string {
  const d = parseISO(monthStr);
  return format(d, "MMMM 'de' yyyy", { locale: ptBR });
}

export function formatMonthLabel(monthStr: string): string {
  const d = parseISO(monthStr);
  const label = format(d, "MMMM yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatDate(dateStr: string): string {
  const d = parseISO(dateStr);
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}
