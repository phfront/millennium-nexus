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

function OneTimePaidBadge({ isPaid, flow }: { isPaid: boolean | null; flow: 'expense' | 'income' }) {
  if (isPaid === null) return null;
  const done = flow === 'income' ? 'Recebido' : 'Pago';
  const pending = flow === 'income' ? 'A receber' : 'Pendente';
  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
        isPaid
          ? 'bg-green-500/15 text-green-600'
          : 'bg-surface-3 text-text-muted'
      }`}
    >
      {isPaid ? done : pending}
    </span>
  );
}

function PaidNoteBlock({ text }: { text: string | null | undefined }) {
  const t = text?.trim();
  if (!t) return null;
  return (
    <p className="text-[11px] text-text-secondary mt-1.5 border-l-2 border-border/80 pl-2 leading-snug whitespace-pre-wrap">
      <span className="font-medium text-text-muted">Nota: </span>
      {t}
    </p>
  );
}

export function MonthDetailModal({ month, onClose }: Props) {
  const {
    income,
    expenseGroups,
    oneTime,
    totalIncome,
    totalExpenses,
    totalOneTimeExpense,
    totalOneTimeIncome,
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
                              className="flex items-start gap-3 px-3 py-2 border-b border-border/40 last:border-0 bg-surface-2/80 text-sm"
                            >
                              <div className="flex-1 min-w-0">
                                <span className="text-text-primary block truncate">{item.item_name}</span>
                                <PaidNoteBlock text={item.paid_note} />
                              </div>
                              <PaidBadge isPaid={item.is_paid} />
                              <span className="tabular-nums text-text-secondary shrink-0 pt-0.5">
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

            {/* ── Pontuais (despesas e receitas) ── */}
            {hasOneTime && (
              <section>
                <SectionHeader label="Lançamentos pontuais" />
                <ul className="flex flex-col border border-border/60 rounded-lg overflow-hidden">
                  {oneTime.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 px-3 py-2 border-b border-border/40 last:border-0 bg-surface-2/80 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-text-primary truncate">{r.item_name}</span>
                          <span
                            className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                              r.flow === 'income'
                                ? 'bg-green-500/15 text-green-500'
                                : 'bg-red-500/12 text-red-400'
                            }`}
                          >
                            {r.flow === 'income' ? 'Receita' : 'Despesa'}
                          </span>
                        </span>
                        <PaidNoteBlock text={r.paid_note} />
                      </div>
                      {r.due_date && (
                        <span className="text-xs text-text-muted shrink-0 pt-0.5">
                          {formatDate(r.due_date)}
                        </span>
                      )}
                      <OneTimePaidBadge isPaid={r.is_paid} flow={r.flow} />
                      <span
                        className={`tabular-nums font-medium shrink-0 pt-0.5 ${
                          r.flow === 'income' ? 'text-green-500' : 'text-text-secondary'
                        }`}
                      >
                        {formatBRL(r.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col gap-1.5 px-3 py-2 mt-1 rounded-lg bg-surface-3/50">
                  {totalOneTimeExpense > 0 && (
                    <div className="flex justify-between gap-3">
                      <span className="text-sm text-text-secondary">Despesas pontuais</span>
                      <span className="text-sm tabular-nums font-semibold text-red-500">
                        {formatBRL(totalOneTimeExpense)}
                      </span>
                    </div>
                  )}
                  {totalOneTimeIncome > 0 && (
                    <div className="flex justify-between gap-3">
                      <span className="text-sm text-text-secondary">Receitas pontuais</span>
                      <span className="text-sm tabular-nums font-semibold text-green-500">
                        {formatBRL(totalOneTimeIncome)}
                      </span>
                    </div>
                  )}
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
