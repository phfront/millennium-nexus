'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Settings, ChevronDown, ChevronRight, Pencil, Check, Trash2, Columns2 } from 'lucide-react';
import {
  Badge,
  Button,
  InlineAmountCell,
  Input,
  Modal,
  Skeleton,
  useToast,
} from '@phfront/millennium-ui';
import { useExpenses } from '@/hooks/finance/use-expenses';
import { formatBRL, formatMonth, parseBRLInput } from '@/lib/finance/format';
import {
  buildSpreadsheetMonthList,
  firstDayToMonthInputValue,
  monthInputValueToFirstDay,
  toMonthDate,
} from '@/lib/finance/finance';
import { useFinanceSpreadsheetSettings } from '@/contexts/FinanceSpreadsheetSettingsContext';
import { SpreadsheetColumnFillModal } from '@/components/finance/features/spreadsheet-column-fill-modal/SpreadsheetColumnFillModal';
import { ExpensePaidNoteModal } from '@/components/finance/features/expense-paid-note-modal/ExpensePaidNoteModal';
import type { ExpenseCategory, ExpenseItem } from '@/types/finance';

const DATA_COL = 'w-[128px] min-w-[128px] max-w-[128px]';

const UNCATEGORIZED_ID = '__uncategorized__' as const;

type ExpenseDisplayGroup = {
  id: string;
  name: string;
  items: ExpenseItem[];
  isUncategorized: boolean;
};

function currentMonthInputValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_INPUT_CLASS =
  'w-full px-3 py-2 rounded-lg bg-surface-3 border border-transparent text-sm text-text-primary outline-none ring-1 ring-inset ring-border focus:ring-brand-primary';

function ManageExpenseItemRow({
  item,
  onEdit,
}: {
  item: ExpenseItem;
  onEdit: (item: ExpenseItem) => void;
}) {
  return (
    <li
      className={`flex min-w-0 items-center gap-2 border-b border-border/70 px-2 py-2.5 last:border-b-0 hover:bg-surface-4/40 ${
        !item.is_active ? 'opacity-80' : ''
      }`}
    >
      <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{item.name}</span>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        {!item.is_active && (
          <Badge variant="muted" size="sm">
            Inativa
          </Badge>
        )}
        {item.is_recurring && (
          <Badge variant="success" size="sm">
            Rec.
          </Badge>
        )}
        <button
          type="button"
          onClick={() => onEdit(item)}
          className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
          title="Editar item"
          aria-label={`Editar ${item.name}`}
        >
          <Pencil size={14} strokeWidth={2} />
        </button>
      </div>
    </li>
  );
}

function ManageExpenseItemList({
  itemsList,
  onEditItem,
}: {
  itemsList: ExpenseItem[];
  onEditItem: (item: ExpenseItem) => void;
}) {
  if (itemsList.length === 0) {
    return <p className="px-1 py-2 text-xs text-text-muted">Nenhum item nesta categoria.</p>;
  }
  return (
    <ul
      className="mt-1.5 overflow-hidden rounded-lg border border-border/80 bg-surface-2/80"
      aria-label="Itens da categoria"
    >
      {itemsList.map((item) => (
        <ManageExpenseItemRow key={item.id} item={item} onEdit={onEditItem} />
      ))}
    </ul>
  );
}

export function ExpensesSheet() {
  const { monthsForward } = useFinanceSpreadsheetSettings();
  const {
    categories,
    activeItems,
    items,
    entries,
    isLoading,
    refetch,
    upsertEntry,
    togglePaid,
    addCategory,
    updateCategory,
    deleteCategory,
    addItem,
    updateItem,
    getEntry,
    getMonthlyTotal,
    getCategoryTotal,
    getUncategorizedTotal,
    getEffectiveExpenseAmount,
    ensureRecurringExpenseEntriesForMonths,
    fillItemColumnForMonths,
  } = useExpenses();
  const { toast } = useToast();
  const [columnFillTarget, setColumnFillTarget] = useState<{ itemId: string; name: string } | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [showManage, setShowManage] = useState(false);
  /** list = itens + novo; form = criar ou editar (mesmo formulário) */
  const [manageStep, setManageStep] = useState<'list' | 'form'>('list');
  const [newCatName, setNewCatName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [formCatId, setFormCatId] = useState('');
  const [formName, setFormName] = useState('');
  const [formMonthFrom, setFormMonthFrom] = useState(currentMonthInputValue);
  const [formMonthTo, setFormMonthTo] = useState(currentMonthInputValue);
  const [formDefaultAmount, setFormDefaultAmount] = useState('');
  const [formRecurring, setFormRecurring] = useState(false);
  /** Vazio = sem vencimento; 1–31 = dia do mês em cada coluna da planilha. */
  const [formDueDay, setFormDueDay] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    itemId: string;
    month: string;
    isPaid: boolean;
  } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const [paidNoteTarget, setPaidNoteTarget] = useState<{ itemId: string; month: string } | null>(null);
  const [paidNoteBusy, setPaidNoteBusy] = useState(false);

  const allMonths = buildSpreadsheetMonthList(
    entries.map((e) => e.month),
    monthsForward,
  );

  const allMonthsKey = allMonths.join('|');
  const itemsKey = items
    .map((i) => `${i.id}:${i.is_recurring}:${i.default_amount}:${i.is_active}:${i.due_day ?? ''}`)
    .join('|');

  const expenseDisplayGroups = useMemo((): ExpenseDisplayGroup[] => {
    const out: ExpenseDisplayGroup[] = [];
    for (const cat of categories) {
      const catItems = activeItems.filter((i) => i.category_id === cat.id);
      if (catItems.length > 0) {
        out.push({ id: cat.id, name: cat.name, items: catItems, isUncategorized: false });
      }
    }
    const uncat = activeItems.filter((i) => !i.category_id);
    if (uncat.length > 0) {
      out.push({
        id: UNCATEGORIZED_ID,
        name: 'Sem categoria',
        items: uncat,
        isUncategorized: true,
      });
    }
    return out;
  }, [categories, activeItems]);

  /** Colunas de dados após Mês + Total (1 se grupo colapsado, N itens se expandido). */
  const expenseColCount = useMemo(() => {
    return expenseDisplayGroups.reduce(
      (n, g) => n + (collapsedCats.has(g.id) ? 1 : g.items.length),
      0,
    );
  }, [expenseDisplayGroups, collapsedCats]);

  useEffect(() => {
    if (isLoading) return;
    void ensureRecurringExpenseEntriesForMonths(allMonths);
  }, [isLoading, allMonthsKey, itemsKey, ensureRecurringExpenseEntriesForMonths]);

  function toggleCat(catId: string) {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  async function handleSave(itemId: string, month: string, value: number) {
    try {
      await upsertEntry(itemId, month, value);
    } catch {
      toast.error('Erro ao salvar');
    }
  }

  async function handleTogglePaid(itemId: string, month: string, paidNote?: string | null) {
    try {
      await togglePaid(itemId, month, paidNote);
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
        await handleTogglePaid(ctxMenu.itemId, ctxMenu.month);
      } finally {
        setCtxMenu(null);
      }
      return;
    }
    setPaidNoteTarget({ itemId: ctxMenu.itemId, month: ctxMenu.month });
    setCtxMenu(null);
  }

  async function confirmPaidNote(note: string) {
    if (!paidNoteTarget) return;
    setPaidNoteBusy(true);
    try {
      await handleTogglePaid(paidNoteTarget.itemId, paidNoteTarget.month, note);
      setPaidNoteTarget(null);
    } finally {
      setPaidNoteBusy(false);
    }
  }

  function resetItemForm() {
    setEditingItemId(null);
    setFormName('');
    setFormCatId(categories[0]?.id ?? '');
    const cur = currentMonthInputValue();
    setFormMonthFrom(cur);
    setFormMonthTo(cur);
    setFormDefaultAmount('');
    setFormRecurring(false);
    setFormDueDay('');
    setFormActive(true);
  }

  function openNewItemForm() {
    resetItemForm();
    setManageStep('form');
  }

  async function goBackToList() {
    setManageStep('list');
    resetItemForm();
    try {
      await refetch();
    } catch {
      toast.error('Erro ao recarregar dados');
    }
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    setSaving(true);
    try {
      await addCategory(newCatName.trim());
      setNewCatName('');
      toast.success('Categoria adicionada');
      await refetch();
    } catch {
      toast.error('Erro ao adicionar categoria');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCategoryEdit() {
    if (!editingCategoryId || !editingCategoryName.trim()) return;
    setSaving(true);
    try {
      await updateCategory(editingCategoryId, { name: editingCategoryName.trim() });
      setEditingCategoryId(null);
      setEditingCategoryName('');
      toast.success('Categoria atualizada');
      await refetch();
    } catch {
      toast.error('Erro ao atualizar categoria');
    } finally {
      setSaving(false);
    }
  }

  function cancelCategoryEdit() {
    setEditingCategoryId(null);
    setEditingCategoryName('');
  }

  async function handleDeleteCategory(cat: ExpenseCategory) {
    const n = items.filter((i) => i.category_id === cat.id).length;
    const msg =
      n > 0
        ? `Excluir "${cat.name}"? Os ${n} item(ns) passam a ficar sem categoria.`
        : `Excluir a categoria "${cat.name}"?`;
    if (!confirm(msg)) return;
    setSaving(true);
    try {
      await deleteCategory(cat.id);
      if (editingCategoryId === cat.id) cancelCategoryEdit();
      toast.success('Categoria excluída');
      await refetch();
    } catch {
      toast.error('Erro ao excluir categoria');
    } finally {
      setSaving(false);
    }
  }

  function beginEditItem(item: ExpenseItem) {
    setEditingItemId(item.id);
    setFormCatId(item.category_id ?? '');
    setFormName(item.name);
    setFormDefaultAmount(item.default_amount != null ? String(item.default_amount) : '');
    setFormRecurring(item.is_recurring);
    setFormDueDay(item.due_day != null ? String(item.due_day) : '');
    setFormActive(item.is_active);

    const itemEntries = entries.filter((e) => e.item_id === item.id);
    if (itemEntries.length === 0) {
      const cur = currentMonthInputValue();
      setFormMonthFrom(cur);
      setFormMonthTo(cur);
    } else {
      const keys = itemEntries
        .map((e) => (e.month.length >= 10 ? e.month.slice(0, 10) : e.month))
        .sort((a, b) => a.localeCompare(b));
      setFormMonthFrom(firstDayToMonthInputValue(keys[0]!));
      setFormMonthTo(firstDayToMonthInputValue(keys[keys.length - 1]!));
    }
    setManageStep('form');
  }

  async function handleSubmitItemForm() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const defRaw = formDefaultAmount.trim();
      const def =
        defRaw === '' ? null : Math.max(0, parseFloat(defRaw.replace(',', '.')) || 0);
      const catId = formCatId || null;
      let dueDay: number | null = null;
      if (formDueDay.trim() !== '') {
        const n = parseInt(formDueDay.trim(), 10);
        if (Number.isFinite(n) && n >= 1 && n <= 31) dueDay = n;
      }
      if (editingItemId) {
        await updateItem(
          editingItemId,
          {
            name: formName.trim(),
            category_id: catId,
            default_amount: def,
            is_recurring: formRecurring,
            is_active: formActive,
            due_day: dueDay,
          },
          formRecurring ? undefined : { monthFrom: formMonthFrom, monthTo: formMonthTo },
        );
        toast.success('Despesa atualizada');
      } else {
        const monthAnchor = toMonthDate(new Date());
        await addItem(catId, formName.trim(), {
          defaultAmount: def,
          isRecurring: formRecurring,
          monthFrom: formRecurring ? monthAnchor : monthInputValueToFirstDay(formMonthFrom),
          monthTo: formRecurring ? monthAnchor : monthInputValueToFirstDay(formMonthTo),
          visibleMonths: allMonths,
          dueDay,
        });
        toast.success('Item adicionado');
      }
      await goBackToList();
    } catch {
      toast.error(editingItemId ? 'Erro ao guardar alterações' : 'Erro ao adicionar item');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">Planilha de Despesas</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setCtxMenu(null);
            setManageStep('list');
            setShowManage(true);
          }}
          leftIcon={<Settings size={14} />}
        >
          Gerenciar
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table
          className={
            expenseColCount > 0
              ? 'w-full table-fixed text-xs border-collapse'
              : 'w-max max-w-full text-xs border-collapse'
          }
        >
          <colgroup>
            <col className="w-20" />
            <col className="w-[118px]" />
            {expenseColCount > 0 &&
              Array.from({ length: expenseColCount }, (_, i) => <col key={i} className={DATA_COL} />)}
          </colgroup>
          <thead>
            <tr className="bg-surface-3">
              <th className="sticky left-0 z-10 bg-surface-3 text-left px-2 py-2 font-medium text-text-muted border-b border-border whitespace-nowrap">
                Mês
              </th>
              <th className="text-right px-2 py-2 font-medium text-text-muted border-b border-border min-w-[118px] bg-surface-3/80">
                Total
              </th>
              {expenseDisplayGroups.map((g) => {
                const isCollapsed = collapsedCats.has(g.id);
                return isCollapsed ? (
                  <th
                    key={g.id}
                    className={`text-right px-3 py-2 font-semibold text-text-primary border-b border-border cursor-pointer hover:bg-surface-4 ${DATA_COL}`}
                    onClick={() => toggleCat(g.id)}
                    colSpan={1}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <ChevronRight size={12} />
                      {g.name}
                    </div>
                  </th>
                ) : (
                  g.items.map((item, idx) => (
                    <th
                      key={idx === 0 ? `cat-${g.id}` : `cat-${g.id}-${item.id}`}
                      className={
                        idx === 0
                          ? `text-right px-3 py-2 font-semibold text-text-primary border-b border-border cursor-pointer hover:bg-surface-4 ${DATA_COL}`
                          : `border-b border-border bg-surface-3 ${DATA_COL}`
                      }
                      onClick={idx === 0 ? () => toggleCat(g.id) : undefined}
                    >
                      {idx === 0 ? (
                        <div className="flex items-center justify-end gap-1">
                          <ChevronDown size={12} />
                          {g.name}
                        </div>
                      ) : null}
                    </th>
                  ))
                );
              })}
            </tr>
            {/* Sub-header com nomes dos itens */}
            <tr className="bg-surface-2">
              <th className="sticky left-0 z-10 bg-surface-2 border-b border-border whitespace-nowrap" />
              <th className="border-b border-border min-w-[118px]" />
              {expenseDisplayGroups.map((g) => {
                if (collapsedCats.has(g.id)) return null;
                return g.items.map((item) => (
                  <th
                    key={item.id}
                    className={`align-top border-b border-border bg-surface-2 ${DATA_COL} px-2 py-2`}
                  >
                    <div className="flex flex-col gap-2 min-h-13">
                      <div className="flex items-start justify-between gap-1">
                        <span
                          className="text-left text-sm font-semibold text-text-primary leading-snug wrap-break-word line-clamp-3"
                          title={item.name}
                        >
                          {item.name}
                          {item.due_day != null && (
                            <span className="block text-[10px] font-normal text-text-muted mt-0.5">
                              Venc. dia {item.due_day}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          className="shrink-0 p-1 rounded-md text-text-muted hover:text-brand-primary hover:bg-surface-3 transition-colors cursor-pointer"
                          title="Preencher todos os meses visíveis com o mesmo valor"
                          aria-label={`Preencher coluna ${item.name} em todos os meses`}
                          onClick={() => setColumnFillTarget({ itemId: item.id, name: item.name })}
                        >
                          <Columns2 size={16} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  </th>
                ));
              })}
            </tr>
          </thead>
          <tbody>
            {allMonths.map((month, i) => {
              const rowTotal = getMonthlyTotal(month);
              return (
                <tr
                  key={month}
                  className={`hover:bg-surface-3/50 transition-colors ${i % 2 === 0 ? 'bg-surface-1' : 'bg-surface-2'}`}
                >
                  <td className="sticky left-0 z-10 px-2 py-1.5 font-medium text-text-secondary border-b border-border/50 bg-inherit whitespace-nowrap">
                    {formatMonth(month)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold text-text-primary border-b border-border/50 min-w-[118px]">
                    {rowTotal > 0 ? formatBRL(rowTotal) : <span className="text-text-muted">—</span>}
                  </td>
                  {expenseDisplayGroups.map((g) => {
                    if (collapsedCats.has(g.id)) {
                      const catTotal = g.isUncategorized
                        ? getUncategorizedTotal(month)
                        : getCategoryTotal(g.id, month);
                      return (
                        <td
                          key={g.id}
                          className="px-3 py-1.5 text-right font-semibold text-text-primary border-b border-border/50"
                        >
                          {catTotal > 0 ? formatBRL(catTotal) : <span className="text-text-muted">—</span>}
                        </td>
                      );
                    }
                    return g.items.map((item) => {
                      const entry = getEntry(item.id, month);
                      const effective = getEffectiveExpenseAmount(item.id, month);
                      return (
                        <td key={item.id} className={`px-1 py-1 border-b border-border/50 min-w-0 ${DATA_COL}`}>
                          <div
                            className="min-w-0 w-full cursor-pointer select-none [-webkit-touch-callout:none]"
                            onContextMenu={
                              effective > 0
                                ? (e) => {
                                    e.preventDefault();
                                    setCtxMenu({
                                      x: e.clientX,
                                      y: e.clientY,
                                      itemId: item.id,
                                      month,
                                      isPaid: entry?.is_paid ?? false,
                                    });
                                  }
                                : undefined
                            }
                          >
                            <InlineAmountCell
                              value={effective}
                              onSave={(v) => handleSave(item.id, month, v)}
                              formatDisplay={formatBRL}
                              parseInput={parseBRLInput}
                              highlightVariant="success"
                              highlightActive={entry?.is_paid ?? false}
                              className="rounded-md border border-border/40 bg-surface-3/25 px-1.5 py-1 text-xs leading-normal tabular-nums"
                            />
                          </div>
                        </td>
                      );
                    });
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SpreadsheetColumnFillModal
        isOpen={columnFillTarget != null}
        onClose={() => setColumnFillTarget(null)}
        columnLabel={columnFillTarget?.name ?? ''}
        monthCount={allMonths.length}
        onApply={async (amount) => {
          if (!columnFillTarget) return;
          try {
            await fillItemColumnForMonths(columnFillTarget.itemId, allMonths, amount);
            toast.success('Coluna atualizada');
          } catch {
            toast.error('Erro ao preencher coluna');
          }
        }}
      />

      <ExpensePaidNoteModal
        isOpen={paidNoteTarget !== null}
        onClose={() => setPaidNoteTarget(null)}
        onConfirm={(note) => confirmPaidNote(note)}
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

      {/* Modal Gerenciar */}
      <Modal
        isOpen={showManage}
        onClose={() => {
          const wasForm = manageStep === 'form';
          setShowManage(false);
          setManageStep('list');
          setEditingCategoryId(null);
          setEditingCategoryName('');
          resetItemForm();
          if (wasForm) void refetch();
        }}
        title={
          manageStep === 'list'
            ? 'Gerenciar Categorias e Itens'
            : editingItemId
              ? 'Editar despesa'
              : 'Novo item'
        }
      >
        {manageStep === 'list' ? (
          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-text-muted">Nova categoria</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <Input
                  className="min-w-0 flex-1"
                  placeholder="Nome da categoria"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                />
                <Button
                  className="shrink-0 sm:w-auto"
                  onClick={handleAddCategory}
                  disabled={saving}
                  leftIcon={<Plus size={14} />}
                >
                  Criar
                </Button>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-semibold text-text-muted uppercase">Existentes</p>
                <Button size="sm" onClick={openNewItemForm} leftIcon={<Plus size={14} />}>
                  Novo
                </Button>
              </div>
              <div className="flex max-h-[min(22rem,55vh)] flex-col gap-3 overflow-y-auto pr-1">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="rounded-xl border border-border bg-surface-3 p-3 shadow-sm"
                  >
                    <div className="mb-2 flex min-w-0 items-start justify-between gap-2 border-b border-border/60 pb-2">
                      {editingCategoryId === cat.id ? (
                        <div className="flex flex-1 flex-wrap items-center gap-1 min-w-0">
                          <Input
                            className="min-w-0 flex-1"
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && void handleSaveCategoryEdit()}
                          />
                          <Button
                            size="sm"
                            disabled={saving || !editingCategoryName.trim()}
                            onClick={() => void handleSaveCategoryEdit()}
                            leftIcon={<Check size={14} />}
                          >
                            OK
                          </Button>
                          <Button size="sm" variant="ghost" disabled={saving} onClick={cancelCategoryEdit}>
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
                            {cat.name}
                          </p>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategoryId(cat.id);
                                setEditingCategoryName(cat.name);
                              }}
                              className="p-1 rounded hover:bg-surface-4 text-text-secondary hover:text-text-primary"
                              title="Editar categoria"
                              aria-label={`Editar categoria ${cat.name}`}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteCategory(cat)}
                              disabled={saving}
                              className="p-1 rounded hover:bg-surface-4 text-text-secondary hover:text-red-400 disabled:opacity-50"
                              title="Excluir categoria"
                              aria-label={`Excluir categoria ${cat.name}`}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    <ManageExpenseItemList
                      itemsList={items.filter((i) => i.category_id === cat.id)}
                      onEditItem={beginEditItem}
                    />
                  </div>
                ))}
                {items.some((i) => !i.category_id) && (
                  <div className="rounded-xl border border-dashed border-border bg-surface-3/40 p-3">
                    <p className="mb-2 text-sm font-semibold text-text-secondary">Sem categoria</p>
                    <ManageExpenseItemList
                      itemsList={items.filter((i) => !i.category_id)}
                      onEditItem={beginEditItem}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start -mt-1"
              disabled={saving}
              onClick={() => void goBackToList()}
            >
              ← Voltar
            </Button>
            <div className="flex flex-col gap-2">
              <select
                value={formCatId}
                onChange={(e) => setFormCatId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-3 border border-border text-sm text-text-primary outline-none focus:border-brand-primary"
              >
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Nome do item"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleSubmitItemForm()}
              />
              {!formRecurring && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-text-muted uppercase tracking-wide block mb-1">
                        Mês inicial
                      </label>
                      <input
                        type="month"
                        value={formMonthFrom}
                        onChange={(e) => setFormMonthFrom(e.target.value)}
                        className={MONTH_INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-text-muted uppercase tracking-wide block mb-1">
                        Mês final
                      </label>
                      <input
                        type="month"
                        value={formMonthTo}
                        onChange={(e) => setFormMonthTo(e.target.value)}
                        className={MONTH_INPUT_CLASS}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-text-muted -mt-1">
                    {editingItemId
                      ? 'Meses fora do intervalo deixam de ter linhas nesta despesa; meses novos no intervalo usam o valor padrão (se houver) ou zero.'
                      : 'O mesmo mês nos dois campos = um único mês. O valor abaixo é aplicado a todos os meses do intervalo.'}
                  </p>
                </>
              )}
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder={editingItemId ? 'Valor padrão (R$) — opcional' : 'Valor (R$) — opcional'}
                value={formDefaultAmount}
                onChange={(e) => setFormDefaultAmount(e.target.value)}
              />
              <div>
                <label className="text-[10px] font-medium text-text-muted uppercase tracking-wide block mb-1">
                  Dia de vencimento (opcional)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Ex.: 5 — cada mês vence no dia 5"
                  value={formDueDay}
                  onChange={(e) => setFormDueDay(e.target.value)}
                />
                <p className="text-[10px] text-text-muted mt-1">
                  Usado para lembretes push (Configurações). Meses com menos dias usam o último dia do mês.
                </p>
              </div>
              <label className="flex items-start gap-2 cursor-pointer text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={formRecurring}
                  onChange={(e) => setFormRecurring(e.target.checked)}
                  className="mt-1 rounded border-border"
                />
                <span>
                  <span className="font-medium text-text-primary">Recorrente na planilha</span>
                  <span className="block text-xs text-text-muted mt-0.5">
                    {editingItemId
                      ? 'Com valor &gt; 0, aplica o padrão aos meses visíveis sem valor próprio.'
                      : 'Com valor &gt; 0, preenche automaticamente todos os meses visíveis na planilha. Podes alterar qualquer mês à mão.'}
                  </span>
                </span>
              </label>
              {editingItemId && (
                <label className="flex items-center gap-2 cursor-pointer text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="font-medium text-text-primary">Mostrar na planilha</span>
                </label>
              )}
              <Button
                onClick={() => void handleSubmitItemForm()}
                disabled={saving || !formName.trim()}
                leftIcon={editingItemId ? <Check size={14} /> : <Plus size={14} />}
              >
                {editingItemId ? 'Guardar' : 'Adicionar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
