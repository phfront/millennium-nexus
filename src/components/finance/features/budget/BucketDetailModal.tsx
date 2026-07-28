'use client';

import { Modal } from '@phfront/millennium-ui';
import type { MoneyFormat } from '@/hooks/finance/use-money-format';
import type { BudgetLine } from '@/hooks/finance/use-budget-breakdown';
import { Swatch, formatPct } from '@/components/finance/features/budget/budget-shared';

/** Todos os lançamentos de um balde — a versão tocável do tooltip das barras. */
export function BucketDetailModal({
  isOpen,
  onClose,
  title,
  color,
  monthLabel,
  lines,
  isLoading,
  money,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  color: string;
  monthLabel: string;
  lines: BudgetLine[];
  isLoading: boolean;
  money: MoneyFormat;
}) {
  const total = lines.reduce((s, l) => s + l.amount, 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${title} — ${monthLabel}`} size="lg">
      {isLoading ? (
        <p className="py-8 text-center text-sm text-text-muted">A carregar os lançamentos…</p>
      ) : lines.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">
          Nenhum lançamento deste balde no mês.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Swatch color={color} />
            <span className="text-text-secondary">
              {lines.length} {lines.length === 1 ? 'lançamento' : 'lançamentos'}
            </span>
            <span className="ml-auto font-semibold tabular-nums text-text-primary">
              {money.format(total)}
            </span>
          </div>

          <table className="w-full border-collapse text-sm tabular-nums">
            <thead>
              <tr>
                <th className="border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Lançamento
                </th>
                <th className="border-b border-border px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Valor
                </th>
                <th className="border-b border-border px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Do balde
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <th
                    scope="row"
                    className="border-b border-border px-2 py-1.5 text-left font-medium text-text-secondary"
                  >
                    {l.name}
                    {l.isOneTime && <span className="text-text-muted"> · pontual</span>}
                    {l.categoryName && <span className="text-text-muted"> · {l.categoryName}</span>}
                  </th>
                  <td className="border-b border-border px-2 py-1.5 text-right text-text-primary">
                    {money.format(l.amount)}
                  </td>
                  <td className="border-b border-border px-2 py-1.5 text-right text-text-muted">
                    {total > 0 ? formatPct((l.amount / total) * 100) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
