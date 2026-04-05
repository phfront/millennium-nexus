import {
  differenceInDays,
  subDays,
  addDays,
  parseISO,
  format,
  isAfter,
  isBefore,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { WeightLog } from '@/types/health';

export function movingAverage7d(logs: WeightLog[]): { date: string; avg: number }[] {
  return logs.map((log) => {
    const logDate = parseISO(log.logged_at);
    const windowStart = subDays(logDate, 6);
    const windowLogs = logs.filter((l) => {
      const d = parseISO(l.logged_at);
      return !isBefore(d, windowStart) && !isAfter(d, logDate);
    });
    const avg = windowLogs.reduce((s, l) => s + l.weight, 0) / windowLogs.length;
    return { date: log.logged_at, avg: Math.round(avg * 10) / 10 };
  });
}

/** Perda em kg/semana nas últimas 4 semanas (positivo = perdendo peso). */
export function weeklyRate(logs: WeightLog[]): number | null {
  if (logs.length < 2) return null;
  const sorted = [...logs].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  const recent = sorted[sorted.length - 1];
  const cutoff = subDays(parseISO(recent.logged_at), 28);
  const reference = sorted.find((l) => !isAfter(parseISO(l.logged_at), cutoff));
  if (!reference) {
    // Menos de 28 dias de dados — usa o mais antigo disponível
    const oldest = sorted[0];
    if (oldest.logged_at === recent.logged_at) return null;
    const days = differenceInDays(parseISO(recent.logged_at), parseISO(oldest.logged_at));
    if (days === 0) return null;
    return (oldest.weight - recent.weight) / (days / 7);
  }
  const days = differenceInDays(parseISO(recent.logged_at), parseISO(reference.logged_at));
  if (days === 0) return null;
  return (reference.weight - recent.weight) / (days / 7);
}

/** Data projetada para atingir target_weight com base no ritmo atual. */
export function projectedDate(
  currentWeight: number,
  targetWeight: number,
  weeklyRateKg: number,
): Date | null {
  if (weeklyRateKg <= 0) return null;
  const weeksNeeded = (currentWeight - targetWeight) / weeklyRateKg;
  return addDays(new Date(), Math.round(weeksNeeded * 7));
}

export function formatDatePtBR(dateStr: string): string {
  try {
    return format(parseISO(dateStr + 'T12:00:00'), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

export function formatWeightDiff(diff: number): string {
  const sign = diff < 0 ? '−' : diff > 0 ? '+' : '';
  return `${sign}${Math.abs(diff).toFixed(1)} kg`;
}

export function calcBmi(weight: number, heightCm: number): number {
  const h = heightCm / 100;
  return Math.round((weight / (h * h)) * 10) / 10;
}

export function bmiLabel(bmi: number): string {
  if (bmi < 18.5) return 'Baixo peso';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Sobrepeso';
  return 'Obesidade';
}
