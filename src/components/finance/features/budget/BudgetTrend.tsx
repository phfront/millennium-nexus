'use client';

import { useMemo } from 'react';
import type { BudgetBucketKey, BudgetMonth } from '@/hooks/finance/use-budget-allocation';
import type { MoneyFormat } from '@/hooks/finance/use-money-format';
import { useMoneyFormat } from '@/hooks/finance/use-money-format';
import { formatMonthChartAxisShort } from '@/lib/finance/format';
import {
  BUCKET_COLOR,
  BUCKET_LABEL,
  BUCKET_ORDER,
  Swatch,
  formatPct,
  isCeiling,
} from '@/components/finance/features/budget/budget-shared';

const W = 320;
const H = 150;
const PAD = { t: 12, r: 10, b: 24, l: 10 };
const PW = W - PAD.l - PAD.r;
const PH = H - PAD.t - PAD.b;

/** Dentro do alvo: abaixo do teto nas despesas, acima do piso no investimento. */
function meetsTarget(m: BudgetMonth, key: BudgetBucketKey): boolean {
  const bucket = m.buckets[key];
  return isCeiling(key) ? bucket.sharePct <= bucket.targetPct : bucket.sharePct >= bucket.targetPct;
}

function Facet({
  bucketKey,
  target,
  months,
  money,
}: {
  bucketKey: BudgetBucketKey;
  target: number;
  months: BudgetMonth[];
  money: MoneyFormat;
}) {
  const label = BUCKET_LABEL[bucketKey];
  const color = BUCKET_COLOR[bucketKey];
  const points = months.map((m) => m.buckets[bucketKey].sharePct);
  const labels = months.map((m) => formatMonthChartAxisShort(m.month));

  /** Domínio próprio por balde: a pergunta é a distância ao alvo dele, não
      comparar 60% com 10% na mesma escala. */
  const domain = Math.max(target, ...points, 1) * 1.2;

  const xAt = (i: number) =>
    points.length > 1 ? PAD.l + (i * PW) / (points.length - 1) : PAD.l + PW / 2;
  const yAt = (v: number) => PAD.t + PH - (Math.max(0, v) / domain) * PH;

  const line = points.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ');
  const area =
    points.length > 0
      ? `M${xAt(0).toFixed(1)},${PAD.t + PH} L${points
          .map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`)
          .join(' L')} L${xAt(points.length - 1).toFixed(1)},${PAD.t + PH} Z`
      : '';

  const last = points[points.length - 1] ?? 0;
  const targetY = yAt(target);
  const within = months.filter((m) => meetsTarget(m, bucketKey)).length;

  return (
    <section className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="mb-1 flex items-center gap-2">
        <Swatch color={color} />
        <span className="text-xs font-semibold text-text-primary">{label}</span>
        <span className="ml-auto text-xs font-semibold tabular-nums text-text-primary">
          {formatPct(last)}
        </span>
      </div>
      <p className="mb-1 text-[11px] text-text-muted">
        {within} de {months.length} {months.length === 1 ? 'mês' : 'meses'} dentro do{' '}
        {isCeiling(bucketKey) ? 'teto' : 'piso'}
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`${label}: ${formatPct(points[0] ?? 0)} em ${labels[0] ?? ''} para ${formatPct(
          last,
        )} em ${labels[labels.length - 1] ?? ''}. Alvo ${formatPct(target)}.`}
      >
        <line
          x1={PAD.l}
          y1={PAD.t + PH}
          x2={W - PAD.r}
          y2={PAD.t + PH}
          stroke="var(--color-border-strong)"
          strokeWidth="1"
        />
        {/* Tracejado = limiar (o alvo), não grade */}
        <line
          x1={PAD.l}
          y1={targetY}
          x2={W - PAD.r}
          y2={targetY}
          stroke="var(--color-text-muted)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <text
          x={W - PAD.r}
          y={targetY - 5}
          textAnchor="end"
          fontSize="10"
          fill="var(--color-text-muted)"
        >
          alvo {formatPct(target)}
        </text>

        {area && <path d={area} fill={color} fillOpacity="0.13" />}
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Um alvo por ponto, largo o suficiente para o rato acertar. */}
        {points.map((v, i) => (
          <g key={months[i].month}>
            <circle
              cx={xAt(i)}
              cy={yAt(v)}
              r={i === points.length - 1 ? 3.5 : 2.5}
              fill={color}
              stroke="var(--color-surface-2)"
              strokeWidth={i === points.length - 1 ? 2 : 1}
            />
            <circle cx={xAt(i)} cy={yAt(v)} r="9" fill="transparent">
              <title>
                {`${labels[i]}: ${formatPct(v)} · ${money.format(months[i].buckets[bucketKey].amount)}`}
              </title>
            </circle>
          </g>
        ))}

        {labels.length > 0 && (
          <>
            <text x={PAD.l} y={H - 8} textAnchor="start" fontSize="10" fill="var(--color-text-muted)">
              {labels[0]}
            </text>
            {labels.length > 1 && (
              <text
                x={W - PAD.r}
                y={H - 8}
                textAnchor="end"
                fontSize="10"
                fill="var(--color-text-muted)"
              >
                {labels[labels.length - 1]}
              </text>
            )}
          </>
        )}
      </svg>
    </section>
  );
}

export function BudgetTrend({ months }: { months: BudgetMonth[] }) {
  const money = useMoneyFormat();
  /** Meses sem receita não têm percentual — entram como 0 e distorceriam a linha. */
  const usable = useMemo(() => months.filter((m) => !m.isEmpty && m.base > 0), [months]);
  const labels = useMemo(() => usable.map((m) => formatMonthChartAxisShort(m.month)), [usable]);

  /** Meses em que os três baldes fecharam ao mesmo tempo. */
  const allWithin = useMemo(
    () => usable.filter((m) => BUCKET_ORDER.every((k) => meetsTarget(m, k))).length,
    [usable],
  );

  if (usable.length < 2) {
    return (
      <section className="rounded-xl border border-border bg-surface-2 p-4">
        <h2 className="text-sm font-semibold text-text-primary">Tendência</h2>
        <p className="mt-1 text-xs text-text-muted">
          Precisas de pelo menos dois meses com receita lançada para haver tendência.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">
          Tendência — {usable.length} {usable.length === 1 ? 'mês' : 'meses'}
        </h2>
        <p className="text-xs text-text-muted">% da base por balde · escalas independentes</p>
      </div>

      <p
        className={`rounded-xl border px-4 py-2.5 text-xs leading-relaxed ${
          allWithin === 0
            ? 'border-warning-border bg-warning-bg text-text-secondary'
            : 'border-border bg-surface-2 text-text-secondary'
        }`}
      >
        <strong className="font-semibold text-text-primary">
          {allWithin} de {usable.length} meses
        </strong>{' '}
        com os três baldes dentro do alvo ao mesmo tempo.
        {allWithin === 0 && (
          <> Nenhum mês fechou o plano — ou os gastos mudam, ou os alvos não descrevem a sua vida.</>
        )}
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {BUCKET_ORDER.map((k) => (
          <Facet
            key={k}
            bucketKey={k}
            target={usable[usable.length - 1]!.buckets[k].targetPct}
            months={usable}
            money={money}
          />
        ))}
      </div>

      <details className="rounded-xl border border-border bg-surface-2 p-4">
        <summary className="cursor-pointer text-xs font-semibold text-text-secondary">
          Ver tabela
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-xs tabular-nums">
            <caption className="pb-2 text-left text-[11px] text-text-muted">
              Percentual da base por balde.
            </caption>
            <thead>
              <tr>
                <th className="border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Mês
                </th>
                {BUCKET_ORDER.map((k) => (
                  <th
                    key={k}
                    className="border-b border-border px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-text-muted"
                  >
                    {BUCKET_LABEL[k]}
                  </th>
                ))}
                <th className="border-b border-border px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  A classificar
                </th>
                <th className="border-b border-border px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Não alocado
                </th>
              </tr>
            </thead>
            <tbody>
              {usable.map((m, i) => (
                <tr key={m.month}>
                  <th
                    scope="row"
                    className="border-b border-border px-2 py-1.5 text-left font-medium text-text-secondary"
                  >
                    {labels[i]}
                  </th>
                  {BUCKET_ORDER.map((k) => (
                    <td
                      key={k}
                      className={`border-b border-border px-2 py-1.5 text-right ${
                        meetsTarget(m, k) ? 'text-text-primary' : 'text-danger'
                      }`}
                    >
                      {formatPct(m.buckets[k].sharePct)}
                    </td>
                  ))}
                  <td className="border-b border-border px-2 py-1.5 text-right text-text-primary">
                    {formatPct(m.unclassifiedSharePct)}
                  </td>
                  <td className="border-b border-border px-2 py-1.5 text-right text-text-primary">
                    {formatPct(m.unallocatedSharePct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
