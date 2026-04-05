'use client';

import { Check } from 'lucide-react';
import { Modal, Button, useToast, InlineAmountCell } from '@phfront/millennium-ui';
import { formatBRL, formatMonth, parseBRLInput } from '@/lib/finance/format';
import { normalizeExpenseMonthKey } from '@/lib/finance/finance';
import type { ExpenseCategory, ExpenseItem, OneTimeExpense } from '@/types/finance';

type Row = {
  item: ExpenseItem;
  amount: number;
  isPaid: boolean;
};

function PaidStatusLabel() {
  return (
    <span className="inline-flex shrink-0 items-center justify-center gap-1 rounded-full text-xs font-medium px-2.5 py-1 bg-green-500/15 text-green-500">
      <Check size={12} strokeWidth={2.5} aria-hidden />
      Pago
    </span>
  );
}

export type MonthPaymentsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  month: string;
  categories: ExpenseCategory[];
  activeItems: ExpenseItem[];
  getEntry: (itemId: string, month: string) => { is_paid?: boolean } | undefined;
  getEffectiveExpenseAmount: (itemId: string, month: string) => number;
  upsertEntry: (itemId: string, month: string, amount: number) => Promise<unknown>;
  togglePaid: (itemId: string, month: string) => Promise<unknown>;
  /** Despesas pontuais do mês (já filtradas). */
  oneTimeForMonth: OneTimeExpense[];
  upsertOneTime: (id: string, name: string, month: string, amount: number) => Promise<unknown>;
  toggleOneTimePaid: (id: string) => Promise<unknown>;
  /** Chamado após alteração guardada (ex.: refetch do resumo mensal no dashboard). */
  onDataChanged?: () => void;
};

export function MonthPaymentsModal({
  isOpen,
  onClose,
  month,
  categories,
  activeItems,
  getEntry,
  getEffectiveExpenseAmount,
  upsertEntry,
  togglePaid,
  oneTimeForMonth,
  upsertOneTime,
  toggleOneTimePaid,
  onDataChanged,
}: MonthPaymentsModalProps) {
  const { toast } = useToast();
  const monthKey = normalizeExpenseMonthKey(month);

  const rows: Row[] = [];
  for (const item of activeItems) {
    if (!item.category_id) continue;
    const amount = getEffectiveExpenseAmount(item.id, month);
    if (amount <= 0) continue;
    const entry = getEntry(item.id, month);
    rows.push({ item, amount, isPaid: Boolean(entry?.is_paid) });
  }
  const byCat = new Map<string, Row[]>();
  for (const row of rows) {
    const cid = row.item.category_id!;
    if (!byCat.has(cid)) byCat.set(cid, []);
    byCat.get(cid)!.push(row);
  }
  for (const arr of byCat.values()) {
    arr.sort((a, b) => {
      const so = a.item.sort_order - b.item.sort_order;
      if (so !== 0) return so;
      return a.item.name.localeCompare(b.item.name, 'pt');
    });
  }

  const groupedPending = categories
    .map((c) => ({
      category: c,
      rows: (byCat.get(c.id) ?? []).filter((r) => !r.isPaid),
    }))
    .filter((g) => g.rows.length > 0);

  const groupedPaid = categories
    .map((c) => ({
      category: c,
      rows: (byCat.get(c.id) ?? []).filter((r) => r.isPaid),
    }))
    .filter((g) => g.rows.length > 0);

  const oneTimeRows = oneTimeForMonth
    .filter((e) => Number(e.amount ?? 0) > 0)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'));

  const oneTimePending = oneTimeRows.filter((e) => !e.is_paid);
  const oneTimePaid = oneTimeRows.filter((e) => e.is_paid);

  const hasPending = groupedPending.length > 0 || oneTimePending.length > 0;
  const hasPaid = groupedPaid.length > 0 || oneTimePaid.length > 0;

  async function handleSave(itemId: string, value: number) {
    try {
      await upsertEntry(itemId, month, value);
      onDataChanged?.();
    } catch {
      toast.error('Erro ao salvar valor');
    }
  }

  async function handleTogglePaid(itemId: string) {
    try {
      await togglePaid(itemId, month);
      onDataChanged?.();
    } catch {
      toast.error('Erro ao atualizar pagamento');
    }
  }

  async function handleSaveOneTime(exp: OneTimeExpense, value: number) {
    try {
      await upsertOneTime(exp.id, exp.name, monthKey, value);
      onDataChanged?.();
    } catch {
      toast.error('Erro ao salvar valor');
    }
  }

  async function handleToggleOneTime(id: string) {
    try {
      await toggleOneTimePaid(id);
      onDataChanged?.();
    } catch {
      toast.error('Erro ao atualizar pagamento');
    }
  }

  const showEmpty = rows.length === 0 && oneTimeRows.length === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Pagamentos — ${formatMonth(month)}`}
      size="lg"
    >
      <>
        <div className="flex flex-col gap-1 -mx-1 px-1">
          {showEmpty ? (
            <p className="text-sm text-text-muted py-6 text-center">
              Nenhuma despesa com valor neste mês.
            </p>
          ) : (
            <>
              {hasPending && (
                <div className="flex flex-col">
                  {groupedPending.map(({ category, rows: catRows }, idx) => (
                    <section key={category.id} className={`pb-2 ${idx === 0 ? 'mt-0' : 'mt-5'}`}>
                      <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">
                        {category.name}
                      </h4>
                      <ul className="flex flex-col gap-0 border border-border/60 rounded-lg overflow-hidden bg-surface-3/40">
                        {catRows.map(({ item, amount, isPaid }) => (
                          <li
                            key={item.id}
                            className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:gap-4 items-center px-3 py-2.5 border-b border-border/40 last:border-b-0 bg-surface-2/80"
                          >
                            <div className="flex flex-col gap-1 min-w-0">
                              <span className="text-sm text-text-primary font-medium truncate">{item.name}</span>
                              <div className="w-full max-w-44">
                                <InlineAmountCell
                                  value={amount}
                                  onSave={(v) => handleSave(item.id, v)}
                                  formatDisplay={formatBRL}
                                  parseInput={parseBRLInput}
                                  highlightVariant="success"
                                  highlightActive={isPaid}
                                />
                              </div>
                            </div>
                            <div className="flex flex-col items-stretch sm:items-end justify-center gap-1.5 min-w-0">
                              <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                className="self-stretch sm:self-end whitespace-nowrap"
                                onClick={() => void handleTogglePaid(item.id)}
                              >
                                Marcar como pago
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                  {oneTimePending.length > 0 && (
                    <section
                      className={`pb-2 ${groupedPending.length === 0 ? 'mt-0' : 'mt-5'}`}
                    >
                      <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">
                        Pontuais
                      </h4>
                      <ul className="flex flex-col gap-0 border border-border/60 rounded-lg overflow-hidden bg-surface-3/40">
                        {oneTimePending.map((exp) => {
                          const amount = Number(exp.amount ?? 0);
                          return (
                            <li
                              key={exp.id}
                              className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:gap-4 items-center px-3 py-2.5 border-b border-border/40 last:border-b-0 bg-surface-2/80"
                            >
                              <div className="flex flex-col gap-1 min-w-0">
                                <span className="text-sm text-text-primary font-medium truncate">{exp.name}</span>
                                <div className="w-full max-w-44">
                                  <InlineAmountCell
                                    value={amount}
                                    onSave={(v) => handleSaveOneTime(exp, v)}
                                    formatDisplay={formatBRL}
                                    parseInput={parseBRLInput}
                                    highlightVariant="success"
                                    highlightActive={false}
                                  />
                                </div>
                              </div>
                              <div className="flex flex-col items-stretch sm:items-end justify-center gap-1.5 min-w-0">
                                <Button
                                  type="button"
                                  variant="primary"
                                  size="sm"
                                  className="self-stretch sm:self-end whitespace-nowrap"
                                  onClick={() => void handleToggleOneTime(exp.id)}
                                >
                                  Marcar como pago
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}
                </div>
              )}

              {hasPaid && (
                <div
                  className={
                    hasPending ? 'mt-6 pt-5 border-t border-border/80 flex flex-col' : 'flex flex-col'
                  }
                >
                  <h3 className="text-xs font-semibold text-text-primary tracking-wide mb-3">
                    Já pagos
                  </h3>
                  {groupedPaid.map(({ category, rows: catRows }, idx) => (
                    <section key={category.id} className={`pb-2 ${idx === 0 ? 'mt-0' : 'mt-5'}`}>
                      <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">
                        {category.name}
                      </h4>
                      <ul className="flex flex-col gap-0 border border-border/60 rounded-lg overflow-hidden bg-surface-3/40">
                        {catRows.map(({ item, amount, isPaid }) => (
                          <li
                            key={item.id}
                            className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:gap-4 items-center px-3 py-2.5 border-b border-border/40 last:border-b-0 bg-surface-2/80"
                          >
                            <div className="flex flex-col gap-1 min-w-0">
                              <span className="text-sm text-text-primary font-medium truncate">{item.name}</span>
                              <div className="w-full max-w-44">
                                <InlineAmountCell
                                  value={amount}
                                  onSave={(v) => handleSave(item.id, v)}
                                  formatDisplay={formatBRL}
                                  parseInput={parseBRLInput}
                                  highlightVariant="success"
                                  highlightActive={isPaid}
                                />
                              </div>
                            </div>
                            <div className="flex flex-col items-stretch sm:items-end justify-center gap-1.5 min-w-0">
                              <PaidStatusLabel />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="self-stretch sm:self-end h-8 text-xs text-text-muted"
                                onClick={() => void handleTogglePaid(item.id)}
                              >
                                Desmarcar
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                  {oneTimePaid.length > 0 && (
                    <section className={`pb-2 ${groupedPaid.length === 0 ? 'mt-0' : 'mt-5'}`}>
                      <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">
                        Pontuais
                      </h4>
                      <ul className="flex flex-col gap-0 border border-border/60 rounded-lg overflow-hidden bg-surface-3/40">
                        {oneTimePaid.map((exp) => {
                          const amount = Number(exp.amount ?? 0);
                          return (
                            <li
                              key={exp.id}
                              className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:gap-4 items-center px-3 py-2.5 border-b border-border/40 last:border-b-0 bg-surface-2/80"
                            >
                              <div className="flex flex-col gap-1 min-w-0">
                                <span className="text-sm text-text-primary font-medium truncate">{exp.name}</span>
                                <div className="w-full max-w-44">
                                  <InlineAmountCell
                                    value={amount}
                                    onSave={(v) => handleSaveOneTime(exp, v)}
                                    formatDisplay={formatBRL}
                                    parseInput={parseBRLInput}
                                    highlightVariant="success"
                                    highlightActive
                                  />
                                </div>
                              </div>
                              <div className="flex flex-col items-stretch sm:items-end justify-center gap-1.5 min-w-0">
                                <PaidStatusLabel />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="self-stretch sm:self-end h-8 text-xs text-text-muted"
                                  onClick={() => void handleToggleOneTime(exp.id)}
                                >
                                  Desmarcar
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex justify-end pt-4 mt-3 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </>
    </Modal>
  );
}
