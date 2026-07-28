'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { AlertTriangle, Layers, TrendingDown } from 'lucide-react';
import type { BudgetMonth } from '@/hooks/finance/use-budget-allocation';
import {
  BUDGET_LINE_GROUPS,
  type BudgetBreakdown,
  type BudgetLine,
} from '@/hooks/finance/use-budget-breakdown';
import type { MoneyFormat } from '@/hooks/finance/use-money-format';
import { BUCKET_LABEL, formatPct } from '@/components/finance/features/budget/budget-shared';

/** Um lançamento acima disto sozinho decide o balde — e esconde o que há dentro. */
const BLIND_LINE_SHARE = 0.25;
/** Obrigatórias abaixo desta fatia do alvo, com opcionais estouradas, cheira a classe trocada. */
const SUSPECT_ESSENTIAL_RATIO = 0.6;

type Signal = {
  id: string;
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  action?: { href: string; label: string };
};

function Card({ signal }: { signal: Signal }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-warning-border bg-warning-bg px-4 py-3 sm:flex-row sm:items-center"
      role="status"
    >
      <span className="mt-0.5 shrink-0 self-start text-warning sm:mt-0 sm:self-center">
        {signal.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">{signal.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{signal.body}</p>
      </div>
      {signal.action && (
        <Link
          href={signal.action.href}
          className="shrink-0 self-start rounded-lg border border-border-strong bg-surface-1 px-3 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-3 sm:self-center"
        >
          {signal.action.label}
        </Link>
      )}
    </div>
  );
}

/**
 * Avisos que mudam a leitura dos números — não do género "gastaste muito",
 * mas do género "este número não quer dizer o que parece".
 */
export function BudgetSignals({
  b,
  breakdown,
  trend,
  money,
}: {
  b: BudgetMonth;
  breakdown: BudgetBreakdown;
  /** Meses até ao actual, inclusive. */
  trend: BudgetMonth[];
  money: MoneyFormat;
}) {
  const signals = useMemo((): Signal[] => {
    const out: Signal[] = [];
    if (b.isEmpty || b.base <= 0) return out;

    // 1) Uma linha só a valer um quarto da base: o balde dela deixa de
    //    descrever gasto nenhum — descreve uma fatura por abrir.
    let biggest: BudgetLine | null = null;
    for (const group of BUDGET_LINE_GROUPS) {
      for (const line of breakdown[group]) {
        if (!biggest || line.amount > biggest.amount) biggest = line;
      }
    }
    if (biggest && biggest.amount / b.base >= BLIND_LINE_SHARE) {
      const share = (biggest.amount / b.base) * 100;
      out.push({
        id: 'blind-line',
        icon: <Layers size={17} />,
        title: `“${biggest.name}” sozinho é ${formatPct(share)} da base`,
        body: (
          <>
            {money.format(biggest.amount)} num único lançamento. Se aí dentro há mercado, farmácia e
            restaurante misturados, nenhum percentual desta tela descreve para onde vai o seu
            dinheiro — divide a linha por natureza de gasto.
          </>
        ),
        action: { href: '/finance/expenses', label: 'Abrir planilha' },
      });
    }

    // 2) Obrigatórias muito abaixo do alvo com opcionais estouradas. O mais
    //    provável não é gastança: é despesa obrigatória marcada como opcional.
    const ess = b.buckets.essential;
    const opt = b.buckets.optional;
    if (
      ess.targetPct > 0 &&
      ess.sharePct < ess.targetPct * SUSPECT_ESSENTIAL_RATIO &&
      opt.sharePct > opt.targetPct
    ) {
      out.push({
        id: 'suspect-class',
        icon: <AlertTriangle size={17} />,
        title: 'A classificação pode estar trocada',
        body: (
          <>
            {BUCKET_LABEL.essential} em {formatPct(ess.sharePct)} (alvo {formatPct(ess.targetPct)}) e{' '}
            {BUCKET_LABEL.optional.toLowerCase()} em {formatPct(opt.sharePct)} (alvo{' '}
            {formatPct(opt.targetPct)}). Gastar menos do que o teto em obrigatórias e estourar em
            opcionais costuma ser classe trocada, não gastança. Confere antes de cortar.
          </>
        ),
        action: { href: '/finance/expenses', label: 'Rever classes' },
      });
    }

    // 3) Investimento parado: um mês a zero é distração, vários é decisão.
    const withBase = trend.filter((m) => !m.isEmpty && m.base > 0);
    let zeroStreak = 0;
    for (let i = withBase.length - 1; i >= 0; i -= 1) {
      if (withBase[i].buckets.investment.amount > 0) break;
      zeroStreak += 1;
    }
    if (zeroStreak >= 2) {
      out.push({
        id: 'investment-stalled',
        icon: <TrendingDown size={17} />,
        title: `Investimento a zero há ${zeroStreak} meses`,
        body: (
          <>
            O alvo pede {money.format(b.buckets.investment.targetAmount)} por mês. Se há aportes a
            sair mas lançados noutro balde, o problema é de classificação; se não há, este é o número
            a atacar primeiro.
          </>
        ),
        action: { href: '/finance/expenses', label: 'Lançar aporte' },
      });
    }

    return out;
  }, [b, breakdown, trend, money]);

  if (signals.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {signals.map((s) => (
        <Card key={s.id} signal={s} />
      ))}
    </div>
  );
}
