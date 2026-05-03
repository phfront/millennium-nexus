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
import { cn } from '@/lib/utils';
import { SpreadsheetColumnFillModal } from '@/components/finance/features/spreadsheet-column-fill-modal/SpreadsheetColumnFillModal';
import { ExpensePaidNoteModal } from '@/components/finance/features/expense-paid-note-modal/ExpensePaidNoteModal';
import { CategoryColorPicker } from '@/components/finance/features/expenses-sheet/CategoryColorPicker';
import type { ExpenseCategory, ExpenseItem } from '@/types/finance';

/** `table-auto` + nowrap: columns grow with label/value; floor fits typical BRL in `text-xs`. */
const SPREADSHEET_DATA_COL = 'min-w-40 whitespace-nowrap px-2';

function hexToRgba(hex: string, alpha: number): string {
  const t = hex.trim().replace('#', '');
  if (t.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(t)) return `rgba(100, 116, 139, ${alpha})`;
  const r = parseInt(t.slice(0, 2), 16);
  const g = parseInt(t.slice(2, 4), 16);
  const b = parseInt(t.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function categoryTint(color: string | null | undefined) {
  if (!color) return { band: undefined as string | undefined, cell: undefined as string | undefined, accent: undefined as string | undefined };
  return {
    band: hexToRgba(color, 0.18),
    cell: hexToRgba(color, 0.08),
    accent: color,
  };
}

const UNCATEGORIZED_ID = '__uncategorized__' as const;

type ExpenseDisplayGroup = {
  id: string;
  name: string;
  items: ExpenseItem[];
  isUncategorized: boolean;
  color: string | null;
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
      className="mt-1.5 rounded-lg border border-border/80 bg-surface-2/80"
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
  /** Incrementado ao abrir Gerenciar para reinicializar o accordion (evita bug com Strict Mode). */
  const [manageListSession, setManageListSession] = useState(0);
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  /** Categorias expandidas no modal Gerenciar (accordion). */
  const [manageExpandedCats, setManageExpandedCats] = useState<Set<string>>(() => new Set());
  /** list = itens + novo; form = criar ou editar (mesmo formulário) */
  const [manageStep, setManageStep] = useState<'list' | 'form'>('list');
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState<string | null>(null);
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
  const [editingCategoryColor, setEditingCategoryColor] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    itemId: string;
    month: string;
    isPaid: boolean;
  } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  /** Accordion: full expand on Gerenciar open; same session only expands newly added ids (keeps user collapse). */
  const manageAccordionInitRef = useRef<{
    session: number;
    dataKey: string;
    lastCanonical: Set<string>;
  }>({ session: -1, dataKey: '', lastCanonical: new Set() });
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
        out.push({
          id: cat.id,
          name: cat.name,
          items: catItems,
          isUncategorized: false,
          color: cat.color ?? null,
        });
      }
    }
    const uncat = activeItems.filter((i) => !i.category_id);
    if (uncat.length > 0) {
      out.push({
        id: UNCATEGORIZED_ID,
        name: 'Sem categoria',
        items: uncat,
        isUncategorized: true,
        color: null,
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

  /** Re-sync accordion when category ids / uncat flag change, without resetting on unrelated item edits. */
  const manageCategoryDataKey = useMemo(
    () =>
      `${categories.map((c) => c.id).sort().join('|')}|${items.some((i) => !i.category_id) ? '1' : '0'}`,
    [categories, items],
  );

  useEffect(() => {
    if (isLoading) return;
    void ensureRecurringExpenseEntriesForMonths(allMonths);
  }, [isLoading, allMonthsKey, itemsKey, ensureRecurringExpenseEntriesForMonths]);

  useEffect(() => {
    if (!showManage) return;

    const canonical = new Set<string>(categories.map((c) => c.id));
    if (items.some((i) => !i.category_id)) canonical.add(UNCATEGORIZED_ID);

    const ref = manageAccordionInitRef.current;
    const isNewSession = ref.session !== manageListSession;

    if (isNewSession) {
      ref.session = manageListSession;
      ref.dataKey = manageCategoryDataKey;
      ref.lastCanonical = new Set(canonical);
      setManageExpandedCats(new Set(canonical));
      return;
    }

    if (ref.dataKey === manageCategoryDataKey) return;
    ref.dataKey = manageCategoryDataKey;

    const prevCanon = ref.lastCanonical;
    ref.lastCanonical = new Set(canonical);

    setManageExpandedCats((prev) => {
      const next = new Set(prev);
      for (const id of canonical) {
        if (!prevCanon.has(id)) next.add(id);
      }
      for (const id of [...next]) {
        if (!canonical.has(id)) next.delete(id);
      }
      return next;
    });
  }, [showManage, manageListSession, manageCategoryDataKey, categories, items]);

  function toggleManageAccordion(catId: string) {
    setManageExpandedCats((prev) => {
      const n = new Set(prev);
      if (n.has(catId)) n.delete(catId);
      else n.add(catId);
      return n;
    });
  }

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

  function openNewItemForm(preselectedCategoryId?: string) {
    setEditingItemId(null);
    setFormName('');
    const cur = currentMonthInputValue();
    setFormMonthFrom(cur);
    setFormMonthTo(cur);
    setFormDefaultAmount('');
    setFormRecurring(false);
    setFormDueDay('');
    setFormActive(true);
    setFormCatId(
      preselectedCategoryId !== undefined ? preselectedCategoryId : (categories[0]?.id ?? ''),
    );
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
      const row = await addCategory(newCatName.trim(), newCatColor ?? undefined);
      if (row?.id) {
        setManageExpandedCats((prev) => new Set(prev).add(row.id));
      }
      setNewCatName('');
      setNewCatColor(null);
      setShowNewCategoryModal(false);
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
      await updateCategory(editingCategoryId, {
        name: editingCategoryName.trim(),
        color: editingCategoryColor,
      });
      setEditingCategoryId(null);
      setEditingCategoryName('');
      setEditingCategoryColor(null);
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
    setEditingCategoryColor(null);
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
            setManageListSession((s) => s + 1);
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
              ? 'w-max min-w-full table-auto text-xs border-collapse'
              : 'w-max max-w-full text-xs border-collapse'
          }
        >
          <colgroup>
            <col className="w-20" />
            <col className="min-w-40" />
            {expenseColCount > 0 &&
              Array.from({ length: expenseColCount }, (_, i) => (
                <col key={i} className="min-w-40" />
              ))}
          </colgroup>
          <thead>
            <tr className="bg-surface-3">
              <th className="sticky left-0 z-10 bg-surface-3 text-left px-2 py-2 font-medium text-text-muted border-b border-border whitespace-nowrap">
                Mês
              </th>
              <th className="text-right px-2 py-2 font-medium text-text-muted border-b border-border min-w-40 whitespace-nowrap bg-surface-3/80">
                Total
              </th>
              {expenseDisplayGroups.map((g) => {
                const isCollapsed = collapsedCats.has(g.id);
                const tint = g.isUncategorized ? categoryTint(null) : categoryTint(g.color);
                return isCollapsed ? (
                  <th
                    key={g.id}
                    rowSpan={2}
                    className="cursor-pointer border-b border-border bg-surface-3 px-2 py-2 text-left font-semibold text-text-primary hover:bg-surface-4 min-w-40 whitespace-nowrap align-top"
                    style={{
                      ...(tint.band ? { backgroundColor: tint.band } : {}),
                      borderBottomWidth: tint.accent ? 2 : undefined,
                      borderBottomColor: tint.accent,
                      borderBottomStyle: tint.accent ? 'solid' : undefined,
                    }}
                    onClick={() => toggleCat(g.id)}
                    colSpan={1}
                    title={`${g.name} — expandir itens`}
                  >
                    <div className="flex w-full items-center justify-start gap-2 text-sm font-semibold">
                      <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-text-secondary" />
                      {tint.accent ? (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full ring-1 ring-inset ring-border/40"
                          style={{ backgroundColor: tint.accent }}
                          aria-hidden
                        />
                      ) : null}
                      <span className="min-w-0 truncate" title={g.name}>
                        {g.name}
                      </span>
                    </div>
                  </th>
                ) : (
                  <th
                    key={`cat-${g.id}`}
                    colSpan={g.items.length}
                    className={`bg-surface-3 text-left py-2 font-semibold text-text-primary border-b border-border cursor-pointer hover:bg-surface-4 ${SPREADSHEET_DATA_COL}`}
                    style={{
                      ...(tint.band ? { backgroundColor: tint.band } : {}),
                      borderBottomWidth: tint.accent ? 2 : undefined,
                      borderBottomColor: tint.accent,
                      borderBottomStyle: tint.accent ? 'solid' : undefined,
                    }}
                    onClick={() => toggleCat(g.id)}
                    title={`${g.name} — colapsar itens`}
                  >
                    <div className="flex min-w-0 items-center justify-start gap-2 whitespace-nowrap text-sm font-semibold">
                      <ChevronDown size={16} strokeWidth={2} className="shrink-0 text-text-secondary" />
                      {tint.accent ? (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full ring-1 ring-inset ring-border/40"
                          style={{ backgroundColor: tint.accent }}
                          aria-hidden
                        />
                      ) : null}
                      <span className="min-w-0 truncate">{g.name}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
            {/* Sub-header com nomes dos itens */}
            <tr className="bg-surface-2">
              <th className="sticky left-0 z-10 bg-surface-2 border-b border-border whitespace-nowrap" />
              <th className="border-b border-border min-w-40" />
              {expenseDisplayGroups.map((g) => {
                if (collapsedCats.has(g.id)) return null;
                const tint = g.isUncategorized ? categoryTint(null) : categoryTint(g.color);
                return g.items.map((item) => (
                  <th
                    key={item.id}
                    className={`align-top border-b border-border bg-surface-2 ${SPREADSHEET_DATA_COL} py-2`}
                    style={tint.cell ? { backgroundColor: tint.cell } : undefined}
                  >
                    <div className="relative min-h-13">
                      <button
                        type="button"
                        className="absolute left-0 top-0 z-10 p-1 rounded-md text-text-muted hover:text-brand-primary hover:bg-surface-3 transition-colors cursor-pointer"
                        title="Preencher todos os meses visíveis com o mesmo valor"
                        aria-label={`Preencher coluna ${item.name} em todos os meses`}
                        onClick={() => setColumnFillTarget({ itemId: item.id, name: item.name })}
                      >
                        <Columns2 size={16} strokeWidth={2} />
                      </button>
                      <span className="block w-full pl-8 text-left text-sm font-semibold text-text-primary leading-snug">
                        <span className="whitespace-nowrap" title={item.name}>
                          {item.name}
                        </span>
                        {item.due_day != null && (
                          <span className="mt-0.5 block text-[10px] font-normal text-text-muted whitespace-nowrap">
                            Venc. dia {item.due_day}
                          </span>
                        )}
                      </span>
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
                  <td className="px-2 py-1.5 text-right font-semibold text-text-primary border-b border-border/50 min-w-40 whitespace-nowrap">
                    {rowTotal > 0 ? formatBRL(rowTotal) : <span className="text-text-muted">—</span>}
                  </td>
                  {expenseDisplayGroups.map((g) => {
                    const tint = g.isUncategorized ? categoryTint(null) : categoryTint(g.color);
                    if (collapsedCats.has(g.id)) {
                      const catTotal = g.isUncategorized
                        ? getUncategorizedTotal(month)
                        : getCategoryTotal(g.id, month);
                      return (
                        <td
                          key={g.id}
                          className="min-w-40 whitespace-nowrap px-2 py-1.5 text-right font-semibold text-text-primary border-b border-border/50"
                          style={tint.cell ? { backgroundColor: tint.cell } : undefined}
                        >
                          {catTotal > 0 ? formatBRL(catTotal) : <span className="text-text-muted">—</span>}
                        </td>
                      );
                    }
                    return g.items.map((item) => {
                      const entry = getEntry(item.id, month);
                      const effective = getEffectiveExpenseAmount(item.id, month);
                      return (
                        <td
                          key={item.id}
                          className={`border-b border-border/50 ${SPREADSHEET_DATA_COL} py-1`}
                          style={tint.cell ? { backgroundColor: tint.cell } : undefined}
                        >
                          <div
                            className="w-full cursor-pointer select-none [-webkit-touch-callout:none]"
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
          setShowNewCategoryModal(false);
          setManageStep('list');
          setEditingCategoryId(null);
          setEditingCategoryName('');
          setEditingCategoryColor(null);
          setNewCatName('');
          setNewCatColor(null);
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
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm text-text-secondary">
                  Agrupa despesas fixas por categoria. Cada categoria pode ter cor na planilha.
                </p>
              </div>
              <Button
                type="button"
                className="shrink-0"
                onClick={() => {
                  setNewCatName('');
                  setNewCatColor(null);
                  setShowNewCategoryModal(true);
                }}
                disabled={saving}
                leftIcon={<Plus size={14} />}
              >
                Nova categoria
              </Button>
            </div>

            <div className="flex min-h-0 max-h-[min(24rem,58vh)] flex-col gap-3 overflow-y-auto pr-1">
              {categories.length === 0 && !items.some((i) => !i.category_id) ? (
                <p className="shrink-0 rounded-lg border border-dashed border-border/80 bg-surface-2/40 px-4 py-8 text-center text-sm text-text-muted">
                  Ainda não tens categorias. Cria uma para começar a organizar itens.
                </p>
              ) : null}
              {categories.map((cat) => {
                const expanded = manageExpandedCats.has(cat.id);
                const itemCount = items.filter((i) => i.category_id === cat.id).length;
                return (
                  <div
                    key={cat.id}
                    className="shrink-0 overflow-hidden rounded-lg border border-border/80 bg-surface-2/30 shadow-sm"
                  >
                    <div className="flex min-w-0 items-stretch">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left outline-none ring-0 ring-offset-0 transition-colors hover:bg-surface-3/60 focus-visible:bg-surface-3/55 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        onClick={() => toggleManageAccordion(cat.id)}
                        aria-expanded={expanded}
                      >
                        <ChevronDown
                          size={18}
                          strokeWidth={2}
                          className={cn(
                            'shrink-0 text-text-muted transition-transform duration-200 ease-out motion-reduce:duration-0',
                            expanded ? 'rotate-0' : '-rotate-90',
                          )}
                        />
                        {cat.color ? (
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-border/50"
                            style={{ backgroundColor: cat.color }}
                            aria-hidden
                          />
                        ) : (
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-border ring-1 ring-inset ring-border/40" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1 truncate font-semibold text-text-primary">{cat.name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-text-muted">
                          {itemCount} {itemCount === 1 ? 'item' : 'itens'}
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-1 border-l border-border/50 bg-surface-3/40 px-2 py-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="shrink-0"
                          disabled={saving}
                          onClick={(e) => {
                            e.stopPropagation();
                            openNewItemForm(cat.id);
                          }}
                          leftIcon={<Plus size={14} />}
                        >
                          Item
                        </Button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={(e) => {
                            e.stopPropagation();
                            setManageExpandedCats((prev) => new Set(prev).add(cat.id));
                            setEditingCategoryId(cat.id);
                            setEditingCategoryName(cat.name);
                            setEditingCategoryColor(cat.color ?? null);
                          }}
                          className="rounded-md p-2 text-text-secondary transition-colors hover:bg-surface-4 hover:text-text-primary disabled:opacity-50"
                          title="Editar categoria"
                          aria-label={`Editar categoria ${cat.name}`}
                        >
                          <Pencil size={14} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteCategory(cat);
                          }}
                          className="rounded-md p-2 text-text-secondary transition-colors hover:bg-surface-4 hover:text-red-400 disabled:opacity-50"
                          title="Excluir categoria"
                          aria-label={`Excluir categoria ${cat.name}`}
                        >
                          <Trash2 size={14} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                    <div
                      className={cn(
                        'grid transition-[grid-template-rows] duration-200 ease-in-out motion-reduce:transition-none',
                        expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                      )}
                    >
                      <div className="min-h-0 overflow-hidden" aria-hidden={!expanded}>
                        <div className="mt-1 border-t border-border/50 bg-surface-1/40 px-3 pt-4 pb-4">
                          {editingCategoryId === cat.id ? (
                            <div className="flex flex-col gap-3 rounded-md border border-border/60 bg-surface-3/50 p-3">
                              <div>
                                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted">
                                  Nome
                                </label>
                                <Input
                                  value={editingCategoryName}
                                  onChange={(e) => setEditingCategoryName(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && void handleSaveCategoryEdit()}
                                />
                              </div>
                              <div>
                                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-text-muted">
                                  Cor na planilha
                                </label>
                                <CategoryColorPicker
                                  value={editingCategoryColor}
                                  onChange={setEditingCategoryColor}
                                  disabled={saving}
                                />
                              </div>
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button size="sm" variant="ghost" disabled={saving} onClick={cancelCategoryEdit}>
                                  Cancelar
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={saving || !editingCategoryName.trim()}
                                  onClick={() => void handleSaveCategoryEdit()}
                                  leftIcon={<Check size={14} />}
                                >
                                  Guardar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <ManageExpenseItemList
                              itemsList={items.filter((i) => i.category_id === cat.id)}
                              onEditItem={beginEditItem}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {items.some((i) => !i.category_id) ? (
                <div className="shrink-0 overflow-hidden rounded-lg border border-dashed border-border/70 bg-surface-2/20">
                  <div className="flex min-w-0 items-stretch">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left outline-none ring-0 ring-offset-0 transition-colors hover:bg-surface-3/40 focus-visible:bg-surface-3/45 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                      onClick={() => toggleManageAccordion(UNCATEGORIZED_ID)}
                      aria-expanded={manageExpandedCats.has(UNCATEGORIZED_ID)}
                    >
                      <ChevronDown
                        size={18}
                        strokeWidth={2}
                        className={cn(
                          'shrink-0 text-text-muted transition-transform duration-200 ease-out motion-reduce:duration-0',
                          manageExpandedCats.has(UNCATEGORIZED_ID) ? 'rotate-0' : '-rotate-90',
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate font-semibold text-text-secondary">Sem categoria</span>
                      <span className="shrink-0 text-xs tabular-nums text-text-muted">
                        {items.filter((i) => !i.category_id).length} itens
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center border-l border-border/50 bg-surface-3/30 px-2 py-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={saving}
                        onClick={(e) => {
                          e.stopPropagation();
                          openNewItemForm('');
                        }}
                        leftIcon={<Plus size={14} />}
                      >
                        Item
                      </Button>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'grid transition-[grid-template-rows] duration-200 ease-in-out motion-reduce:transition-none',
                      manageExpandedCats.has(UNCATEGORIZED_ID) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                    )}
                  >
                    <div
                      className="min-h-0 overflow-hidden"
                      aria-hidden={!manageExpandedCats.has(UNCATEGORIZED_ID)}
                    >
                      <div className="mt-1 border-t border-border/50 bg-surface-1/30 px-3 pt-4 pb-4">
                        <ManageExpenseItemList
                          itemsList={items.filter((i) => !i.category_id)}
                          onEditItem={beginEditItem}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
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

      <Modal
        isOpen={showNewCategoryModal}
        onClose={() => {
          if (saving) return;
          setShowNewCategoryModal(false);
          setNewCatName('');
          setNewCatColor(null);
        }}
        title="Nova categoria"
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Nome
            </label>
            <Input
              placeholder="Ex.: Cartões, Casa…"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleAddCategory()}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Cor na planilha (opcional)
            </label>
            <CategoryColorPicker value={newCatColor} onChange={setNewCatColor} disabled={saving} />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setShowNewCategoryModal(false);
                setNewCatName('');
                setNewCatColor(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={saving || !newCatName.trim()}
              onClick={() => void handleAddCategory()}
              leftIcon={<Plus size={14} />}
            >
              Criar categoria
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
