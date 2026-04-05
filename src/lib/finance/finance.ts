import type { ExpenseEntry, MonthlySummary } from '@/types/finance';

export function monthlySurplus(income: number, expenses: number, oneTime: number): number {
  return income - expenses - oneTime;
}

export function accumulatedSurplus(months: { month: string; surplus: number }[]): number[] {
  let acc = 0;
  return months.map((m) => {
    acc += m.surplus;
    return acc;
  });
}

export function monthlyIncomeTotal(amounts: (number | null | undefined)[]): number {
  return amounts.reduce<number>((sum, v) => sum + (v ?? 0), 0);
}

export function monthlyExpensesTotal(amounts: (number | null | undefined)[]): number {
  return amounts.reduce<number>((sum, v) => sum + (v ?? 0), 0);
}

/** Normaliza `month` de entradas (`YYYY-MM-DD` ou prefixo) para comparação. */
export function normalizeExpenseMonthKey(m: string): string {
  if (!m) return '';
  return m.length >= 10 ? m.slice(0, 10) : m;
}

export function expenseEntriesForMonth(entries: ExpenseEntry[], month: string): ExpenseEntry[] {
  const mk = normalizeExpenseMonthKey(month);
  return entries.filter((e) => normalizeExpenseMonthKey(e.month) === mk);
}

export function paymentProgress(
  expenseEntries: ExpenseEntry[],
  oneTimeRows: { amount: number; is_paid: boolean }[] = [],
): {
  paid: number;
  total: number;
  percent: number;
} {
  const fixed = expenseEntries.filter((e) => e.amount > 0);
  const one = oneTimeRows.filter((e) => e.amount > 0);
  const total = fixed.length + one.length;
  const paid =
    fixed.filter((e) => e.is_paid).length + one.filter((e) => e.is_paid).length;
  return { paid, total, percent: total === 0 ? 0 : Math.round((paid / total) * 100) };
}

export function subscriptionMonthlyTotal(
  subs: { amount: number; billing_cycle: string; is_active: boolean }[],
): number {
  return subs
    .filter((s) => s.is_active)
    .reduce((sum, s) => {
      const monthly = s.billing_cycle === 'yearly' ? s.amount / 12 : s.amount;
      return sum + monthly;
    }, 0);
}

/** Valor ainda em aberto (não pode ser negativo). */
export function receivableOutstanding(item: { amount: number; amount_paid?: number }): number {
  const total = Number(item.amount ?? 0);
  const paid = Number(item.amount_paid ?? 0);
  return Math.max(0, total - paid);
}

export function receivableIsFullyPaid(item: { amount: number; amount_paid?: number }): boolean {
  return receivableOutstanding(item) <= 0;
}

export function receivablesTotalPending(
  items: { amount: number; amount_paid?: number; is_paid?: boolean }[],
): number {
  return items.reduce((sum, i) => sum + receivableOutstanding(i), 0);
}

export function toMonthDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export function getPreviousMonth(monthStr: string): string {
  const d = new Date(monthStr + 'T00:00:00');
  d.setMonth(d.getMonth() - 1);
  return toMonthDate(d);
}

export function getNextMonth(monthStr: string): string {
  const d = new Date(monthStr + 'T00:00:00');
  d.setMonth(d.getMonth() + 1);
  return toMonthDate(d);
}

export function buildMonthRange(fromMonth: string, toMonth: string): string[] {
  const months: string[] = [];
  let current = fromMonth;
  while (current <= toMonth) {
    months.push(current);
    current = getNextMonth(current);
  }
  return months;
}

/** Converte valor de `<input type="month">` (YYYY-MM) para o primeiro dia (`YYYY-MM-01`). */
export function monthInputValueToFirstDay(ym: string): string {
  if (!ym || ym.length < 7) return toMonthDate(new Date());
  return `${ym.slice(0, 7)}-01`;
}

/** Converte `YYYY-MM-01` (ou prefixo) para valor de `<input type="month">` (YYYY-MM). */
export function firstDayToMonthInputValue(monthDay: string): string {
  if (!monthDay || monthDay.length < 7) return '';
  return monthDay.slice(0, 7);
}

/** Quantidade padrão de meses futuros incluídos nas planilhas (antes de gravar preferência). */
export const DEFAULT_SPREADSHEET_MONTHS_FORWARD = 3;

/** Avança ou recua N meses a partir de `monthStr` (YYYY-MM-DD). */
export function shiftMonthBy(monthStr: string, delta: number): string {
  let m = monthStr;
  const steps = Math.abs(delta);
  const forward = delta >= 0;
  for (let i = 0; i < steps; i++) {
    m = forward ? getNextMonth(m) : getPreviousMonth(m);
  }
  return m;
}

/**
 * Meses exibidos nas planilhas: todos os meses com dados + mês atual + N meses seguintes (planeamento).
 */
/**
 * Último mês do horizonte planeável: mês de referência + N meses à frente
 * (mesma regra que `buildSpreadsheetMonthList` e `maxPlanningMonth` no contexto).
 */
export function maxSpreadsheetPlanningMonth(
  monthsForward: number,
  referenceDate: Date = new Date(),
): string {
  const todayKey = toMonthDate(referenceDate);
  const n = Math.max(0, Math.min(36, Math.round(monthsForward)));
  return shiftMonthBy(todayKey, n);
}

export function buildSpreadsheetMonthList(entryMonths: string[], monthsForward: number): string[] {
  const today = toMonthDate(new Date());
  const set = new Set<string>();
  for (const raw of entryMonths) {
    if (!raw) continue;
    const norm = raw.length >= 10 ? raw.slice(0, 10) : raw;
    set.add(norm);
  }
  set.add(today);
  let m = today;
  const n = Math.max(0, Math.min(36, Math.round(monthsForward)));
  for (let i = 0; i < n; i++) {
    m = getNextMonth(m);
    set.add(m);
  }
  return orderSpreadsheetMonths([...set], today);
}

/**
 * Ordem nas planilhas: mês corrente primeiro, depois meses futuros (cronológico),
 * por fim passados (do mais recente ao mais antigo).
 */
export function orderSpreadsheetMonths(months: string[], today: string): string[] {
  const unique = [...new Set(months)];
  const futures = unique.filter((x) => x > today).sort((a, b) => a.localeCompare(b));
  const pasts = unique.filter((x) => x < today).sort((a, b) => b.localeCompare(a));
  const hasCurrent = unique.includes(today);
  return [...(hasCurrent ? [today] : []), ...futures, ...pasts];
}

export function surplusColor(value: number): string {
  if (value > 0) return 'text-green-500';
  if (value < 0) return 'text-red-500';
  return 'text-text-secondary';
}

export function summaryLast12Months(summaries: MonthlySummary[]): MonthlySummary[] {
  return [...summaries]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);
}

/** Intervalo do gráfico de visão geral no dashboard. */
export type FinanceOverviewChartRange = '6m' | '12m' | '24m' | 'ytd' | 'all';

export const FINANCE_OVERVIEW_CHART_RANGE_LABELS: Record<FinanceOverviewChartRange, string> = {
  '6m': '6 m à frente',
  '12m': '12 m à frente',
  '24m': '24 m à frente',
  ytd: 'Ano atual',
  all: 'Tudo',
};

/**
 * Filtra resumos mensais para o gráfico (sempre ordenados por `month`).
 * `6m` / `12m` / `24m` = mês atual (`referenceDate`) e os N−1 meses seguintes com dados.
 * `ytd` = meses do ano civil de `referenceDate` presentes nos dados.
 */
export function filterSummariesForChartRange(
  summaries: MonthlySummary[],
  range: FinanceOverviewChartRange,
  referenceDate: Date = new Date(),
): MonthlySummary[] {
  const sorted = [...summaries].sort((a, b) => a.month.localeCompare(b.month));
  if (sorted.length === 0) return sorted;
  if (range === 'all') return sorted;
  if (range === 'ytd') {
    const y = referenceDate.getFullYear();
    const ys = String(y);
    return sorted.filter((s) => s.month.slice(0, 4) === ys);
  }
  const n = range === '6m' ? 6 : range === '12m' ? 12 : 24;
  const fromKey = toMonthDate(referenceDate);
  const forward = sorted.filter((s) => {
    const mk = s.month.length >= 10 ? s.month.slice(0, 10) : s.month;
    return mk >= fromKey;
  });
  return forward.slice(0, n);
}
