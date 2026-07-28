'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowDown, ArrowUp, Check, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Badge, Button, MonthStepper, Skeleton } from '@phfront/millennium-ui';
import { useBudgetAllocation, type BudgetBucketKey, type BudgetMonth } from '@/hooks/finance/use-budget-allocation';
import { useBudgetBreakdown, type BudgetLine } from '@/hooks/finance/use-budget-breakdown';
import { useMoneyFormat, type MoneyFormat } from '@/hooks/finance/use-money-format';
import { useFinanceSpreadsheetSettings } from '@/contexts/FinanceSpreadsheetSettingsContext';
import { getNextMonth, getPreviousMonth } from '@/lib/finance/finance';
import { useInitialFinanceMonth } from '@/hooks/finance/use-initial-finance-month';
import { formatMonthLabel } from '@/lib/finance/format';
import { BudgetTrend } from '@/components/finance/features/budget/BudgetTrend';
import { BudgetPlanVsReal } from '@/components/finance/features/budget/BudgetPlanVsReal';
import { BudgetSignals } from '@/components/finance/features/budget/BudgetSignals';
import { BucketDetailModal } from '@/components/finance/features/budget/BucketDetailModal';
import {
  BUCKET_COLOR,
  BUCKET_LABEL,
  BUCKET_ORDER,
  OVERSPILL_BACKGROUND,
  Swatch,
  TONE_CHIP,
  bucketTone,
  formatPct,
  formatPp,
  isCeiling,
} from '@/components/finance/features/budget/budget-shared';

/** Quantos lançamentos cabem no cartão antes de valer a pena abrir o detalhe. */
const CARD_PREVIEW_LINES = 3;

function BucketCard({
  bucket,
  month,
  previous,
  lines,
  linesLoading,
  money,
  onOpenDetail,
}: {
  bucket: BudgetMonth['buckets'][BudgetBucketKey];
  month: BudgetMonth;
  /** Mês anterior, para a variação; null quando não há histórico. */
  previous: BudgetMonth | null;
  lines: BudgetLine[];
  linesLoading: boolean;
  money: MoneyFormat;
  onOpenDetail: () => void;
}) {
  const color = BUCKET_COLOR[bucket.key];
  const tone = bucketTone(bucket);
  const ceiling = isCeiling(bucket.key);
  const meterMax = Math.max(bucket.targetAmount, bucket.amount);
  const fillPct = meterMax > 0 ? (Math.min(bucket.amount, bucket.targetAmount) / meterMax) * 100 : 0;
  const overPct = meterMax > 0 && tone === 'over' ? ((bucket.amount - bucket.targetAmount) / meterMax) * 100 : 0;
  const tickPct = meterMax > 0 ? (bucket.targetAmount / meterMax) * 100 : 0;
  const preview = lines.slice(0, CARD_PREVIEW_LINES);

  const prevBucket = previous && !previous.isEmpty ? previous.buckets[bucket.key] : null;
  const deltaPp = prevBucket ? bucket.sharePct - prevBucket.sharePct : null;

  return (
    <section className="flex flex-col rounded-xl border border-border bg-surface-2 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Swatch color={color} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
          {BUCKET_LABEL[bucket.key]}
        </span>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-text-muted">
          {ceiling ? 'teto' : 'piso'} {formatPct(bucket.targetPct)}
        </span>
      </div>

      <div className="text-2xl font-semibold leading-tight tracking-tight text-text-primary">
        {money.format(bucket.amount)}
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        {month.isEmpty ? (
          <span className="text-text-muted">Sem receita lançada neste mês</span>
        ) : (
          <>
            <strong className="font-semibold text-text-primary">{formatPct(bucket.sharePct)}</strong>{' '}
            da base · {ceiling ? 'teto' : 'meta'} {money.format(bucket.targetAmount)}
            {deltaPp !== null && Math.abs(deltaPp) >= 0.05 && (
              <span className="text-text-muted">
                {' '}
                · {formatPp(deltaPp)} vs {formatMonthLabel(previous!.month)}
              </span>
            )}
          </>
        )}
      </p>

      {!month.isEmpty && (
        <>
          <div className="relative mt-3 flex h-2 gap-0.5 rounded-full bg-surface-3">
            <div className="rounded-full" style={{ width: `${fillPct}%`, backgroundColor: color }} />
            {overPct > 0 && (
              <div
                className="rounded-full"
                style={{ width: `calc(${overPct}% - 2px)`, background: OVERSPILL_BACKGROUND }}
              />
            )}
            <div
              className="absolute -top-1 -bottom-1 w-0.5 bg-text-primary/55"
              style={{ left: `min(${tickPct}%, calc(100% - 2px))` }}
              aria-hidden
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-text-muted">
            <span>{money.format(0)}</span>
            <span>
              {ceiling ? 'teto' : 'meta'} {money.format(bucket.targetAmount)}
            </span>
          </div>

          <span
            className={`mt-3 inline-flex items-center gap-1.5 self-start rounded-full border px-2 py-1 text-[11px] font-semibold tabular-nums ${TONE_CHIP[tone]}`}
          >
            {tone === 'over' && (
              <>
                <ArrowUp size={12} strokeWidth={2.4} />
                {money.format(-bucket.delta)} acima do teto
              </>
            )}
            {tone === 'under' && (
              <>
                {money.format(bucket.delta)} abaixo do teto
              </>
            )}
            {tone === 'short' && (
              <>
                <ArrowDown size={12} strokeWidth={2.4} />
                Faltam {money.format(bucket.delta)}
              </>
            )}
            {tone === 'met' && (
              <>
                <Check size={12} strokeWidth={2.4} />
                Meta cumprida
              </>
            )}
          </span>

          <div className="mt-3 border-t border-border pt-2.5">
            {linesLoading ? (
              <p className="text-[11px] text-text-muted">A carregar os lançamentos…</p>
            ) : lines.length === 0 ? (
              <p className="text-[11px] leading-relaxed text-text-muted">
                {bucket.key === 'investment'
                  ? 'Nenhum aporte lançado. Um item de despesa marcado como Investimento é o que faz este balde encher.'
                  : 'Nenhum lançamento neste balde.'}
              </p>
            ) : (
              <>
                <ul className="flex flex-col gap-1 text-xs">
                  {preview.map((l) => (
                    <li key={l.id} className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-text-secondary">{l.name}</span>
                      <span className="shrink-0 tabular-nums text-text-primary">
                        {money.format(l.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={onOpenDetail}
                  className="mt-2 cursor-pointer rounded text-[11px] font-semibold text-text-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-text-primary"
                >
                  {lines.length > CARD_PREVIEW_LINES
                    ? `Ver os ${lines.length} lançamentos`
                    : 'Ver detalhe'}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function BudgetView() {
  const money = useMoneyFormat();
  const { maxPlanningMonth } = useFinanceSpreadsheetSettings();
  const [month, setMonth] = useInitialFinanceMonth(maxPlanningMonth);
  const [detail, setDetail] = useState<BudgetBucketKey | null>(null);

  const {
    isLoading,
    getMonth,
    getTrend,
    hasForeignIncome,
    ratesFetchedAt,
    ratesUnavailable,
  } = useBudgetAllocation();
  const { breakdown, isLoading: breakdownLoading } = useBudgetBreakdown(month);

  const b = getMonth(month);
  const previous = useMemo(() => getMonth(getPreviousMonth(month)), [getMonth, month]);
  const trend = useMemo(() => getTrend(month, 12), [getTrend, month]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MonthStepper
          label={formatMonthLabel(month)}
          onPrev={() => setMonth(getPreviousMonth(month))}
          onNext={() => setMonth(getNextMonth(month))}
          disableNext={month >= maxPlanningMonth}
        />
        <Link
          href="/finance/settings"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:bg-surface-3 hover:text-text-primary"
        >
          <SlidersHorizontal size={13} />
          Alvos {formatPct(b.buckets.essential.targetPct)} /{' '}
          {formatPct(b.buckets.optional.targetPct)} / {formatPct(b.buckets.investment.targetPct)}
        </Link>
      </div>

      {/* Sem cotação, as receitas em moeda estrangeira entram sem converter e
          TODOS os percentuais desta tela ficam errados — em silêncio. */}
      {ratesUnavailable && (
        <div
          className="flex items-start gap-3 rounded-xl border border-danger-border bg-danger-bg px-4 py-3"
          role="alert"
        >
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-danger" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">Sem cotação de câmbio</p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              Tens receitas em moeda estrangeira, mas as cotações não carregaram. Os valores estão a
              ser somados sem conversão, por isso a base e todos os percentuais abaixo estão errados.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 self-center"
            onClick={() => window.location.reload()}
            leftIcon={<RefreshCw size={13} />}
          >
            Recarregar
          </Button>
        </div>
      )}

      {b.unclassifiedCount > 0 && (
        <div
          className="flex flex-col gap-3 rounded-xl border border-warning-border bg-warning-bg px-4 py-3 sm:flex-row sm:items-center"
          role="status"
        >
          <AlertTriangle size={17} className="mt-0.5 shrink-0 self-start text-warning sm:mt-0 sm:self-center" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">
              {b.unclassifiedCount} {b.unclassifiedCount === 1 ? 'despesa' : 'despesas'} sem
              classificação
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              {money.format(b.unclassified)} não entram em balde nenhum, então os percentuais abaixo
              contam uma história incompleta. Classifica em Despesas → Gerenciar.
            </p>
          </div>
          <Link
            href="/finance/expenses"
            className="shrink-0 self-start rounded-lg border border-border-strong bg-surface-1 px-3 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-3 sm:self-center"
          >
            Classificar
          </Link>
        </div>
      )}

      {!b.isEmpty && (
        <BudgetSignals b={b} breakdown={breakdown} trend={trend} money={money} />
      )}

      {/* Base de cálculo — a escada só aparece quando há degraus. */}
      <section className="rounded-xl border border-border bg-surface-2 px-4 py-3">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          {b.deductions > 0 && (
            <>
              <div>
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Receita{b.includeOneTimeIncome ? '' : ' recorrente'}
                </span>
                <div className="text-base font-semibold text-text-secondary">
                  {money.format(b.incomeConsidered)}
                </div>
              </div>
              <span className="pb-1 text-base text-text-muted" aria-hidden>
                −
              </span>
              <div>
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Impostos e custo do negócio
                </span>
                <div className="text-base font-semibold text-text-muted">
                  {money.format(b.deductions)}
                </div>
              </div>
              <span className="pb-1 text-base text-text-muted" aria-hidden>
                =
              </span>
            </>
          )}
          <div>
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
              Base de cálculo
            </span>
            <div className="text-2xl font-semibold leading-tight tracking-tight text-text-primary">
              {money.format(b.base)}
            </div>
          </div>
          <p className="min-w-0 flex-1 pb-1 text-xs leading-relaxed text-text-muted">
            {b.deductions > 0 ? (
              <>Imposto e custo do negócio abatem da receita: a regra corre sobre renda líquida.</>
            ) : (
              <>
                Nada marcado como imposto ou custo do negócio neste mês — a base é a receita
                {b.includeOneTimeIncome ? '' : ' recorrente'} inteira.
              </>
            )}
            {!b.includeOneTimeIncome && b.incomeOneTime > 0 && (
              <> Fora da base: {money.format(b.incomeOneTime)} de receitas pontuais.</>
            )}
            {/* Sem isto, um mês arquivado mostrava aqui um número diferente do
                que o Histórico mostra para o mesmo mês — a cotação mexe-se. */}
            {b.baseIsFrozen && (
              <>
                {' '}
                <span className="text-text-secondary">
                  Mês arquivado: esta base é a que ficou congelada no fechamento, igual à do
                  Histórico.
                </span>
              </>
            )}
          </p>
        </div>
      </section>

      {b.isEmpty ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-2/40 px-4 py-10 text-center">
          <p className="text-sm text-text-secondary">Nenhuma receita lançada em {formatMonthLabel(month)}.</p>
          <p className="mt-1 text-xs text-text-muted">
            Sem receita não há base, e sem base não há percentuais.{' '}
            <Link href="/finance/income" className="underline hover:text-text-primary">
              Lançar receitas
            </Link>
          </p>
        </div>
      ) : (
        <>
          <BudgetPlanVsReal
            b={b}
            breakdown={breakdown}
            breakdownLoading={breakdownLoading}
            onOpenDetail={setDetail}
          />

          {/* Baldes */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {BUCKET_ORDER.map((k) => (
              <BucketCard
                key={k}
                bucket={b.buckets[k]}
                month={b}
                previous={previous.isEmpty ? null : previous}
                lines={breakdown[k]}
                linesLoading={breakdownLoading}
                money={money}
                onOpenDetail={() => setDetail(k)}
              />
            ))}
          </div>

          {/* Não alocado — resíduo, não protagonista. */}
          <section className="flex flex-col gap-x-5 gap-y-2 rounded-xl border border-border bg-surface-2 px-4 py-3 md:flex-row md:items-baseline">
            <div className="flex shrink-0 items-baseline gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {b.unallocated < 0 ? 'Estouro do mês' : 'Não alocado'}
              </span>
              <span
                className={`text-lg font-semibold leading-none tracking-tight tabular-nums ${
                  b.unallocated < 0 ? 'text-danger' : 'text-text-primary'
                }`}
              >
                {money.format(Math.abs(b.unallocated))}
              </span>
              <span className="text-xs tabular-nums text-text-muted">
                {formatPct(Math.abs(b.unallocatedSharePct))} da base
              </span>
            </div>
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-text-secondary">
              {b.unallocated < 0 ? (
                <>
                  Gastaste {money.format(-b.unallocated)} além da base. A diferença saiu de sobra
                  acumulada, de reserva, ou virou dívida.
                </>
              ) : (
                <>
                  Base menos tudo o que tem destino declarado. Não é poupança — é dinheiro que saiu
                  sem categoria ou ficou parado na conta.
                  {b.buckets.investment.delta > 0 &&
                    (b.unallocated >= b.buckets.investment.delta ? (
                      <>
                        {' '}
                        Dá para fechar a meta de investimento com{' '}
                        {money.format(b.buckets.investment.delta)} daqui.
                      </>
                    ) : (
                      <>
                        {' '}
                        Não chega para fechar a meta de investimento — faltariam{' '}
                        {money.format(b.buckets.investment.delta - b.unallocated)} vindos de algum
                        corte.
                      </>
                    ))}
                </>
              )}
            </p>
          </section>

          <BudgetTrend months={trend} />
        </>
      )}

      {hasForeignIncome && ratesFetchedAt && (
        <p className="text-xs text-text-muted">
          Receitas em moeda estrangeira convertidas à cotação de{' '}
          {new Date(ratesFetchedAt).toLocaleString('pt-BR')}.{' '}
          <Badge variant="muted" size="sm">
            {money.currency}
          </Badge>
        </p>
      )}

      <BucketDetailModal
        isOpen={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? BUCKET_LABEL[detail] : ''}
        color={detail ? BUCKET_COLOR[detail] : 'transparent'}
        monthLabel={formatMonthLabel(month)}
        lines={detail ? breakdown[detail] : []}
        isLoading={breakdownLoading}
        money={money}
      />
    </div>
  );
}
