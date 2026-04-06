'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Modal, Input, Button, Skeleton, useToast, InlineAmountCell } from '@phfront/millennium-ui';
import { useOneTime } from '@/hooks/finance/use-one-time';
import { formatBRL, formatMonth, parseBRLInput } from '@/lib/finance/format';
import { buildSpreadsheetMonthList, normalizeExpenseMonthKey, toMonthDate } from '@/lib/finance/finance';
import { useFinanceSpreadsheetSettings } from '@/contexts/FinanceSpreadsheetSettingsContext';
import { ExpensePaidNoteModal } from '@/components/finance/features/expense-paid-note-modal/ExpensePaidNoteModal';

export function OneTimeSheet() {
  const { monthsForward } = useFinanceSpreadsheetSettings();
  const { expenses, isLoading, upsertExpense, togglePaid, deleteExpense, allNames } = useOneTime();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMonth, setNewMonth] = useState(() => toMonthDate(new Date()));
  const [newAmount, setNewAmount] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    expenseId: string;
    isPaid: boolean;
  } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const [paidNoteExpenseId, setPaidNoteExpenseId] = useState<string | null>(null);
  const [paidNoteBusy, setPaidNoteBusy] = useState(false);

  const allMonths = buildSpreadsheetMonthList(
    expenses.map((e) => e.month),
    monthsForward,
  );

  async function handleSave(id: string, name: string, month: string, value: number) {
    try {
      await upsertExpense(name, month, value, id);
    } catch {
      toast.error('Erro ao salvar');
    }
  }

  async function handleDueDateBlur(
    id: string,
    name: string,
    month: string,
    amount: number,
    value: string,
  ) {
    try {
      await upsertExpense(name, month, amount, id, { due_date: value || null });
    } catch {
      toast.error('Erro ao guardar vencimento');
    }
  }

  async function handleAddNew() {
    if (!newName.trim() || !newMonth) return;
    setSaving(true);
    try {
      const amount = parseFloat(newAmount.replace(',', '.')) || 0;
      await upsertExpense(newName.trim(), newMonth, amount, undefined, {
        due_date: newDueDate || null,
      });
      setNewName('');
      setNewAmount('');
      setNewDueDate('');
      setShowAdd(false);
      toast.success('Despesa adicionada');
    } catch {
      toast.error('Erro ao adicionar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteExpense(id);
      toast.success('Despesa removida');
    } catch {
      toast.error('Erro ao remover');
    }
  }

  async function handleTogglePaidExpense(id: string, paidNote?: string | null) {
    try {
      await togglePaid(id, paidNote);
    } catch {
      toast.error('Erro ao atualizar status');
    }
  }

  useEffect(() => {
    if (!ctxMenu) return;
    const onDown = (e: MouseEvent) => {
      if (ctxMenuRef.current?.contains(e.target as Node)) return;
      setCtxMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtxMenu(null);
    };
    const t = window.setTimeout(() => {
      document.addEventListener('mousedown', onDown, true);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [ctxMenu]);

  async function applyCtxTogglePaid() {
    if (!ctxMenu) return;
    if (ctxMenu.isPaid) {
      try {
        await handleTogglePaidExpense(ctxMenu.expenseId);
      } finally {
        setCtxMenu(null);
      }
      return;
    }
    setPaidNoteExpenseId(ctxMenu.expenseId);
    setCtxMenu(null);
  }

  async function confirmOneTimePaidNote(note: string) {
    if (!paidNoteExpenseId) return;
    setPaidNoteBusy(true);
    try {
      await handleTogglePaidExpense(paidNoteExpenseId, note);
      setPaidNoteExpenseId(null);
    } finally {
      setPaidNoteBusy(false);
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">Despesas Pontuais</h2>
        <Button
          size="sm"
          onClick={() => {
            setCtxMenu(null);
            setShowAdd(true);
          }}
          leftIcon={<Plus size={14} />}
        >
          Nova Despesa
        </Button>
      </div>

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-text-muted bg-surface-2 rounded-xl border border-border">
          <p className="text-sm">Nenhuma despesa pontual ainda.</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCtxMenu(null);
              setShowAdd(true);
            }}
            leftIcon={<Plus size={14} />}
          >
            Adicionar a primeira
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-surface-3">
                <th className="sticky left-0 z-10 bg-surface-3 text-left px-3 py-2 font-medium text-text-muted border-b border-border whitespace-nowrap w-[1%]">
                  Mês
                </th>
                <th className="text-right px-3 py-2 font-medium text-text-muted border-b border-border min-w-[100px] bg-surface-3/80">
                  Total
                </th>
                <th className="text-left px-3 py-2 font-medium text-text-muted border-b border-border">
                  Descrição
                </th>
                <th className="text-left px-2 py-2 font-medium text-text-muted border-b border-border whitespace-nowrap w-[1%]">
                  Venc.
                </th>
                <th className="text-right px-2 py-2 font-medium text-text-muted border-b border-border whitespace-nowrap w-[1%]">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {allMonths.map((month) => {
                const monthExpenses = expenses.filter(
                  (e) => normalizeExpenseMonthKey(e.month) === normalizeExpenseMonthKey(month),
                );
                const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
                if (monthExpenses.length === 0) return null;
                return monthExpenses.map((expense, idx) => (
                  <tr key={expense.id} className="hover:bg-surface-3/50 transition-colors border-b border-border/50">
                    {idx === 0 ? (
                      <td
                        rowSpan={monthExpenses.length}
                        className="sticky left-0 z-10 px-3 py-1.5 font-medium text-text-secondary bg-surface-1 border-r border-border/30 align-top whitespace-nowrap w-[1%]"
                      >
                        {formatMonth(month)}
                        {monthTotal > 0 && (
                          <div className="text-[10px] text-text-muted font-normal mt-0.5">{formatBRL(monthTotal)}</div>
                        )}
                      </td>
                    ) : null}
                    {idx === 0 ? (
                      <td rowSpan={monthExpenses.length} className="px-3 py-1.5 text-right font-semibold text-text-primary align-top border-r border-border/30">
                        {monthTotal > 0 ? formatBRL(monthTotal) : '—'}
                      </td>
                    ) : null}
                    <td className="px-3 py-1.5 text-text-primary">{expense.name}</td>
                    <td className="px-2 py-1 align-middle whitespace-nowrap">
                      <input
                        type="date"
                        className="max-w-[128px] px-1.5 py-1 rounded-md bg-surface-3 border border-border text-[11px] text-text-primary outline-none focus:border-brand-primary"
                        defaultValue={expense.due_date?.slice(0, 10) ?? ''}
                        key={`${expense.id}-${expense.due_date ?? ''}`}
                        onBlur={(e) => {
                          const v = e.target.value;
                          const prev = expense.due_date?.slice(0, 10) ?? '';
                          if (v === prev) return;
                          void handleDueDateBlur(
                            expense.id,
                            expense.name,
                            expense.month,
                            expense.amount,
                            v,
                          );
                        }}
                        aria-label={`Vencimento de ${expense.name}`}
                      />
                    </td>
                    <td className="px-2 py-1 text-right align-middle whitespace-nowrap w-[1%]">
                      <div className="inline-flex items-center justify-end gap-0.5">
                        <div
                          className="w-[110px] min-w-0 cursor-pointer select-none [-webkit-touch-callout:none]"
                          onContextMenu={
                            expense.amount > 0
                              ? (e) => {
                                  e.preventDefault();
                                  setCtxMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    expenseId: expense.id,
                                    isPaid: expense.is_paid,
                                  });
                                }
                              : undefined
                          }
                        >
                          <InlineAmountCell
                            value={expense.amount}
                            onSave={(v) => handleSave(expense.id, expense.name, expense.month, v)}
                            formatDisplay={formatBRL}
                            parseInput={parseBRLInput}
                            highlightVariant="success"
                            highlightActive={expense.is_paid}
                            className="rounded-md border border-border/40 bg-surface-3/25 px-1.5 py-1 text-xs leading-normal tabular-nums"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(expense.id)}
                          className="shrink-0 p-1 rounded text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Remover"
                          aria-label={`Remover ${expense.name}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}

      <ExpensePaidNoteModal
        isOpen={paidNoteExpenseId !== null}
        onClose={() => setPaidNoteExpenseId(null)}
        onConfirm={(note) => confirmOneTimePaidNote(note)}
        submitting={paidNoteBusy}
      />

      {ctxMenu &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={ctxMenuRef}
            role="menu"
            aria-label="Estado de pagamento"
            className="z-200 min-w-48 rounded-lg border border-border bg-surface-2 py-1 text-sm shadow-xl"
            style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              className="w-full cursor-pointer px-3 py-2 text-left text-text-primary hover:bg-surface-4"
              onClick={() => void applyCtxTogglePaid()}
            >
              {ctxMenu.isPaid ? 'Desmarcar como pago' : 'Marcar como pago'}
            </button>
          </div>,
          document.body,
        )}

      <Modal
        isOpen={showAdd}
        onClose={() => {
          setCtxMenu(null);
          setShowAdd(false);
        }}
        title="Nova Despesa Pontual"
      >
        <div className="flex flex-col gap-3">
          <Input
            label="Descrição"
            placeholder="Ex: Hotel CWB, Carro Localiza"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            list="expense-names"
          />
          <datalist id="expense-names">
            {allNames.map((n) => <option key={n} value={n} />)}
          </datalist>
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">Mês</label>
            <input
              type="month"
              value={newMonth.substring(0, 7)}
              onChange={(e) => setNewMonth(e.target.value + '-01')}
              className="w-full px-3 py-2 rounded-lg bg-surface-3 border border-border text-sm text-text-primary outline-none focus:border-brand-primary"
            />
          </div>
          <Input
            label="Valor (R$)"
            type="number"
            step="0.01"
            placeholder="0,00"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
          />
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">Vencimento (opcional)</label>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-3 border border-border text-sm text-text-primary outline-none focus:border-brand-primary"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button onClick={handleAddNew} disabled={saving || !newName.trim()}>Adicionar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
