/**
 * Planejamento de gastos (MLL-1) — cálculo puro, sem Supabase nem React.
 *
 * A tela soma "compras que eu quero fazer" por cima do que já existe e
 * mostra, mês a mês, quanto sobra e como fica o acumulado. Nada daqui é
 * gravado como lançamento: é simulação por decisão de produto.
 *
 * O acumulado segue a MESMA regra do dashboard e do SurplusChart: soma
 * corrida da sobra a partir do mês corrente (`runningSurplusTotalByMonth`).
 * Se cada tela acumulasse de um jeito, o planejamento diria uma coisa e o
 * dashboard outra — é a reclamação nº 1 de quem usa apps de projeção.
 *
 * Os tipos moram aqui (e não em types/finance.ts) porque só esta tela os usa,
 * no mesmo espírito dos tipos derivados de use-budget-allocation.
 */

import { normalizeSummaryMonthKey, shiftMonthBy } from '@/lib/finance/finance';
import type { MonthlySummary } from '@/types/finance';

/** Como a compra é paga. `installments` com 1 parcela = à vista. */
export type PlanPayMode = 'installments' | 'monthly' | 'yearly';

/** Linha de `finance_planned_purchases`. */
export type PlannedPurchase = {
  id: string;
  user_id: string;
  name: string;
  /** Parcelado: total da compra. Mensal/anual: valor de cada ocorrência. */
  amount: number;
  pay_mode: PlanPayMode;
  installments: number;
  /** Valor de cada parcela quando não são iguais; null = `amount` dividido igualmente. */
  installment_amounts: number[] | null;
  /** 'YYYY-MM-01': primeira parcela / ocorrência. */
  start_month: string;
  card_item_id: string | null;
  /** A chave "na conta". */
  is_included: boolean;
  sort_order: number;
  created_at: string;
};

/** O que a projeção precisa de uma compra (serve também para o rascunho da barra). */
export type PlanPurchaseShape = Pick<
  PlannedPurchase,
  'amount' | 'pay_mode' | 'installments' | 'installment_amounts' | 'start_month' | 'is_included'
>;

/** Mês da base, antes das compras. */
export type PlanningBaseMonth = {
  month: string;
  /** Receitas − despesas − lançamentos pontuais: o que sobra sem as compras. */
  free: number;
  /** true = além do horizonte da planilha, estimado pelos valores padrão. */
  estimated: boolean;
};

export type PlanningMonth = PlanningBaseMonth & {
  /** Soma das compras incluídas neste mês. */
  spent: number;
  /** Sobra depois das compras. */
  left: number;
  /** Soma corrida de `left` desde o primeiro mês (= mês corrente). */
  accumulated: number;
};

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Diferença em meses entre dois 'YYYY-MM-01' (b − a). */
export function monthDiff(a: string, b: string): number {
  const ya = Number(a.slice(0, 4));
  const ma = Number(a.slice(5, 7));
  const yb = Number(b.slice(0, 4));
  const mb = Number(b.slice(5, 7));
  return (yb - ya) * 12 + (mb - ma);
}

/** Valor de cada parcela. Sem `installment_amounts`, divide o total igualmente. */
export function installmentAmountsOf(
  p: Pick<PlannedPurchase, 'amount' | 'installments' | 'installment_amounts'>,
): number[] {
  if (p.installment_amounts && p.installment_amounts.length === p.installments) {
    return p.installment_amounts.map(Number);
  }
  const n = Math.max(1, p.installments);
  return Array.from({ length: n }, () => Number(p.amount) / n);
}

/** Quanto a compra pesa em cada um dos `months` (mesma ordem, mesmo tamanho). */
export function amountsByMonth(p: PlanPurchaseShape, months: string[]): number[] {
  const out = new Array<number>(months.length).fill(0);
  if (months.length === 0) return out;
  const startIdx = monthDiff(months[0], p.start_month);

  if (p.pay_mode === 'monthly') {
    for (let i = Math.max(0, startIdx); i < months.length; i++) out[i] = Number(p.amount);
  } else if (p.pay_mode === 'yearly') {
    for (let i = startIdx; i < months.length; i += 12) if (i >= 0) out[i] = Number(p.amount);
  } else {
    installmentAmountsOf(p).forEach((v, k) => {
      const i = startIdx + k;
      if (i >= 0 && i < months.length) out[i] = v;
    });
  }
  return out;
}

/**
 * Base dos meses: o que sobra antes das compras.
 *
 * Até o fim do horizonte da planilha vale `finance_monthly_summary` — são as
 * linhas reais, com o que foi digitado. Depois disso as linhas não existem
 * (a planilha só cria até `spreadsheet_months_forward`), então o mês é
 * estimado pelos valores padrão (`estimateFree`). Se além do horizonte houver
 * algum lançamento solto (um pontual digitado lá na frente), a sobra dele
 * entra por cima da estimativa — decisão do Pedro: estimar, não gravar linhas.
 */
export function buildBaseline(params: {
  months: string[];
  summaries: MonthlySummary[];
  /** Último mês com linhas reais na planilha ('YYYY-MM-01'). */
  horizonEnd: string;
  estimateFree: (month: string) => number;
}): PlanningBaseMonth[] {
  const byMonth = new Map(
    params.summaries.map((s) => [normalizeSummaryMonthKey(s.month), Number(s.surplus)]),
  );
  return params.months.map((month) => {
    const real = byMonth.get(month);
    if (month <= params.horizonEnd) return { month, free: real ?? 0, estimated: false };
    return { month, free: round2(params.estimateFree(month) + (real ?? 0)), estimated: true };
  });
}

/** Projeta os meses com as compras incluídas (a chave "na conta" ligada). */
export function projectMonths(
  base: PlanningBaseMonth[],
  purchases: PlanPurchaseShape[],
): PlanningMonth[] {
  const months = base.map((b) => b.month);
  const per = purchases.filter((p) => p.is_included).map((p) => amountsByMonth(p, months));
  let acc = 0;
  return base.map((b, i) => {
    const spent = per.reduce((s, a) => s + a[i], 0);
    const left = b.free - spent;
    acc += left;
    return { ...b, spent: round2(spent), left: round2(left), accumulated: round2(acc) };
  });
}

/** Mês de menor acumulado (o "ponto mais apertado"). */
export function lowestMonth(months: PlanningMonth[]): PlanningMonth | null {
  return months.reduce<PlanningMonth | null>(
    (low, m) => (low === null || m.accumulated < low.accumulated ? m : low),
    null,
  );
}

/**
 * Primeiro mês de início, a partir de `fromMonth`, em que a compra cabe sem o
 * acumulado ficar abaixo de `alertAmount` em nenhum mês da projeção.
 * Devolve null se não cabe em nenhum mês da base.
 */
export function firstFittingStart(
  base: PlanningBaseMonth[],
  purchases: PlanPurchaseShape[],
  draft: PlanPurchaseShape,
  alertAmount: number,
  fromMonth: string,
): string | null {
  for (const b of base) {
    if (b.month < fromMonth) continue;
    const low = lowestMonth(projectMonths(base, [...purchases, { ...draft, start_month: b.month }]));
    if (low && low.accumulated >= alertAmount) return b.month;
  }
  return null;
}

/** Patch de uma compra com valores por parcela: o total sempre é a soma. */
export type InstallmentsPatch = Pick<PlannedPurchase, 'amount' | 'installments' | 'installment_amounts'>;

/** Parcelas todas iguais (ao centavo) voltam a ser "Nx de R$ X": sem array. */
function normalizeParts(parts: number[]): InstallmentsPatch {
  const rounded = parts.map(round2);
  const amount = round2(rounded.reduce((s, x) => s + x, 0));
  const allEqual = rounded.every((x) => x === rounded[0]);
  return { amount, installments: rounded.length, installment_amounts: allEqual ? null : rounded };
}

/** Troca o valor de uma parcela; o total passa a ser a soma. */
export function setInstallment(
  p: Pick<PlannedPurchase, 'amount' | 'installments' | 'installment_amounts'>,
  index: number,
  value: number,
): InstallmentsPatch {
  const parts = installmentAmountsOf(p);
  parts[index] = Math.max(0, value);
  return normalizeParts(parts);
}

/**
 * Muda o número de parcelas. Com parcelas iguais, o total fica e a divisão
 * muda; com parcelas diferentes, corta do fim ou repete a última — reescrever
 * a entrada que o usuário digitou à mão seria pior.
 */
export function resizeInstallments(
  p: Pick<PlannedPurchase, 'amount' | 'installments' | 'installment_amounts'>,
  n: number,
): InstallmentsPatch {
  const size = Math.max(1, Math.min(72, Math.round(n)));
  if (!p.installment_amounts) return { amount: Number(p.amount), installments: size, installment_amounts: null };
  const parts = p.installment_amounts.slice(0, size).map(Number);
  while (parts.length < size) parts.push(parts[parts.length - 1]);
  return normalizeParts(parts);
}

/** Último mês da compra, para o texto "nov/26 a ago/27". */
export function lastInstallmentMonth(p: Pick<PlannedPurchase, 'start_month' | 'installments'>): string {
  return shiftMonthBy(p.start_month, Math.max(1, p.installments) - 1);
}
