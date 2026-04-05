import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatBRLCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
  return formatBRL(value);
}

export function formatMonth(monthStr: string): string {
  // monthStr: 'YYYY-MM-DD'
  const d = parseISO(monthStr);
  return format(d, "MMM/yyyy", { locale: ptBR });
}

/** Eixo de gráficos em ecrã estreito: `04/26` em vez de `abr/2026`. */
export function formatMonthChartAxisShort(monthStr: string): string {
  const normalized =
    monthStr.length === 7 ? `${monthStr}-01` : monthStr.length >= 10 ? monthStr.slice(0, 10) : monthStr;
  const d = parseISO(normalized);
  if (Number.isNaN(d.getTime())) return monthStr;
  return format(d, 'MM/yy', { locale: ptBR });
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

export function parseBRLInput(raw: string): number {
  const cleaned = raw.replace(/[^\d,.-]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}
