import {
  format,
  formatDistanceToNow,
  parseISO,
  isValid,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type DateInput = Date | string | number;

function toDate(input: DateInput): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'number') return new Date(input);
  const parsed = parseISO(input);
  return isValid(parsed) ? parsed : new Date(input);
}

export function formatDate(date: DateInput, fmt = 'dd/MM/yyyy'): string {
  return format(toDate(date), fmt, { locale: ptBR });
}

export function formatDatetime(date: DateInput): string {
  return format(toDate(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatRelative(date: DateInput): string {
  return formatDistanceToNow(toDate(date), { addSuffix: true, locale: ptBR });
}

export function formatDateRange(start: DateInput, end: DateInput): string {
  const s = toDate(start);
  const e = toDate(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  const startFmt = sameYear ? 'dd/MM' : 'dd/MM/yyyy';
  return `${format(s, startFmt, { locale: ptBR })} – ${format(e, 'dd/MM/yyyy', { locale: ptBR })}`;
}
