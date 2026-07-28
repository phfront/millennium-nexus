'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Check } from 'lucide-react';
import type { BudgetBucketKey, BudgetMonth } from '@/hooks/finance/use-budget-allocation';
import type { BudgetBreakdown, BudgetLine } from '@/hooks/finance/use-budget-breakdown';
import type { MoneyFormat } from '@/hooks/finance/use-money-format';
import { useMoneyFormat } from '@/hooks/finance/use-money-format';
import {
  BUCKET_COLOR,
  BUCKET_LABEL,
  BUCKET_ORDER,
  Swatch,
  TONE_CHIP,
  UNALLOCATED_COLOR,
  UNCLASSIFIED_COLOR,
  bucketTone,
  formatPct,
  isCeiling,
} from '@/components/finance/features/budget/budget-shared';

const TIP_ID = 'budget-segment-tip';
/** Margem para o cartão não colar no fim da tela ao ser posicionado. */
const VIEWPORT_MARGIN = 10;
/** Sair da faixa e entrar no cartão passa por um vão morto; fechar já era perder o cartão. */
const CLOSE_DELAY_MS = 140;

type TipKey = BudgetBucketKey | 'unclassified' | 'unallocated';
type TipTarget = { row: 'plan' | 'real'; key: TipKey };

function targetId(t: TipTarget): string {
  return `${t.row}:${t.key}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(n, max));
}

/* ------------------------------------------------------------------ */
/* Cartão flutuante                                                    */
/* ------------------------------------------------------------------ */

/**
 * Fica em `position: fixed` fora do fluxo: as barras vivem dentro de um
 * cartão estreito e um tooltip com lista de itens não caberia lá dentro
 * sem ser cortado.
 */
function FloatingCard({
  anchorEl,
  contentKey,
  interactive = false,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  anchorEl: HTMLElement;
  /** Muda quando o conteúdo muda de altura (ex.: acabou de carregar). */
  contentKey: string;
  /**
   * Deixa o rato entrar no cartão em vez de o atravessar. Necessário para
   * listas com scroll — sem isto, a roda do rato ia para a página por baixo
   * e o cartão fechava a meio da leitura.
   */
  interactive?: boolean;
  /** Só disparam com `interactive`; use-os para segurar o cartão aberto. */
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const card = ref.current?.getBoundingClientRect();
      if (!card) return;
      const a = anchorEl.getBoundingClientRect();
      const M = VIEWPORT_MARGIN;
      const left = clamp(
        a.left + a.width / 2 - card.width / 2,
        M,
        Math.max(M, window.innerWidth - M - card.width),
      );
      const above = a.top - M - card.height;
      const top =
        above >= M
          ? above
          : clamp(a.bottom + M, M, Math.max(M, window.innerHeight - M - card.height));
      // O scroll da própria lista também chega aqui (captura): sem esta
      // comparação, cada tique da roda era um render novo.
      setPos((prev) => (prev && prev.left === left && prev.top === top ? prev : { left, top }));
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchorEl, contentKey]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={ref}
      id={TIP_ID}
      role="tooltip"
      className={`fixed z-200 flex w-[min(23rem,calc(100vw-1.25rem))] flex-col rounded-xl border border-border bg-surface-2 p-3 text-xs shadow-xl ${
        interactive ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        // Antes de medir, o cartão está no canto — mostrá-lo aí era um salto.
        opacity: pos ? 1 : 0,
        maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`,
      }}
      onMouseEnter={interactive ? onMouseEnter : undefined}
      onMouseLeave={interactive ? onMouseLeave : undefined}
    >
      {children}
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Conteúdo do tooltip                                                 */
/* ------------------------------------------------------------------ */

function TipRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-text-muted">{label}</span>
      <span
        className={`shrink-0 tabular-nums ${strong ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}
      >
        {value}
      </span>
    </div>
  );
}

/** Mesma semântica dos cartões: teto nas despesas, piso no investimento. */
function DeltaChip({
  bucket,
  money,
}: {
  bucket: BudgetMonth['buckets'][BudgetBucketKey];
  money: MoneyFormat;
}) {
  const tone = bucketTone(bucket);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${TONE_CHIP[tone]}`}
    >
      {tone === 'over' && (
        <>
          <ArrowUp size={11} strokeWidth={2.4} />
          {money.format(-bucket.delta)} acima do teto
        </>
      )}
      {tone === 'under' && <>{money.format(bucket.delta)} abaixo do teto</>}
      {tone === 'short' && (
        <>
          <ArrowDown size={11} strokeWidth={2.4} />
          Faltam {money.format(bucket.delta)}
        </>
      )}
      {tone === 'met' && (
        <>
          <Check size={11} strokeWidth={2.4} />
          Meta cumprida
        </>
      )}
    </span>
  );
}

function LineList({
  lines,
  isLoading,
  money,
  emptyText,
}: {
  lines: BudgetLine[];
  isLoading: boolean;
  money: MoneyFormat;
  emptyText: string;
}) {
  if (isLoading) {
    return <p className="text-[11px] text-text-muted">A carregar os lançamentos…</p>;
  }
  if (lines.length === 0) {
    return <p className="text-[11px] text-text-muted">{emptyText}</p>;
  }

  const total = lines.reduce((s, l) => s + l.amount, 0);
  const pct = (v: number) => (total > 0 ? formatPct((v / total) * 100) : '—');

  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          {lines.length} {lines.length === 1 ? 'lançamento' : 'lançamentos'}
        </span>
        <span className="shrink-0 tabular-nums text-text-secondary">{money.format(total)}</span>
      </div>
      {/* `overscroll-contain`: chegar ao fim da lista não deve arrastar a página. */}
      <ul className="flex max-h-[min(19rem,42vh)] min-h-0 flex-col gap-1 overflow-y-auto overscroll-contain pr-1">
        {lines.map((l) => (
          <li key={l.id} className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-text-secondary">
              {l.name}
              {l.isOneTime && <span className="text-text-muted"> · pontual</span>}
              {l.categoryName && <span className="text-text-muted"> · {l.categoryName}</span>}
            </span>
            <span className="shrink-0 tabular-nums text-text-primary">{money.format(l.amount)}</span>
            <span className="w-12 shrink-0 text-right tabular-nums text-text-muted">
              {pct(l.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TipHeader({
  color,
  title,
  kicker,
  value,
  caption,
}: {
  color: string;
  title: string;
  kicker: string;
  value: string;
  caption: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Swatch color={color} />
        <span className="min-w-0 flex-1 truncate font-semibold text-text-primary">{title}</span>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          {kicker}
        </span>
      </div>
      <div className="mt-1.5 text-lg font-semibold leading-tight tracking-tight text-text-primary tabular-nums">
        {value}
      </div>
      <p className="mt-0.5 text-[11px] text-text-secondary">{caption}</p>
    </>
  );
}

function TipContent({
  target,
  b,
  lines,
  isLoading,
  money,
  onOpenDetail,
}: {
  target: TipTarget;
  b: BudgetMonth;
  lines: BudgetLine[];
  isLoading: boolean;
  money: MoneyFormat;
  onOpenDetail?: (key: BudgetBucketKey) => void;
}) {
  if (target.key === 'unallocated') {
    return (
      <>
        <TipHeader
          color={UNALLOCATED_COLOR}
          title="Não alocado"
          kicker="Real"
          value={money.format(b.unallocated)}
          caption={<>{formatPct(b.unallocatedSharePct)} da base</>}
        />
        <div className="mt-2.5 flex flex-col gap-1 border-t border-border pt-2">
          <TipRow label="Base do mês" value={money.format(b.base)} />
          <TipRow label="Tudo com destino" value={`− ${money.format(b.totalSpent)}`} />
          <TipRow label="Sobra" value={money.format(b.unallocated)} strong />
        </div>
        <p className="mt-2 border-t border-border pt-2 text-[11px] leading-relaxed text-text-muted">
          Não é poupança: é dinheiro sem categoria declarada ou parado na conta. Só vira
          investimento depois de lançado como tal.
        </p>
      </>
    );
  }

  if (target.key === 'unclassified') {
    return (
      <>
        <TipHeader
          color={UNCLASSIFIED_COLOR}
          title="A classificar"
          kicker="Real"
          value={money.format(b.unclassified)}
          caption={
            <>
              {formatPct(b.unclassifiedSharePct)} da base · {b.unclassifiedCount}{' '}
              {b.unclassifiedCount === 1 ? 'despesa' : 'despesas'}
            </>
          }
        />
        <div className="mt-2.5 flex min-h-0 flex-1 flex-col border-t border-border pt-2">
          <LineList
            lines={lines}
            isLoading={isLoading}
            money={money}
            emptyText="Sem lançamentos neste mês."
          />
        </div>
        <p className="mt-2 border-t border-border pt-2 text-[11px] leading-relaxed text-text-muted">
          Sem balde, não contam para alvo nenhum. Classifica em Despesas → Gerenciar.
        </p>
      </>
    );
  }

  const bucket = b.buckets[target.key];
  const color = BUCKET_COLOR[target.key];
  const label = BUCKET_LABEL[target.key];

  if (target.row === 'plan') {
    return (
      <>
        <TipHeader
          color={color}
          title={label}
          kicker="Plano"
          value={money.format(bucket.targetAmount)}
          caption={<>{formatPct(bucket.targetPct)} da base de {money.format(b.base)}</>}
        />
        <div className="mt-2.5 flex flex-col gap-1 border-t border-border pt-2">
          <TipRow
            label={isCeiling(bucket.key) ? 'Teto' : 'Meta'}
            value={money.format(bucket.targetAmount)}
          />
          <TipRow
            label="Real"
            value={`${money.format(bucket.amount)} · ${formatPct(bucket.sharePct)}`}
            strong
          />
        </div>
        <div className="mt-2">
          <DeltaChip bucket={bucket} money={money} />
        </div>
      </>
    );
  }

  return (
    <>
      <TipHeader
        color={color}
        title={label}
        kicker="Real"
        value={money.format(bucket.amount)}
        caption={
          <>
            {formatPct(bucket.sharePct)} da base · {isCeiling(bucket.key) ? 'teto' : 'meta'}{' '}
            {formatPct(bucket.targetPct)} ({money.format(bucket.targetAmount)})
          </>
        }
      />
      <div className="mt-2 flex items-center gap-2">
        <DeltaChip bucket={bucket} money={money} />
        {onOpenDetail && lines.length > 0 && (
          <button
            type="button"
            onClick={() => onOpenDetail(bucket.key)}
            className="ml-auto shrink-0 cursor-pointer rounded text-[11px] font-semibold text-text-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-text-primary"
          >
            Abrir detalhe
          </button>
        )}
      </div>
      <div className="mt-2.5 flex min-h-0 flex-1 flex-col border-t border-border pt-2">
        <LineList
          lines={lines}
          isLoading={isLoading}
          money={money}
          emptyText="Nenhuma despesa deste balde lançada no mês."
        />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Barras                                                              */
/* ------------------------------------------------------------------ */

/** Uma faixa da barra. Largura em % do denominador; sem texto dentro. */
function Segment({
  widthPct,
  color,
  label,
  active,
  onEnter,
  onLeave,
}: {
  widthPct: number;
  color: string;
  label: string;
  active: boolean;
  onEnter: (el: HTMLElement) => void;
  onLeave: () => void;
}) {
  if (widthPct <= 0) return null;
  return (
    <div
      className={`h-full cursor-default rounded-sm outline-none transition-[filter,box-shadow] ${
        active ? 'brightness-125 ring-1 ring-text-primary/60' : ''
      } focus-visible:ring-2 focus-visible:ring-text-primary/70`}
      style={{ width: `${widthPct}%`, backgroundColor: color }}
      aria-label={label}
      aria-describedby={active ? TIP_ID : undefined}
      role="img"
      tabIndex={0}
      onMouseEnter={(e) => onEnter(e.currentTarget)}
      onFocus={(e) => onEnter(e.currentTarget)}
      onBlur={onLeave}
    />
  );
}

export function BudgetPlanVsReal({
  b,
  breakdown,
  breakdownLoading: isLoading,
  onOpenDetail,
}: {
  b: BudgetMonth;
  breakdown: BudgetBreakdown;
  breakdownLoading: boolean;
  onOpenDetail?: (key: BudgetBucketKey) => void;
}) {
  const money = useMoneyFormat();
  const [tip, setTip] = useState<{ target: TipTarget; el: HTMLElement } | null>(null);

  const barTotal = b.barTotal;
  const w = (v: number) => (barTotal > 0 ? Math.max(0, (v / barTotal) * 100) : 0);
  /** A base fica fora da barra quando se gasta mais do que ela; marca onde acabou. */
  const overspent = b.totalSpent > b.base;

  const closeTimer = useRef<number | null>(null);
  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const open = (target: TipTarget) => (el: HTMLElement) => {
    cancelClose();
    setTip({ target, el });
  };
  /** Adiado: o rato pode estar a caminho do próprio cartão. */
  const close = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setTip(null);
    }, CLOSE_DELAY_MS);
  };
  const closeNow = () => {
    cancelClose();
    setTip(null);
  };
  const isActive = (t: TipTarget) => tip !== null && targetId(tip.target) === targetId(t);

  useEffect(() => cancelClose, []);

  useEffect(() => {
    if (!tip) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeNow();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tip]);

  const legend: { target: TipTarget; color: string; node: React.ReactNode }[] = [
    ...BUCKET_ORDER.map((k) => ({
      target: { row: 'real', key: k } as TipTarget,
      color: BUCKET_COLOR[k],
      node: (
        <>
          {BUCKET_LABEL[k]}{' '}
          <strong className="font-semibold tabular-nums text-text-primary">
            {money.format(b.buckets[k].amount)}
          </strong>
          <span className="tabular-nums text-text-muted">
            {formatPct(b.buckets[k].sharePct)} de {formatPct(b.buckets[k].targetPct)}
          </span>
        </>
      ),
    })),
    ...(b.unclassified > 0
      ? [
          {
            target: { row: 'real', key: 'unclassified' } as TipTarget,
            color: UNCLASSIFIED_COLOR,
            node: (
              <>
                A classificar{' '}
                <strong className="font-semibold tabular-nums text-text-primary">
                  {money.format(b.unclassified)}
                </strong>
                <span className="tabular-nums text-text-muted">
                  {formatPct(b.unclassifiedSharePct)}
                </span>
              </>
            ),
          },
        ]
      : []),
    ...(b.unallocated > 0
      ? [
          {
            target: { row: 'real', key: 'unallocated' } as TipTarget,
            color: UNALLOCATED_COLOR,
            node: (
              <>
                Não alocado{' '}
                <strong className="font-semibold tabular-nums text-text-primary">
                  {money.format(b.unallocated)}
                </strong>
                <span className="tabular-nums text-text-muted">
                  {formatPct(b.unallocatedSharePct)}
                </span>
              </>
            ),
          },
        ]
      : []),
  ];

  /**
   * Onde cada balde do plano acaba, projectado na barra real. Comparar duas
   * barras separadas obriga a medir com os olhos; a marca põe o alvo dentro
   * da barra que interessa.
   */
  const planMarks = BUCKET_ORDER.reduce<{ key: BudgetBucketKey; leftPct: number }[]>(
    (acc, k) => {
      const previousEdge = acc.length > 0 ? acc[acc.length - 1].leftPct : 0;
      acc.push({ key: k, leftPct: previousEdge + w(b.buckets[k].targetAmount) });
      return acc;
    },
    [],
  ).filter((m) => m.leftPct > 0 && m.leftPct < 100);

  const tipLines: BudgetLine[] =
    tip === null || tip.target.key === 'unallocated' ? [] : breakdown[tip.target.key];

  return (
    <section className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">Plano × real</h2>
        <p className="text-xs text-text-muted">
          {overspent
            ? 'Gastaste mais do que a base — a barra mede o gasto total'
            : 'Cada barra é 100% da base do mês'}
        </p>
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3.5">
          <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-text-muted sm:text-right">
            Plano
          </span>
          <div className="flex h-4 flex-1 gap-0.5 opacity-45" onMouseLeave={close}>
            {BUCKET_ORDER.map((k) => (
              <Segment
                key={k}
                widthPct={
                  overspent ? (b.buckets[k].targetAmount / barTotal) * 100 : b.buckets[k].targetPct
                }
                color={BUCKET_COLOR[k]}
                label={`Plano ${BUCKET_LABEL[k]}: ${formatPct(b.buckets[k].targetPct)} · ${money.format(b.buckets[k].targetAmount)}`}
                active={isActive({ row: 'plan', key: k })}
                onEnter={open({ row: 'plan', key: k })}
                onLeave={close}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3.5">
          <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-text-muted sm:text-right">
            Real
          </span>
          <div className="relative flex h-8 flex-1 gap-0.5" onMouseLeave={close}>
            {BUCKET_ORDER.map((k) => (
              <Segment
                key={k}
                widthPct={w(b.buckets[k].amount)}
                color={BUCKET_COLOR[k]}
                label={`${BUCKET_LABEL[k]}: ${money.format(b.buckets[k].amount)} (${formatPct(b.buckets[k].sharePct)})`}
                active={isActive({ row: 'real', key: k })}
                onEnter={open({ row: 'real', key: k })}
                onLeave={close}
              />
            ))}
            <Segment
              widthPct={w(b.unclassified)}
              color={UNCLASSIFIED_COLOR}
              label={`A classificar: ${money.format(b.unclassified)}`}
              active={isActive({ row: 'real', key: 'unclassified' })}
              onEnter={open({ row: 'real', key: 'unclassified' })}
              onLeave={close}
            />
            {b.unallocated > 0 && (
              <Segment
                widthPct={w(b.unallocated)}
                color={UNALLOCATED_COLOR}
                label={`Não alocado: ${money.format(b.unallocated)}`}
                active={isActive({ row: 'real', key: 'unallocated' })}
                onEnter={open({ row: 'real', key: 'unallocated' })}
                onLeave={close}
              />
            )}
            {planMarks.map((m) => (
              <div
                key={m.key}
                className="pointer-events-none absolute -top-1.5 -bottom-1.5 w-px bg-text-primary/70"
                style={{ left: `min(${m.leftPct}%, calc(100% - 1px))` }}
                aria-hidden
              />
            ))}
            {overspent && (
              <div
                className="absolute -top-1 -bottom-1 w-0.5 bg-text-primary"
                style={{ left: `min(${w(b.base)}%, calc(100% - 2px))` }}
                title={`Base: ${money.format(b.base)}`}
              />
            )}
          </div>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-text-muted sm:pl-[4.375rem]">
        As marcas verticais na barra de baixo são onde cada balde deveria acabar segundo o plano.
      </p>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3.5">
        {legend.map((l) => (
          <span
            key={targetId(l.target)}
            className={`flex cursor-default items-baseline gap-2 rounded text-xs outline-none transition-colors ${
              isActive(l.target) ? 'text-text-primary' : 'text-text-secondary'
            } focus-visible:ring-2 focus-visible:ring-text-primary/70`}
            tabIndex={0}
            aria-describedby={isActive(l.target) ? TIP_ID : undefined}
            onMouseEnter={(e) => open(l.target)(e.currentTarget)}
            onMouseLeave={close}
            onFocus={(e) => open(l.target)(e.currentTarget)}
            onBlur={close}
          >
            <Swatch color={l.color} />
            {l.node}
          </span>
        ))}
      </div>

      {tip && (
        <FloatingCard
          key={targetId(tip.target)}
          anchorEl={tip.el}
          contentKey={`${targetId(tip.target)}:${isLoading}`}
          interactive
          onMouseEnter={cancelClose}
          onMouseLeave={close}
        >
          <TipContent
            target={tip.target}
            b={b}
            lines={tipLines}
            isLoading={isLoading}
            money={money}
            onOpenDetail={
              onOpenDetail
                ? (key) => {
                    closeNow();
                    onOpenDetail(key);
                  }
                : undefined
            }
          />
        </FloatingCard>
      )}
    </section>
  );
}
