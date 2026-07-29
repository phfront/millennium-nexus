'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  Trash2,
  Columns2,
  CreditCard,
} from 'lucide-react';
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
import { useSubscriptions } from '@/hooks/finance/use-subscriptions';
import { useFinanceMonthSnapshots } from '@/hooks/finance/use-finance-month-snapshots';
import { formatMonth } from '@/lib/finance/format';
import { currencySymbol } from '@/lib/finance/currency';
import { useMoneyFormat } from '@/hooks/finance/use-money-format';
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
import {
  BUDGET_CLASSES,
  BUDGET_CLASS_LABEL,
  BUDGET_CLASS_SHORT,
  type BudgetClass,
  type CardBreakdown,
  type ExpenseCategory,
  type ExpenseItem,
} from '@/types/finance';
import type { MoneyFormat } from '@/hooks/finance/use-money-format';

/** Cor do chip por balde — `deduction` fica neutro por não ser gasto de vida. */
const BUDGET_CLASS_BADGE: Record<BudgetClass, 'info' | 'warning' | 'success' | 'muted'> = {
  essential: 'info',
  optional: 'warning',
  investment: 'success',
  deduction: 'muted',
};

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
  if (!color) {
    return {
      band: undefined as string | undefined,
      cell: undefined as string | undefined,
      /** Sem cor de categoria não há alternância: o zebrado das linhas fica visível. */
      cellAlt: undefined as string | undefined,
      accent: undefined as string | undefined,
    };
  }
  return {
    band: hexToRgba(color, 0.18),
    cell: hexToRgba(color, 0.07),
    /** Colunas ímpares do grupo: mesma cor, um passo mais forte — separa sem virar listra. */
    cellAlt: hexToRgba(color, 0.13),
    accent: color,
  };
}

/** Fundo da coluna dentro do grupo: alterna para as colunas vizinhas não se fundirem. */
function columnTint(tint: ReturnType<typeof categoryTint>, index: number): string | undefined {
  return index % 2 === 1 ? tint.cellAlt : tint.cell;
}

const UNCATEGORIZED_ID = '__uncategorized__' as const;

/** Categorias colapsadas na planilha, persistidas entre sessões. */
const COLLAPSED_CATS_STORAGE_KEY = 'nexus:finance:expenses:collapsed-cats';

function readCollapsedCats(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(COLLAPSED_CATS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

type ExpenseDisplayGroup = {
  id: string;
  name: string;
  items: ExpenseItem[];
  isUncategorized: boolean;
  color: string | null;
};

/**
 * O que ainda não tem nome dentro de uma fatura, por baixo do valor dela.
 * Nada aparece enquanto nada estiver detalhado — só há “a detalhar” quando
 * existe alguma linha paga dentro do cartão.
 *
 * No arquivo do mês a mesma quantia chama-se “restante” (ver a vista
 * finance_expense_archive_rows): num mês fechado já não há nada a detalhar,
 * e pedir uma ação sobre o passado seria mentira.
 *
 * As assinaturas vinculadas a este cartão aparecem numa linha à parte, e de
 * propósito NÃO entram no cálculo do restante: elas não somam em lado nenhum
 * (nem no total do mês, nem no orçamento), então abatê-las da fatura faria o
 * total do mês cair sem que se tivesse gasto menos. Aqui elas são legenda da
 * fatura, não parcela dela.
 */
function CardResidualHint({
  breakdown,
  subscriptions,
  money,
}: {
  breakdown: CardBreakdown;
  subscriptions?: { total: number; count: number };
  money: MoneyFormat;
}) {
  const showResidual = breakdown.itemizedCount > 0;
  const showSubscriptions = (subscriptions?.count ?? 0) > 0;
  if (!showResidual && !showSubscriptions) return null;
  const over = breakdown.residualAmount < 0;

  return (
    <div className="-mt-1.5 px-2 pb-1 text-right text-[10px] leading-tight tabular-nums">
      {showSubscriptions && (
        <div
          className="text-text-secondary"
          title={`${subscriptions!.count} assinatura(s) ativa(s) vinculada(s) a este cartão. Não abate do “a detalhar”: a lista de assinaturas é informativa e não entra no total do mês. Anuais contam pelo equivalente mensal, e a lista não tem histórico — vale a de hoje.`}
        >
          assinaturas {money.format(subscriptions!.total)}
        </div>
      )}
      {showResidual && (over ? (
        <span
          className="font-semibold text-danger"
          title="As linhas pagas dentro deste cartão somam mais do que a fatura — ou falta valor na fatura, ou há linha a mais"
        >
          ⚠ excede {money.format(Math.abs(breakdown.residualAmount))}
        </span>
      ) : (
        <span
          className={breakdown.residualAmount > 0 ? 'text-text-secondary' : 'text-success'}
          title={`Fatura ${money.format(breakdown.invoiceAmount)} · detalhado ${money.format(breakdown.itemizedAmount)} em ${breakdown.itemizedCount} linha(s)`}
        >
          a detalhar {money.format(breakdown.residualAmount)}
        </span>
      ))}
    </div>
  );
}

function currentMonthInputValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_INPUT_CLASS =
  'w-full px-3 py-2 rounded-lg bg-surface-3 border border-transparent text-sm text-text-primary outline-none ring-1 ring-inset ring-border focus:ring-brand-primary';

function ManageExpenseItemRow({
  item,
  onEdit,
  onAskRemove,
}: {
  item: ExpenseItem;
  onEdit: (item: ExpenseItem) => void;
  onAskRemove: (item: ExpenseItem) => void;
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
        {item.budget_class ? (
          <Badge variant={BUDGET_CLASS_BADGE[item.budget_class]} size="sm">
            {BUDGET_CLASS_SHORT[item.budget_class]}
          </Badge>
        ) : (
          <Badge variant="danger" size="sm" title="Sem classificação de orçamento">
            A classificar
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
        <button
          type="button"
          onClick={() => onAskRemove(item)}
          className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-3 hover:text-red-400"
          title="Remover item"
          aria-label={`Remover ${item.name}`}
        >
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </div>
    </li>
  );
}

function ManageExpenseItemList({
  itemsList,
  onEditItem,
  onAskRemoveItem,
}: {
  itemsList: ExpenseItem[];
  onEditItem: (item: ExpenseItem) => void;
  onAskRemoveItem: (item: ExpenseItem) => void;
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
        <ManageExpenseItemRow
          key={item.id}
          item={item}
          onEdit={onEditItem}
          onAskRemove={onAskRemoveItem}
        />
      ))}
    </ul>
  );
}

export function ExpensesSheet({
  manageOpen,
  onManageOpenChange,
}: {
  manageOpen?: boolean;
  onManageOpenChange?: (open: boolean) => void;
}) {
  const money = useMoneyFormat();
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
    deleteItem,
    getEntry,
    cardItems,
    getCardBreakdown,
    getMonthlyTotal,
    getCategoryTotal,
    getUncategorizedTotal,
    getEffectiveExpenseAmount,
    ensureRecurringExpenseEntriesForMonths,
    fillItemColumnForMonths,
  } = useExpenses();
  const { active: activeSubscriptions } = useSubscriptions();
  const { toast } = useToast();
  const { snapshots } = useFinanceMonthSnapshots();
  const [columnFillTarget, setColumnFillTarget] = useState<{ itemId: string; name: string } | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(readCollapsedCats);
  const [internalManageOpen, setInternalManageOpen] = useState(false);
  const showManage = manageOpen !== undefined ? manageOpen : internalManageOpen;
  const setShowManage = onManageOpenChange ?? setInternalManageOpen;
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
  /** Balde do orçamento; '' = a classificar. */
  const [formBudgetClass, setFormBudgetClass] = useState<BudgetClass | ''>('');
  /** Vazio = sem vencimento; 1–31 = dia do mês em cada coluna da planilha. */
  const [formDueDay, setFormDueDay] = useState('');
  /** Esta linha é a fatura de um cartão. */
  const [formIsCard, setFormIsCard] = useState(false);
  /** Item-cartão dentro do qual esta despesa é paga; '' = fora de cartão. */
  const [formPaidWithItemId, setFormPaidWithItemId] = useState('');
  /** Um cartão não se paga dentro de si próprio. */
  const selectableCardItems = cardItems.filter((c) => c.id !== editingItemId);
  /**
   * Quanto de assinatura ativa está vinculado a cada cartão, para a coluna
   * poder dizê-lo. Anuais entram pelo equivalente mensal — é a mesma conta da
   * tela de Assinaturas, e sem saber o mês da renovação não há melhor.
   */
  const subscriptionsByCard = useMemo(() => {
    const acc = new Map<string, { total: number; count: number }>();
    for (const s of activeSubscriptions) {
      if (!s.paid_with_item_id) continue;
      const monthly = s.billing_cycle === 'yearly' ? s.amount / 12 : s.amount;
      const cur = acc.get(s.paid_with_item_id) ?? { total: 0, count: 0 };
      acc.set(s.paid_with_item_id, { total: cur.total + monthly, count: cur.count + 1 });
    }
    return acc;
  }, [activeSubscriptions]);
  const [formActive, setFormActive] = useState(true);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryColor, setEditingCategoryColor] = useState<string | null>(null);
  const [navigateTarget, setNavigateTarget] = useState<string | null>(null);
  const [navigateTick, setNavigateTick] = useState(0);
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
  const [removeTarget, setRemoveTarget] = useState<ExpenseItem | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const allMonths = useMemo(() => {
    const base = buildSpreadsheetMonthList(
      entries.map((e) => e.month),
      monthsForward,
    );
    const concluded = new Set(snapshots.map((s) => s.month));
    const active = base.filter((m) => !concluded.has(m));
    const archived = base.filter((m) => concluded.has(m));
    return [...active, ...archived];
  }, [entries, monthsForward, snapshots]);

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

  useEffect(() => {
    if (!navigateTarget) return;
    const el = document.querySelector(`[data-cell="${navigateTarget}"]`);
    if (el) {
      const btn = el.querySelector('button');
      if (btn) {
        btn.click();
      }
    }
  }, [navigateTarget, navigateTick]);

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

  useEffect(() => {
    try {
      window.localStorage.setItem(
        COLLAPSED_CATS_STORAGE_KEY,
        JSON.stringify([...collapsedCats]),
      );
    } catch {
      // Ignora erros de quota ou modo privado
    }
  }, [collapsedCats]);

  async function handleSave(itemId: string, month: string, value: number) {
    try {
      await upsertEntry(itemId, month, value);
      // Num item de cartão, mudar o valor muda o detalhado — logo, o restante.
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
    setFormBudgetClass('');
    setFormDueDay('');
    setFormIsCard(false);
    setFormPaidWithItemId('');
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
    setFormBudgetClass('');
    setFormDueDay('');
    setFormIsCard(false);
    setFormPaidWithItemId('');
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

  async function handleHideItem(item: ExpenseItem) {
    setRemoveBusy(true);
    try {
      await updateItem(item.id, { is_active: false });
      toast.success('Item ocultado');
      await refetch();
      setRemoveTarget(null);
    } catch {
      toast.error('Erro ao ocultar item');
    } finally {
      setRemoveBusy(false);
    }
  }

  async function handleDeleteItem(item: ExpenseItem) {
    setRemoveBusy(true);
    try {
      await deleteItem(item.id);
      if (editingItemId === item.id) {
        setEditingItemId(null);
        setManageStep('list');
        resetItemForm();
      }
      toast.success('Item excluído');
      await refetch();
      setRemoveTarget(null);
    } catch {
      toast.error('Erro ao excluir item');
    } finally {
      setRemoveBusy(false);
    }
  }

  function beginEditItem(item: ExpenseItem) {
    setEditingItemId(item.id);
    setFormCatId(item.category_id ?? '');
    setFormName(item.name);
    setFormDefaultAmount(item.default_amount != null ? String(item.default_amount) : '');
    setFormRecurring(item.is_recurring);
    setFormBudgetClass(item.budget_class ?? '');
    setFormDueDay(item.due_day != null ? String(item.due_day) : '');
    setFormIsCard(item.is_card);
    setFormPaidWithItemId(item.paid_with_item_id ?? '');
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
            budget_class: formBudgetClass || null,
            is_active: formActive,
            due_day: dueDay,
            is_card: formIsCard,
            paid_with_item_id: formIsCard ? null : formPaidWithItemId || null,
          },
          formRecurring ? undefined : { monthFrom: formMonthFrom, monthTo: formMonthTo },
        );
        toast.success('Despesa atualizada');
      } else {
        const monthAnchor = toMonthDate(new Date());
        await addItem(catId, formName.trim(), {
          defaultAmount: def,
          isRecurring: formRecurring,
          budgetClass: formBudgetClass || null,
          monthFrom: formRecurring ? monthAnchor : monthInputValueToFirstDay(formMonthFrom),
          monthTo: formRecurring ? monthAnchor : monthInputValueToFirstDay(formMonthTo),
          visibleMonths: allMonths,
          dueDay,
          isCard: formIsCard,
          paidWithItemId: formPaidWithItemId || null,
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
    <div className="flex flex-col">
      <div className="overflow-x-auto border-t border-border">
        <table
          className={
            expenseColCount > 0
              ? 'w-max min-w-full table-fixed text-sm border-collapse'
              : 'w-max max-w-full table-fixed text-sm border-collapse'
          }
        >
          <colgroup>
            <col className="w-20" />
            <col className="w-40" />
            {expenseColCount > 0 &&
              Array.from({ length: expenseColCount }, (_, i) => (
                <col key={i} className="w-40" />
              ))}
          </colgroup>
          <thead>
            <tr className="bg-surface-3">
              <th className="sticky left-0 z-10 bg-surface-3 text-left px-3 py-2 font-semibold text-text-secondary border-b border-border whitespace-nowrap">
                Mês
              </th>
              <th className="sticky left-20 z-10 bg-surface-3 text-right px-3 py-2 font-semibold text-text-secondary border-b border-border min-w-40 whitespace-nowrap">
                Total
              </th>
              {expenseDisplayGroups.map((g) => {
                const isCollapsed = collapsedCats.has(g.id);
                const tint = g.isUncategorized ? categoryTint(null) : categoryTint(g.color);
                return isCollapsed ? (
                  <th
                    key={g.id}
                    rowSpan={2}
                    className="cursor-pointer border-b border-border bg-surface-3 px-2 py-2 text-left font-semibold text-text-secondary hover:bg-surface-4 min-w-40 whitespace-nowrap align-top"
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
                    className={`bg-surface-3 text-left py-2 font-semibold text-text-secondary border-b border-border cursor-pointer hover:bg-surface-4 ${SPREADSHEET_DATA_COL}`}
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
                return g.items.map((item, colIdx) => (
                  <th
                    key={item.id}
                    className={`align-top border-b border-border bg-surface-2 ${SPREADSHEET_DATA_COL} py-2 ${colIdx > 0 ? 'border-l border-border/40' : ''}`}
                    style={columnTint(tint, colIdx) ? { backgroundColor: columnTint(tint, colIdx) } : undefined}
                  >
                    <div className="flex min-h-13 flex-col gap-1">
                      <span className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-text-secondary leading-snug">
                        <span className="whitespace-nowrap" title={item.name}>
                          {item.name}
                        </span>
                        <span className="flex shrink-0 items-center gap-0">
                          <button
                            type="button"
                            className="shrink-0 p-1 rounded-md text-text-muted hover:text-brand-primary hover:bg-surface-3 transition-colors cursor-pointer"
                            title="Preencher todos os meses visíveis com o mesmo valor"
                            aria-label={`Preencher coluna ${item.name} em todos os meses`}
                            onClick={() => setColumnFillTarget({ itemId: item.id, name: item.name })}
                          >
                            <Columns2 size={16} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            className="-mr-1 shrink-0 p-1 rounded-md text-text-muted hover:text-brand-primary hover:bg-surface-3 transition-colors cursor-pointer"
                            title="Editar esta despesa"
                            aria-label={`Editar ${item.name}`}
                            onClick={() => {
                              beginEditItem(item);
                              setShowManage(true);
                            }}
                          >
                            <Pencil size={14} strokeWidth={2} />
                          </button>
                        </span>
                      </span>
                      <span className="block w-full text-left text-sm font-semibold text-text-secondary leading-snug">
                        {(item.budget_class ||
                          item.is_recurring ||
                          item.due_day != null ||
                          item.is_card ||
                          item.paid_with_item_id) && (
                          <span className="flex flex-wrap items-center gap-1">
                            {item.is_card && (
                              <Badge
                                variant="info"
                                size="sm"
                                className="px-1.5 py-0 text-[10px]"
                                title="Esta linha é a fatura de um cartão: o valor de cada mês é o total da fatura"
                              >
                                <CreditCard size={9} className="mr-0.5 inline" />
                                Fatura
                              </Badge>
                            )}
                            {item.paid_with_item_id && (
                              <Badge
                                variant="muted"
                                size="sm"
                                className="px-1.5 py-0 text-[10px]"
                                title={`Pago dentro de “${items.find((c) => c.id === item.paid_with_item_id)?.name ?? '—'}”: decompõe a fatura, não soma ao mês`}
                              >
                                <CreditCard size={9} className="mr-0.5 inline" />
                                {items.find((c) => c.id === item.paid_with_item_id)?.name ?? 'Cartão'}
                              </Badge>
                            )}
                            {item.budget_class && (
                              <Badge
                                variant={BUDGET_CLASS_BADGE[item.budget_class]}
                                size="sm"
                                className="px-1.5 py-0 text-[10px]"
                                title={BUDGET_CLASS_LABEL[item.budget_class]}
                              >
                                {BUDGET_CLASS_SHORT[item.budget_class]}
                              </Badge>
                            )}
                            {item.is_recurring && (
                              <Badge
                                variant="success"
                                size="sm"
                                className="px-1.5 py-0 text-[10px]"
                                title="Recorrente na planilha"
                              >
                                Rec.
                              </Badge>
                            )}
                            {item.due_day != null && (
                              <span className="text-[10px] font-normal text-text-muted whitespace-nowrap">
                                Venc. dia {item.due_day}
                              </span>
                            )}
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
              // Espelha finance_monthly_summary: fora de cartão soma, cartão vale a fatura.
              const rowTotal = getMonthlyTotal(month);
              return (
                <tr
                  key={month}
                  className={`hover:bg-surface-3/50 transition-colors ${i % 2 === 0 ? 'bg-surface-1' : 'bg-surface-2'}`}
                >
                  <td className={`sticky left-0 z-10 px-3 py-1.5 font-semibold text-text-secondary border-b border-border/50 whitespace-nowrap ${i % 2 === 0 ? 'bg-surface-1' : 'bg-surface-2'}`}>
                    {formatMonth(month)}
                  </td>
                  <td className={`sticky left-20 z-10 px-3 py-1.5 text-right font-semibold text-text-secondary border-b border-border/50 min-w-40 whitespace-nowrap ${i % 2 === 0 ? 'bg-surface-1' : 'bg-surface-2'}`}>
                    {rowTotal > 0 ? money.format(rowTotal) : <span className="text-text-muted">—</span>}
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
                          className="min-w-40 whitespace-nowrap px-2 py-1.5 text-right font-semibold text-text-secondary border-b border-border/50"
                          style={tint.cell ? { backgroundColor: tint.cell } : undefined}
                        >
                          {catTotal > 0 ? money.format(catTotal) : <span className="text-text-muted">—</span>}
                        </td>
                      );
                    }
                    return g.items.map((item, colIdx) => {
                      const entry = getEntry(item.id, month);
                      const effective = getEffectiveExpenseAmount(item.id, month);
                      const cellBg = columnTint(tint, colIdx);
                      return (
                        <td
                          key={item.id}
                          className={`border-b border-border/50 min-w-40 whitespace-nowrap px-0 ${colIdx > 0 ? 'border-l border-border/40' : ''}`}
                          style={cellBg ? { backgroundColor: cellBg } : undefined}
                        >
                          <div
                            data-cell={`${item.id}:${month}`}
                            className="relative w-full cursor-pointer select-none [-webkit-touch-callout:none]"
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
                              formatDisplay={money.format}
                              parseInput={money.parse}
                              highlightVariant="success"
                              highlightActive={entry?.is_paid ?? false}
                              className="px-2 py-1.5 text-sm leading-normal tabular-nums hover:bg-surface-3/25 hover:rounded-md"
                              onArrowUp={() => {
                                const idx = allMonths.indexOf(month);
                                if (idx > 0) {
                                  setNavigateTarget(`${item.id}:${allMonths[idx - 1]}`);
                                  setNavigateTick(k => k + 1);
                                }
                              }}
                              onArrowDown={() => {
                                const idx = allMonths.indexOf(month);
                                if (idx < allMonths.length - 1) {
                                  setNavigateTarget(`${item.id}:${allMonths[idx + 1]}`);
                                  setNavigateTick(k => k + 1);
                                }
                              }}
                            />
                            {/* Numa linha de cartão, o valor é a fatura — e o que
                                interessa saber é quanto dela ainda não tem nome. */}
                            {item.is_card && effective > 0 && (
                              <CardResidualHint
                                breakdown={getCardBreakdown(item.id, month)}
                                subscriptions={subscriptionsByCard.get(item.id)}
                                money={money}
                              />
                            )}
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
        size={manageStep === 'list' ? 'xl' : 'lg'}
        /* O corpo do Modal trava em max-h-[min(75vh,36rem)]; na web sobra espaço. */
        className="[&>div:last-child]:max-h-[min(88vh,56rem)]"
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

            <div className="flex min-h-0 max-h-[min(42rem,68vh)] flex-col gap-3 overflow-y-auto pr-1">
              {categories.length === 0 && !items.some((i) => !i.category_id) ? (
                <p className="shrink-0 rounded-lg border border-dashed border-border/80 bg-surface-2/40 px-4 py-8 text-center text-sm text-text-muted">
                  Você ainda não tem categorias. Crie uma para começar a organizar itens.
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
                                  Salvar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <ManageExpenseItemList
                              itemsList={items.filter((i) => i.category_id === cat.id)}
                              onEditItem={beginEditItem}
                              onAskRemoveItem={(item) => setRemoveTarget(item)}
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
                          onAskRemoveItem={(item) => setRemoveTarget(item)}
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
                placeholder={
                  editingItemId
                    ? `Valor padrão (${currencySymbol(money.currency)}) — opcional`
                    : `Valor (${currencySymbol(money.currency)}) — opcional`
                }
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
              <div>
                <label
                  className="text-[10px] font-medium text-text-muted uppercase tracking-wide block mb-1"
                  htmlFor="expense-budget-class"
                >
                  Orçamento
                </label>
                <select
                  id="expense-budget-class"
                  value={formBudgetClass}
                  onChange={(e) => setFormBudgetClass((e.target.value as BudgetClass) || '')}
                  className="w-full px-3 py-2 rounded-lg bg-surface-3 border border-transparent text-sm text-text-primary outline-none ring-1 ring-inset ring-border focus:ring-brand-primary"
                >
                  <option value="">A classificar</option>
                  {BUDGET_CLASSES.map((c) => (
                    <option key={c} value={c}>
                      {BUDGET_CLASS_LABEL[c]}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                  {formBudgetClass === 'deduction'
                    ? 'Abate da receita antes de dividir os baldes; não conta como gasto de vida.'
                    : formBudgetClass === 'investment'
                      ? 'Aporte: conta para a meta de investimento do mês.'
                      : 'Define em que balde esta despesa entra na tela Orçamento.'}
                </p>
              </div>
              <label className="flex items-start gap-2 cursor-pointer text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={formIsCard}
                  onChange={(e) => {
                    setFormIsCard(e.target.checked);
                    // Um cartão não se paga dentro de outro cartão.
                    if (e.target.checked) setFormPaidWithItemId('');
                  }}
                  className="mt-1 rounded border-border"
                />
                <span>
                  <span className="font-medium text-text-primary">
                    Esta linha é a fatura de um cartão
                  </span>
                  <span className="block text-xs text-text-muted mt-0.5">
                    O valor que você lança em cada mês passa a ser o total da fatura, e outras despesas
                    podem declarar-se pagas dentro dela.
                  </span>
                </span>
              </label>
              {!formIsCard && (
                <div>
                  <label
                    className="text-[10px] font-medium text-text-muted uppercase tracking-wide block mb-1"
                    htmlFor="expense-paid-with"
                  >
                    Pago no cartão (opcional)
                  </label>
                  <select
                    id="expense-paid-with"
                    value={formPaidWithItemId}
                    onChange={(e) => setFormPaidWithItemId(e.target.value)}
                    disabled={selectableCardItems.length === 0}
                    className="w-full px-3 py-2 rounded-lg bg-surface-3 border border-transparent text-sm text-text-primary outline-none ring-1 ring-inset ring-border focus:ring-brand-primary disabled:opacity-60"
                  >
                    <option value="">Fora de cartão (débito, pix, dinheiro)</option>
                    {selectableCardItems.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                    {selectableCardItems.length === 0
                      ? 'Você ainda não tem nenhuma linha marcada como fatura de cartão. Marque a despesa do cartão (ex.: “Itau Black”) com a opção acima e ela passa a aparecer aqui.'
                      : formPaidWithItemId
                        ? 'Este item deixa de somar ao total do mês: passa a decompor a fatura desse cartão. O que sobrar da fatura fica no balde que deste ao cartão.'
                        : 'Some ao total do mês por si, como sempre.'}
                  </p>
                </div>
              )}
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
                      : 'Com valor &gt; 0, preenche automaticamente todos os meses visíveis na planilha. Você pode alterar qualquer mês à mão.'}
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
                {editingItemId ? 'Salvar' : 'Adicionar'}
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

      <Modal
        isOpen={removeTarget !== null}
        onClose={() => {
          if (removeBusy) return;
          setRemoveTarget(null);
        }}
        title="Remover item"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            O que você quer fazer com{' '}
            <span className="font-semibold text-text-primary">
              &quot;{removeTarget?.name ?? ''}&quot;
            </span>
            ?
          </p>
          <ul className="flex flex-col gap-2 text-xs text-text-muted">
            <li>
              <span className="font-medium text-text-secondary">Ocultar item</span> — desaparece da
              planilha mas mantém todos os lançamentos. Reversível em &quot;Editar item → Mostrar
              na planilha&quot;.
            </li>
            <li>
              <span className="font-medium text-text-secondary">Excluir definitivamente</span> —
              remove o item e os lançamentos atuais e futuros. Meses já arquivados continuam
              intactos no histórico.
            </li>
          </ul>
          <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-3">
            <Button
              type="button"
              variant="ghost"
              disabled={removeBusy}
              onClick={() => setRemoveTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={removeBusy || !removeTarget}
              onClick={() => removeTarget && void handleHideItem(removeTarget)}
            >
              Ocultar item
            </Button>
            <Button
              type="button"
              disabled={removeBusy || !removeTarget}
              onClick={() => removeTarget && void handleDeleteItem(removeTarget)}
              leftIcon={<Trash2 size={14} />}
              className="bg-red-500/90 text-white hover:bg-red-500"
            >
              Excluir definitivamente
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
