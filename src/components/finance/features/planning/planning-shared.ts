import { formatMonthShort } from '@/lib/finance/format';
import {
  installmentAmountsOf,
  lastInstallmentMonth,
  type PlanPayMode,
  type PlannedPurchase,
  type PlanPurchaseShape,
} from '@/lib/finance/planning';

/**
 * "Como paga" é um campo só: à vista, 2x…24x, todo mês ou todo ano. Juntar
 * modo e número de parcelas num seletor evita a pergunta "qual tipo?" antes de
 * digitar — foi o que deixou a primeira versão do mock confusa.
 */
export type PayChoice = string; // '1'…'24' | 'monthly' | 'yearly'

export const PAY_CHOICES: { value: PayChoice; label: string }[] = [
  { value: '1', label: 'À vista' },
  ...Array.from({ length: 23 }, (_, k) => ({ value: String(k + 2), label: `${k + 2}x` })),
  { value: 'monthly', label: 'Todo mês' },
  { value: 'yearly', label: 'Todo ano' },
];

export function payChoiceOf(p: Pick<PlannedPurchase, 'pay_mode' | 'installments'>): PayChoice {
  return p.pay_mode === 'installments' ? String(p.installments) : p.pay_mode;
}

export function parsePayChoice(choice: PayChoice): { pay_mode: PlanPayMode; installments: number } {
  if (choice === 'monthly' || choice === 'yearly') return { pay_mode: choice, installments: 1 };
  return { pay_mode: 'installments', installments: Math.max(1, Number(choice) || 1) };
}

export const isSplit = (p: Pick<PlannedPurchase, 'pay_mode' | 'installments'>) =>
  p.pay_mode === 'installments' && p.installments > 1;

/** Linha cinza embaixo do nome: "10x de R$ 890 · nov/26 a ago/27". */
export function describePurchase(
  p: Pick<PlannedPurchase, 'amount' | 'pay_mode' | 'installments' | 'installment_amounts' | 'start_month'>,
  money: (v: number) => string,
): string {
  if (p.pay_mode === 'monthly') return `${money(p.amount)} todo mês desde ${formatMonthShort(p.start_month)}`;
  if (p.pay_mode === 'yearly') {
    return `${money(p.amount)} todo ${formatMonthShort(p.start_month).slice(0, 3)}`;
  }
  if (p.installments <= 1) return `à vista em ${formatMonthShort(p.start_month)}`;
  const span = `${formatMonthShort(p.start_month)} a ${formatMonthShort(lastInstallmentMonth(p))}`;
  if (p.installment_amounts) return `${p.installments}x variáveis · ${money(p.amount)} · ${span}`;
  return `${p.installments}x de ${money(installmentAmountsOf(p)[0])} · ${span}`;
}

/** Estado da barra de adicionar (controlada pelo Planning, que desenha a prévia). */
export type AddBarForm = {
  name: string;
  amountRaw: string;
  /** No parcelado: o valor digitado é o total ou o de cada parcela. */
  unit: 'total' | 'installment';
  pay: PayChoice;
  start: string;
};

/**
 * Rascunho para a prévia; null enquanto não tem valor. O campo é
 * `type="number"`, então `amountRaw` já vem com ponto decimal — não passa por
 * `parseMoneyInput`, que lê "9.000" como 9.
 */
export function draftFromForm(form: AddBarForm): PlanPurchaseShape | null {
  const typed = Number(form.amountRaw);
  if (!Number.isFinite(typed) || typed <= 0) return null;
  const { pay_mode, installments } = parsePayChoice(form.pay);
  const amount = pay_mode === 'installments' && installments > 1 && form.unit === 'installment'
    ? typed * installments
    : typed;
  return {
    amount: Math.round(amount * 100) / 100,
    pay_mode,
    installments,
    installment_amounts: null,
    start_month: form.start,
    is_included: true,
  };
}

/** Classes do input nativo, iguais às dos formulários do módulo. */
export const fieldClass =
  'w-full h-10 px-3 rounded-lg bg-surface-1 border border-border-strong text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
