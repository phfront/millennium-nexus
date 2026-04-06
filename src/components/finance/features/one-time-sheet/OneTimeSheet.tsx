'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2 } from 'lucide-react';
import {
  Modal,
  Input,
  Button,
  Skeleton,
  useToast,
  InlineAmountCell,
  MonthYearPicker,
  DatePicker,
} from '@phfront/millennium-ui';
import type { MonthYearValue } from '@phfront/millennium-ui';
import { useOneTime } from '@/hooks/finance/use-one-time';
import { formatBRL, formatMonth, parseBRLInput } from '@/lib/finance/format';
import { buildSpreadsheetMonthList, normalizeExpenseMonthKey, toMonthDate } from '@/lib/finance/finance';
import { useFinanceSpreadsheetSettings } from '@/contexts/FinanceSpreadsheetSettingsContext';
import { ExpensePaidNoteModal } from '@/components/finance/features/expense-paid-note-modal/ExpensePaidNoteModal';
import type { OneTimeEntry } from '@/types/finance';

const FLOW_SELECT_CLASS =
  'max-w-[108px] px-1.5 py-1 rounded-md bg-surface-3 border border-border text-[11px] text-text-primary outline-none focus:border-brand-primary';

function monthStrToMonthYear(monthDay: string): MonthYearValue {
  const d = new Date(monthDay.slice(0, 10) + 'T12:00:00');
  return { year: d.getFullYear(), month: d.getMonth() };
}

function monthYearToMonthStr(v: MonthYearValue): string {
  const m = String(v.month + 1).padStart(2, '0');
  return `${v.year}-${m}-01`;
}

function isDateInMonthYear(d: Date, my: MonthYearValue): boolean {
  return d.getFullYear() === my.year && d.getMonth() === my.month;
}

function dateToYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** ISO `YYYY-MM-DD` → `Date` ao meio-dia local (evita deslocamento de fuso). */
function ymdToDate(ymd: string | null | undefined): Date | undefined {
  if (!ymd || ymd.length < 10) return undefined;
  const d = new Date(ymd.slice(0, 10) + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function OneTimeSheet() {
  const { monthsForward } = useFinanceSpreadsheetSettings();
  const {
    expenses,
    isLoading,
    upsertExpense,
    togglePaid,
    deleteExpense,
    allNames,
    getMonthFlowTotals,
  } = useOneTime();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMonth, setNewMonth] = useState(() => toMonthDate(new Date()));
  const [newAmount, setNewAmount] = useState('');
  const [newDueDate, setNewDueDate] = useState<Date | undefined>(undefined);
  const [newFlow, setNewFlow] = useState<'expense' | 'income'>('expense');
  const [saving, setSaving] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    expenseId: string;
    isPaid: boolean;
    flow: 'expense' | 'income';
  } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const [paidNoteExpenseId, setPaidNoteExpenseId] = useState<string | null>(null);
  const [paidNoteBusy, setPaidNoteBusy] = useState(false);

  const allMonths = buildSpreadsheetMonthList(
    expenses.map((e) => e.month),
    monthsForward,
  );

  const newMonthYear = useMemo(() => monthStrToMonthYear(newMonth), [newMonth]);

  async function handleSave(id: string, name: string, month: string, value: number, flow: OneTimeEntry['flow']) {
    try {
      await upsertExpense(name, month, value, id, { flow });
    } catch {
      toast.error('Erro ao salvar');
    }
  }

  async function handleFlowChange(exp: OneTimeEntry, flow: 'expense' | 'income') {
    if (flow === exp.flow) return;
    try {
      await upsertExpense(exp.name, exp.month, exp.amount, exp.id, {
        due_date: exp.due_date,
        flow,
      });
    } catch {
      toast.error('Erro ao atualizar tipo');
    }
  }

  async function handleDueDateBlur(
    id: string,
    name: string,
    month: string,
    amount: number,
    value: string,
    flow: OneTimeEntry['flow'],
  ) {
    try {
      await upsertExpense(name, month, amount, id, { due_date: value || null, flow });
    } catch {
      toast.error('Erro ao guardar vencimento');
    }
  }

  async function handleAddNew() {
    if (!newName.trim() || !newMonth) return;
    if (newDueDate && !isDateInMonthYear(newDueDate, newMonthYear)) {
      toast.error('Data inválida', 'O vencimento tem de ser no mês selecionado.');
      return;
    }
    setSaving(true);
    try {
      const amount = parseFloat(newAmount.replace(',', '.')) || 0;
      await upsertExpense(newName.trim(), newMonth, amount, undefined, {
        due_date: newDueDate ? dateToYmd(newDueDate) : null,
        flow: newFlow,
      });
      setNewName('');
      setNewAmount('');
      setNewDueDate(undefined);
      setNewFlow('expense');
      setShowAdd(false);
      toast.success('Lançamento adicionado');
    } catch {
      toast.error('Erro ao adicionar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteExpense(id);
      toast.success('Removido');
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

  const paidNoteFlow = paidNoteExpenseId
    ? expenses.find((e) => e.id === paidNoteExpenseId)?.flow
    : undefined;

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">Lançamentos pontuais</h2>
        <Button
          size="sm"
          onClick={() => {
            setCtxMenu(null);
            setShowAdd(true);
          }}
          leftIcon={<Plus size={14} />}
        >
          Novo lançamento
        </Button>
      </div>

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-text-muted bg-surface-2 rounded-xl border border-border">
          <p className="text-sm">Nenhum lançamento pontual ainda.</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCtxMenu(null);
              setShowAdd(true);
            }}
            leftIcon={<Plus size={14} />}
          >
            Adicionar o primeiro
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-surface-3">
                <th className="sticky left-0 z-10 bg-surface-3 text-left px-3 py-2 font-medium text-text-muted border-b border-border whitespace-nowrap w-[1%]">
                  Mês
                </th>
                <th className="text-right px-3 py-2 font-medium text-text-muted border-b border-border min-w-[100px] bg-surface-3/80">
                  Total
                </th>
                <th className="text-left px-3 py-2 font-medium text-text-muted border-b border-border w-[88px]">
                  Tipo
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
                const { expense: expTot, income: incTot } = getMonthFlowTotals(month);
                if (monthExpenses.length === 0) return null;
                return monthExpenses.map((expense, idx) => (
                  <tr key={expense.id} className="hover:bg-surface-3/50 transition-colors border-b border-border/50">
                    {idx === 0 ? (
                      <td
                        rowSpan={monthExpenses.length}
                        className="sticky left-0 z-10 px-3 py-1.5 font-medium text-text-secondary bg-surface-1 border-r border-border/30 align-top whitespace-nowrap w-[1%]"
                      >
                        {formatMonth(month)}
                        {(expTot > 0 || incTot > 0) && (
                          <div className="text-[10px] font-normal mt-1 space-y-0.5">
                            {expTot > 0 && (
                              <div className="text-red-400/95">−{formatBRL(expTot)}</div>
                            )}
                            {incTot > 0 && (
                              <div className="text-green-500/95">+{formatBRL(incTot)}</div>
                            )}
                          </div>
                        )}
                      </td>
                    ) : null}
                    {idx === 0 ? (
                      <td
                        rowSpan={monthExpenses.length}
                        className="px-3 py-1.5 text-right font-semibold align-top border-r border-border/30"
                      >
                        {expTot > 0 || incTot > 0 ? (
                          <div className="flex flex-col items-end gap-0.5 text-[11px]">
                            {expTot > 0 && (
                              <span className="text-red-400 tabular-nums">{formatBRL(expTot)}</span>
                            )}
                            {incTot > 0 && (
                              <span className="text-green-500 tabular-nums">{formatBRL(incTot)}</span>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    ) : null}
                    <td className="px-2 py-1.5 align-middle">
                      <select
                        aria-label={`Tipo de ${expense.name}`}
                        className={FLOW_SELECT_CLASS}
                        value={expense.flow}
                        onChange={(e) =>
                          void handleFlowChange(expense, e.target.value as 'expense' | 'income')
                        }
                      >
                        <option value="expense">Despesa</option>
                        <option value="income">Receita</option>
                      </select>
                    </td>
                    <td className="px-3 py-1.5 text-text-primary">{expense.name}</td>
                    <td className="px-2 py-1 align-middle whitespace-nowrap min-w-[148px]">
                      <DatePicker
                        value={ymdToDate(expense.due_date)}
                        onChange={(d) => {
                          const nextYmd = d ? dateToYmd(d) : '';
                          const prevYmd = expense.due_date?.slice(0, 10) ?? '';
                          if (nextYmd === prevYmd) return;
                          void handleDueDateBlur(
                            expense.id,
                            expense.name,
                            expense.month,
                            expense.amount,
                            nextYmd,
                            expense.flow,
                          );
                        }}
                        lockToMonthYear={monthStrToMonthYear(expense.month)}
                        clearable
                        className="max-w-[168px]"
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
                                    flow: expense.flow,
                                  });
                                }
                              : undefined
                          }
                        >
                          <InlineAmountCell
                            value={expense.amount}
                            onSave={(v) =>
                              handleSave(expense.id, expense.name, expense.month, v, expense.flow)
                            }
                            formatDisplay={formatBRL}
                            parseInput={parseBRLInput}
                            highlightVariant="success"
                            highlightActive={expense.is_paid}
                            className={`rounded-md border border-border/40 px-1.5 py-1 text-xs leading-normal tabular-nums ${
                              expense.flow === 'income'
                                ? 'bg-green-500/10 border-green-500/25'
                                : 'bg-surface-3/25'
                            }`}
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
        title={paidNoteFlow === 'income' ? 'Marcar como recebido' : 'Marcar como pago'}
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
              {ctxMenu.isPaid
                ? ctxMenu.flow === 'income'
                  ? 'Desmarcar como recebido'
                  : 'Desmarcar como pago'
                : ctxMenu.flow === 'income'
                  ? 'Marcar como recebido'
                  : 'Marcar como pago'}
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
        title="Novo lançamento pontual"
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">Tipo</label>
            <select
              className="w-full px-3 py-2 rounded-lg bg-surface-3 border border-border text-sm text-text-primary outline-none focus:border-brand-primary"
              value={newFlow}
              onChange={(e) => setNewFlow(e.target.value as 'expense' | 'income')}
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </div>
          <Input
            label="Descrição"
            placeholder="Ex: Hotel, reembolso, bónus…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            list="expense-names"
          />
          <datalist id="expense-names">
            {allNames.map((n) => <option key={n} value={n} />)}
          </datalist>
          <MonthYearPicker
            label="Mês"
            value={newMonthYear}
            onChange={(v) => {
              if (!v) return;
              setNewMonth(monthYearToMonthStr(v));
              setNewDueDate((prev) => {
                if (!prev) return undefined;
                return isDateInMonthYear(prev, v) ? prev : undefined;
              });
            }}
            clearable={false}
          />
          <Input
            label="Valor (R$)"
            type="number"
            step="0.01"
            placeholder="0,00"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
          />
          <DatePicker
            label="Vencimento (opcional)"
            value={newDueDate}
            onChange={setNewDueDate}
            lockToMonthYear={newMonthYear}
            clearable
            helperText="Apenas datas do mês escolhido acima."
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowAdd(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddNew} disabled={saving || !newName.trim()}>
              Adicionar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
