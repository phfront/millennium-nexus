'use client';

import { Skeleton } from '@phfront/millennium-ui';
import { Modal } from '@phfront/millennium-ui';
import { useFinanceMonthDetail } from '@/hooks/finance/use-finance-month-detail';
import { formatBRL, formatDate, formatMonthLong } from '@/lib/finance/format';
import { surplusColor } from '@/lib/finance/finance';

type Props = {
  month: string | null;
  onClose: () => void;
};

function SectionHeader({ label }: { label: string }) {
  return (
    <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">
      {label}
    </h3>
  );
}

function PaidBadge({ isPaid }: { isPaid: boolean | null }) {
  if (isPaid === null) return null;
  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
        isPaid
          ? 'bg-green-500/15 text-green-600'
          : 'bg-surface-3 text-text-muted'
      }`}
    >
      {isPaid ? 'Pago' : 'Pendente'}
    </span>
  );
}

export function MonthDetailModal({ month, onClose }: Props) {
  const {
    income,
    expenseGroups,
    oneTime,
    totalIncome,
    totalExpenses,
    totalOneTime,
    surplus,
    isLoading,
  } = useFinanceMonthDetail(month);

  const hasIncome = income.length > 0;
  const hasExpenses = expenseGroups.length > 0;
  const hasOneTime = oneTime.length > 0;
  const isEmpty = !isLoading && !hasIncome && !hasExpenses && !hasOneTime;

  return (
    <Modal
      isOpen={!!month}
      onClose={onClose}
      title={month ? `Detalhes — ${formatMonthLong(month)}` : 'Detalhes'}
      size="lg"
    >
      <>
        {isLoading ? (
          <div className="flex flex-col gap-3 py-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        ) : isEmpty ? (
          <p className="text-sm text-text-muted py-8 text-center">
            Nenhum lançamento arquivado para este mês.
          </p>
        ) : (
          <div className="flex flex-col gap-6">

            {/* ── Receitas ── */}
            {hasIncome && (
              <section>
                <SectionHeader label="Receitas" />
                <ul className="flex flex-col border border-border/60 rounded-lg overflow-hidden">
                  {income.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between px-3 py-2 border-b border-border/40 last:border-0 bg-surface-2/80 text-sm"
                    >
                      <span className="text-text-primary">{r.item_name}</span>
                      <span className="tabular-nums font-medium text-green-500">
                        {formatBRL(r.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between px-3 py-2 mt-1 rounded-lg bg-surface-3/50">
                  <span className="text-sm font-semibold text-text-primary">Total receitas</span>
                  <span className="text-sm tabular-nums font-semibold text-green-500">
                    {formatBRL(totalIncome)}
                  </span>
                </div>
              </section>
            )}

            {/* ── Despesas fixas ── */}
            {hasExpenses && (
              <section>
                <SectionHeader label="Despesas fixas" />
                <div className="flex flex-col gap-3">
                  {expenseGroups.map((g, gi) => {
                    const catTotal = g.items.reduce((s, r) => s + r.amount, 0);
                    return (
                      <div key={gi}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          {g.category_color && (
                            <span
                              className="inline-block w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: g.category_color }}
                            />
                          )}
                          <span className="text-xs font-medium text-text-secondary">
                            {g.category_name ?? 'Sem categoria'}
                          </span>
                          <span className="ml-auto text-xs tabular-nums text-text-muted">
                            {formatBRL(catTotal)}
                          </span>
                        </div>
                        <ul className="flex flex-col border border-border/60 rounded-lg overflow-hidden">
                          {g.items.map((item, ii) => (
                            <li
                              key={ii}
                              className="flex items-center gap-3 px-3 py-2 border-b border-border/40 last:border-0 bg-surface-2/80 text-sm"
                            >
                              <span className="flex-1 text-text-primary truncate">
                                {item.item_name}
                              </span>
                              <PaidBadge isPaid={item.is_paid} />
                              <span className="tabular-nums text-text-secondary shrink-0">
                                {formatBRL(item.amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                  <div className="flex justify-between px-3 py-2 rounded-lg bg-surface-3/50">
                    <span className="text-sm font-semibold text-text-primary">Total despesas</span>
                    <span className="text-sm tabular-nums font-semibold text-red-500">
                      {formatBRL(totalExpenses)}
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* ── Pontuais ── */}
            {hasOneTime && (
              <section>
                <SectionHeader label="Pontuais" />
                <ul className="flex flex-col border border-border/60 rounded-lg overflow-hidden">
                  {oneTime.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 px-3 py-2 border-b border-border/40 last:border-0 bg-surface-2/80 text-sm"
                    >
                      <span className="flex-1 text-text-primary truncate">{r.item_name}</span>
                      {r.due_date && (
                        <span className="text-xs text-text-muted shrink-0">
                          {formatDate(r.due_date)}
                        </span>
                      )}
                      <PaidBadge isPaid={r.is_paid} />
                      <span className="tabular-nums text-text-secondary shrink-0">
                        {formatBRL(r.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between px-3 py-2 mt-1 rounded-lg bg-surface-3/50">
                  <span className="text-sm font-semibold text-text-primary">Total pontuais</span>
                  <span className="text-sm tabular-nums font-semibold text-red-500">
                    {formatBRL(totalOneTime)}
                  </span>
                </div>
              </section>
            )}

            {/* ── Sobra ── */}
            <div className="flex justify-between items-center pt-4 border-t border-border">
              <span className="text-base font-bold text-text-primary">Sobra do mês</span>
              <span className={`text-base tabular-nums font-bold ${surplusColor(surplus)}`}>
                {formatBRL(surplus)}
              </span>
            </div>

          </div>
        )}
      </>
    </Modal>
  );
}
