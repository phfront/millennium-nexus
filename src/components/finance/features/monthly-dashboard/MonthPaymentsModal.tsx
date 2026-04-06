'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Modal, Button, useToast, InlineAmountCell } from '@phfront/millennium-ui';
import { formatBRL, formatMonth, parseBRLInput } from '@/lib/finance/format';
import { normalizeExpenseMonthKey } from '@/lib/finance/finance';
import type { ExpenseCategory, ExpenseItem, OneTimeEntry } from '@/types/finance';
import { ExpensePaidNoteModal } from '@/components/finance/features/expense-paid-note-modal/ExpensePaidNoteModal';

type Row = {
  item: ExpenseItem;
  amount: number;
  isPaid: boolean;
  paidNote: string | null;
};

type MarkPaidTarget =
  | { kind: 'item'; itemId: string }
  | { kind: 'one_time'; id: string; flow: 'expense' | 'income' };

function PaidStatusLabel({ variant = 'expense' }: { variant?: 'expense' | 'income' }) {
  const label = variant === 'income' ? 'Recebido' : 'Pago';
  return (
    <span className="inline-flex shrink-0 items-center justify-center gap-1 rounded-full text-xs font-medium px-2.5 py-1 bg-green-500/15 text-green-500">
      <Check size={12} strokeWidth={2.5} aria-hidden />
      {label}
    </span>
  );
}

export type MonthPaymentsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  month: string;
  categories: ExpenseCategory[];
  activeItems: ExpenseItem[];
  getEntry: (itemId: string, month: string) => { is_paid?: boolean; paid_note?: string | null } | undefined;
  getEffectiveExpenseAmount: (itemId: string, month: string) => number;
  upsertEntry: (itemId: string, month: string, amount: number) => Promise<unknown>;
  togglePaid: (itemId: string, month: string, paidNote?: string | null) => Promise<unknown>;
  /** Lançamentos pontuais do mês. */
  oneTimeForMonth: OneTimeEntry[];
  upsertOneTime: (
    id: string,
    name: string,
    month: string,
    amount: number,
    extra?: { flow?: 'expense' | 'income' },
  ) => Promise<unknown>;
  toggleOneTimePaid: (id: string, paidNote?: string | null) => Promise<unknown>;
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
  const [markPaidTarget, setMarkPaidTarget] = useState<MarkPaidTarget | null>(null);
  const [markPaidBusy, setMarkPaidBusy] = useState(false);

  const rows: Row[] = [];
  for (const item of activeItems) {
    if (!item.category_id) continue;
    const entry = getEntry(item.id, month);
    const amount = getEffectiveExpenseAmount(item.id, month);
    // Ocultar só zeros “implícitos” (sem linha no mês); com entrada explícita R$ 0,00 continua visível.
    if (amount <= 0 && !entry) continue;
    rows.push({
      item,
      amount,
      isPaid: Boolean(entry?.is_paid),
      paidNote: entry?.paid_note ?? null,
    });
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
    .filter((e) => Number(e.amount ?? 0) >= 0)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'));

  const oneTimePending = oneTimeRows.filter((e) => !e.is_paid);
  const oneTimePaid = oneTimeRows.filter((e) => e.is_paid);
  const oneTimePendingExp = oneTimePending.filter((e) => e.flow === 'expense');
  const oneTimePendingInc = oneTimePending.filter((e) => e.flow === 'income');
  const oneTimePaidExp = oneTimePaid.filter((e) => e.flow === 'expense');
  const oneTimePaidInc = oneTimePaid.filter((e) => e.flow === 'income');

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

  async function handleTogglePaid(itemId: string, paidNote?: string | null) {
    try {
      await togglePaid(itemId, month, paidNote);
      onDataChanged?.();
    } catch {
      toast.error('Erro ao atualizar pagamento');
    }
  }

  async function confirmMarkPaid(note: string) {
    if (!markPaidTarget) return;
    setMarkPaidBusy(true);
    try {
      if (markPaidTarget.kind === 'item') {
        await togglePaid(markPaidTarget.itemId, month, note);
      } else {
        await toggleOneTimePaid(markPaidTarget.id, note);
      }
      onDataChanged?.();
      setMarkPaidTarget(null);
    } catch {
      toast.error('Erro ao atualizar pagamento');
    } finally {
      setMarkPaidBusy(false);
    }
  }

  function requestMarkPaid(target: MarkPaidTarget) {
    setMarkPaidTarget(target);
  }

  async function handleSaveOneTime(exp: OneTimeEntry, value: number) {
    try {
      await upsertOneTime(exp.id, exp.name, monthKey, value, { flow: exp.flow });
      onDataChanged?.();
    } catch {
      toast.error('Erro ao salvar valor');
    }
  }

  async function handleToggleOneTime(id: string, paidNote?: string | null) {
    try {
      await toggleOneTimePaid(id, paidNote);
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
              Nenhum lançamento com valor neste mês.
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
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 min-w-0">
                              <span className="text-sm text-text-primary font-medium truncate sm:min-w-0 sm:flex-1">
                                {item.name}
                              </span>
                              <div className="w-full sm:w-[11rem] shrink-0">
                                <InlineAmountCell
                                  value={amount}
                                  onSave={(v) => handleSave(item.id, v)}
                                  formatDisplay={formatBRL}
                                  parseInput={parseBRLInput}
                                  highlightVariant="success"
                                  highlightActive={isPaid}
                                  className="rounded-md border border-border/45 bg-surface-3/35 px-2 py-1.5 !text-sm leading-normal tabular-nums"
                                />
                              </div>
                            </div>
                            <div className="flex flex-col items-stretch sm:items-end justify-center gap-1.5 min-w-0">
                              <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                className="self-stretch sm:self-end whitespace-nowrap"
                                onClick={() => requestMarkPaid({ kind: 'item', itemId: item.id })}
                              >
                                Marcar como pago
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                  {(oneTimePendingExp.length > 0 || oneTimePendingInc.length > 0) && (
                    <div
                      className={`flex flex-col gap-4 ${groupedPending.length === 0 ? 'mt-0' : 'mt-5'}`}
                    >
                      {oneTimePendingExp.length > 0 && (
                        <section className="pb-0">
                          <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">
                            Pontuais — despesas
                          </h4>
                          <ul className="flex flex-col gap-0 border border-border/60 rounded-lg overflow-hidden bg-surface-3/40">
                            {oneTimePendingExp.map((exp) => {
                              const amount = Number(exp.amount ?? 0);
                              return (
                                <li
                                  key={exp.id}
                                  className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:gap-4 items-center px-3 py-2.5 border-b border-border/40 last:border-b-0 bg-surface-2/80"
                                >
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 min-w-0">
                                    <span className="text-sm text-text-primary font-medium truncate sm:min-w-0 sm:flex-1">
                                      {exp.name}
                                    </span>
                                    <div className="w-full sm:w-[11rem] shrink-0">
                                      <InlineAmountCell
                                        value={amount}
                                        onSave={(v) => handleSaveOneTime(exp, v)}
                                        formatDisplay={formatBRL}
                                        parseInput={parseBRLInput}
                                        highlightVariant="success"
                                        highlightActive={false}
                                        className="rounded-md border border-border/45 bg-surface-3/35 px-2 py-1.5 !text-sm leading-normal tabular-nums"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-stretch sm:items-end justify-center gap-1.5 min-w-0">
                                    <Button
                                      type="button"
                                      variant="primary"
                                      size="sm"
                                      className="self-stretch sm:self-end whitespace-nowrap"
                                      onClick={() =>
                                        requestMarkPaid({
                                          kind: 'one_time',
                                          id: exp.id,
                                          flow: 'expense',
                                        })
                                      }
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
                      {oneTimePendingInc.length > 0 && (
                        <section className="pb-2">
                          <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">
                            Pontuais — receitas
                          </h4>
                          <ul className="flex flex-col gap-0 border border-border/60 rounded-lg overflow-hidden bg-surface-3/40">
                            {oneTimePendingInc.map((exp) => {
                              const amount = Number(exp.amount ?? 0);
                              return (
                                <li
                                  key={exp.id}
                                  className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:gap-4 items-center px-3 py-2.5 border-b border-border/40 last:border-b-0 bg-surface-2/80"
                                >
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 min-w-0">
                                    <span className="text-sm text-text-primary font-medium truncate sm:min-w-0 sm:flex-1">
                                      {exp.name}
                                    </span>
                                    <div className="w-full sm:w-[11rem] shrink-0">
                                      <InlineAmountCell
                                        value={amount}
                                        onSave={(v) => handleSaveOneTime(exp, v)}
                                        formatDisplay={formatBRL}
                                        parseInput={parseBRLInput}
                                        highlightVariant="success"
                                        highlightActive={false}
                                        className="rounded-md border border-border/45 bg-surface-3/35 px-2 py-1.5 !text-sm leading-normal tabular-nums"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-stretch sm:items-end justify-center gap-1.5 min-w-0">
                                    <Button
                                      type="button"
                                      variant="primary"
                                      size="sm"
                                      className="self-stretch sm:self-end whitespace-nowrap"
                                      onClick={() =>
                                        requestMarkPaid({
                                          kind: 'one_time',
                                          id: exp.id,
                                          flow: 'income',
                                        })
                                      }
                                    >
                                      Marcar como recebido
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
                        {catRows.map(({ item, amount, isPaid, paidNote }) => (
                          <li
                            key={item.id}
                            className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:gap-4 items-center px-3 py-2.5 border-b border-border/40 last:border-b-0 bg-surface-2/80"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4 min-w-0">
                              <div className="min-w-0 sm:flex-1">
                                <span className="text-sm text-text-primary font-medium truncate block">
                                  {item.name}
                                </span>
                                {paidNote ? (
                                  <p className="text-[11px] text-text-muted mt-1 leading-snug line-clamp-4 whitespace-pre-wrap">
                                    {paidNote}
                                  </p>
                                ) : null}
                              </div>
                              <div className="w-full sm:w-[11rem] shrink-0">
                                <InlineAmountCell
                                  value={amount}
                                  onSave={(v) => handleSave(item.id, v)}
                                  formatDisplay={formatBRL}
                                  parseInput={parseBRLInput}
                                  highlightVariant="success"
                                  highlightActive={isPaid}
                                  className="rounded-md border border-border/45 bg-surface-3/35 px-2 py-1.5 !text-sm leading-normal tabular-nums"
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
                  {(oneTimePaidExp.length > 0 || oneTimePaidInc.length > 0) && (
                    <div
                      className={`flex flex-col gap-4 ${groupedPaid.length === 0 ? 'mt-0' : 'mt-5'}`}
                    >
                      {oneTimePaidExp.length > 0 && (
                        <section className="pb-0">
                          <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">
                            Pontuais — despesas
                          </h4>
                          <ul className="flex flex-col gap-0 border border-border/60 rounded-lg overflow-hidden bg-surface-3/40">
                            {oneTimePaidExp.map((exp) => {
                              const amount = Number(exp.amount ?? 0);
                              const paidNote = exp.paid_note ?? null;
                              return (
                                <li
                                  key={exp.id}
                                  className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:gap-4 items-center px-3 py-2.5 border-b border-border/40 last:border-b-0 bg-surface-2/80"
                                >
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4 min-w-0">
                                    <div className="min-w-0 sm:flex-1">
                                      <span className="text-sm text-text-primary font-medium truncate block">
                                        {exp.name}
                                      </span>
                                      {paidNote ? (
                                        <p className="text-[11px] text-text-muted mt-1 leading-snug line-clamp-4 whitespace-pre-wrap">
                                          {paidNote}
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="w-full sm:w-[11rem] shrink-0">
                                      <InlineAmountCell
                                        value={amount}
                                        onSave={(v) => handleSaveOneTime(exp, v)}
                                        formatDisplay={formatBRL}
                                        parseInput={parseBRLInput}
                                        highlightVariant="success"
                                        highlightActive
                                        className="rounded-md border border-border/45 bg-surface-3/35 px-2 py-1.5 !text-sm leading-normal tabular-nums"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-stretch sm:items-end justify-center gap-1.5 min-w-0">
                                    <PaidStatusLabel variant="expense" />
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
                      {oneTimePaidInc.length > 0 && (
                        <section className="pb-2">
                          <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">
                            Pontuais — receitas
                          </h4>
                          <ul className="flex flex-col gap-0 border border-border/60 rounded-lg overflow-hidden bg-surface-3/40">
                            {oneTimePaidInc.map((exp) => {
                              const amount = Number(exp.amount ?? 0);
                              const paidNote = exp.paid_note ?? null;
                              return (
                                <li
                                  key={exp.id}
                                  className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:gap-4 items-center px-3 py-2.5 border-b border-border/40 last:border-b-0 bg-surface-2/80"
                                >
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4 min-w-0">
                                    <div className="min-w-0 sm:flex-1">
                                      <span className="text-sm text-text-primary font-medium truncate block">
                                        {exp.name}
                                      </span>
                                      {paidNote ? (
                                        <p className="text-[11px] text-text-muted mt-1 leading-snug line-clamp-4 whitespace-pre-wrap">
                                          {paidNote}
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="w-full sm:w-[11rem] shrink-0">
                                      <InlineAmountCell
                                        value={amount}
                                        onSave={(v) => handleSaveOneTime(exp, v)}
                                        formatDisplay={formatBRL}
                                        parseInput={parseBRLInput}
                                        highlightVariant="success"
                                        highlightActive
                                        className="rounded-md border border-border/45 bg-surface-3/35 px-2 py-1.5 !text-sm leading-normal tabular-nums"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-stretch sm:items-end justify-center gap-1.5 min-w-0">
                                    <PaidStatusLabel variant="income" />
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
                </div>
              )}
            </>
          )}
        </div>
        <ExpensePaidNoteModal
          isOpen={markPaidTarget !== null}
          onClose={() => setMarkPaidTarget(null)}
          onConfirm={(note) => confirmMarkPaid(note)}
          submitting={markPaidBusy}
          title={
            markPaidTarget?.kind === 'one_time' && markPaidTarget.flow === 'income'
              ? 'Marcar como recebido'
              : 'Marcar como pago'
          }
        />
        <div className="flex justify-end pt-4 mt-3 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </>
    </Modal>
  );
}
