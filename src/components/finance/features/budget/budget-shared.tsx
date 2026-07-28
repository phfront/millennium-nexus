import type { BudgetBucket, BudgetBucketKey } from '@/hooks/finance/use-budget-allocation';

export const BUCKET_LABEL: Record<BudgetBucketKey, string> = {
  essential: 'Obrigatórias',
  optional: 'Opcionais',
  investment: 'Investimento',
};

export const BUCKET_COLOR: Record<BudgetBucketKey, string> = {
  essential: 'var(--finance-budget-essential)',
  optional: 'var(--finance-budget-optional)',
  investment: 'var(--finance-budget-investment)',
};

export const BUCKET_ORDER: BudgetBucketKey[] = ['essential', 'optional', 'investment'];

export const UNCLASSIFIED_COLOR = 'var(--color-warning)';
export const UNALLOCATED_COLOR = 'var(--color-border-strong)';

/**
 * O alvo não quer dizer o mesmo nos três baldes: nas obrigatórias e nas
 * opcionais é um teto (gastar menos não é mérito, é só não estourar), no
 * investimento é um piso (aí sim, mais é melhor).
 */
export function isCeiling(key: BudgetBucketKey): boolean {
  return key !== 'investment';
}

export type BucketTone = 'over' | 'under' | 'met' | 'short';

export function bucketTone(bucket: BudgetBucket): BucketTone {
  if (isCeiling(bucket.key)) return bucket.delta < 0 ? 'over' : 'under';
  return bucket.delta <= 0 ? 'met' : 'short';
}

/** Só o estouro e a meta cumprida merecem cor; o resto é informação. */
export const TONE_CHIP: Record<BucketTone, string> = {
  over: 'border-danger-border bg-danger-bg text-danger',
  under: 'border-border bg-surface-3 text-text-secondary',
  met: 'border-success-border bg-success-bg text-success',
  short: 'border-warning-border bg-warning-bg text-warning',
};

export function formatPct(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(1).replace('.', ',')}%`;
}

/** Diferença em pontos percentuais, com sinal — para comparar meses. */
export function formatPp(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(1).replace('.', ',')} p.p.`;
}

export function Swatch({ color }: { color: string }) {
  return (
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-sm"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

/**
 * Faixa de excesso: risca em vez de uma segunda cor quente, que sobre o
 * laranja das opcionais quase não se distinguia.
 */
export const OVERSPILL_BACKGROUND =
  'repeating-linear-gradient(135deg, var(--color-danger) 0 4px, transparent 4px 8px), var(--color-danger-bg)';
