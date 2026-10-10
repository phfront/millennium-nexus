'use client';

import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, CreditCard } from 'lucide-react';
import {
  Modal,
  Input,
  Button,
  Skeleton,
  Checkbox,
  DataTable,
  ToggleStatusBadge,
  useToast,
  type DataTableColumn,
} from '@phfront/millennium-ui';
import { useSubscriptions } from '@/hooks/finance/use-subscriptions';
import { useCardItems, type CardItemOption } from '@/hooks/finance/use-card-items';
import { useMoneyFormat } from '@/hooks/finance/use-money-format';
import type { Subscription } from '@/types/finance';

/** Quanto esta assinatura custa por mês, seja qual for o ciclo. */
function monthlyAmount(sub: Subscription): number {
  return sub.billing_cycle === 'yearly' ? sub.amount / 12 : sub.amount;
}

/**
 * Select de cartão, igual ao da planilha de despesas. Aqui o vazio é
 * "Sem cartão" e não "Fora de cartão (débito, pix…)": nas assinaturas o
 * ponteiro não muda conta nenhuma, então o vazio significa apenas que ainda
 * não se disse onde ela cai.
 */
function CardSelect({
  value,
  cards,
  onChange,
  disabled,
  className = '',
  ariaLabel,
}: {
  value: string | null;
  cards: CardItemOption[];
  onChange: (cardItemId: string | null) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled || cards.length === 0}
      className={[
        'w-full px-2 py-1.5 rounded-lg bg-surface-3 border border-transparent text-sm text-text-primary',
        'outline-none ring-1 ring-inset ring-border focus:ring-brand-primary disabled:opacity-60 cursor-pointer',
        className,
      ].join(' ')}
    >
      <option value="">Sem cartão</option>
      {cards.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function SubscriptionCard({
  sub,
  cardName,
  onEdit,
  onDelete,
  onToggle,
}: {
  sub: Subscription;
  cardName: string | null;
  onEdit: (s: Subscription) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const money = useMoneyFormat();

  return (
    <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors
      ${sub.is_active ? 'bg-surface-2 border-border' : 'bg-surface-1 border-border/50 opacity-60'}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{sub.name}</p>
        <p className="text-xs text-text-muted">
          {money.format(sub.amount)}{sub.billing_cycle === 'yearly' ? '/ano' : '/mês'}
          {sub.billing_cycle === 'yearly' && (
            <span className="ml-1 text-text-muted">({money.format(monthlyAmount(sub))}/mês)</span>
          )}
          {sub.renewal_day && <span className="ml-1">· dia {sub.renewal_day}</span>}
        </p>
        {cardName && (
          <p className="text-[11px] text-text-muted mt-1 flex items-center gap-1">
            <CreditCard size={11} />
            <span className="truncate">{cardName}</span>
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <ToggleStatusBadge
          checked={sub.is_active}
          onToggle={() => onToggle(sub.id)}
          checkedLabel="Ativa"
          uncheckedLabel="Inativa"
          showIconWhenChecked={false}
          className="min-w-0"
        />
        <button type="button" onClick={() => onEdit(sub)} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer">
          <Pencil size={13} />
        </button>
        <button type="button" onClick={() => onDelete(sub.id)} className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

const EMPTY_FORM: Omit<Subscription, 'id' | 'user_id' | 'created_at'> = {
  name: '',
  amount: 0,
  billing_cycle: 'monthly',
  renewal_day: null,
  is_active: true,
  paid_with_item_id: null,
};

export function SubscriptionsList() {
  const {
    active,
    inactive,
    monthlyTotal,
    isLoading,
    addSubscription,
    updateSubscription,
    setCardForMany,
    deleteSubscription,
  } = useSubscriptions();
  const { cardItems } = useCardItems();
  const { toast } = useToast();
  const money = useMoneyFormat();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showInactive, setShowInactive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCardId, setBulkCardId] = useState<string>('');
  const [applyingBulk, setApplyingBulk] = useState(false);

  const cardNameById = useMemo(
    () => new Map(cardItems.map((c) => [c.id, c.name] as const)),
    [cardItems],
  );

  /** Linhas da tabela: as inativas entram junto quando reveladas, para a seleção em massa alcançá-las. */
  const rows = useMemo(
    () => (showInactive ? [...active, ...inactive] : active),
    [active, inactive, showInactive],
  );

  /** Quanto de cada fatura é assinatura — a pergunta que o ponteiro para o cartão existe para responder. */
  const totalsByCard = useMemo(() => {
    const acc = new Map<string, { name: string; total: number; count: number }>();
    for (const s of active) {
      const key = s.paid_with_item_id ?? '';
      const name = s.paid_with_item_id
        ? (cardNameById.get(s.paid_with_item_id) ?? 'Cartão removido')
        : 'Sem cartão';
      const cur = acc.get(key) ?? { name, total: 0, count: 0 };
      acc.set(key, { name, total: cur.total + monthlyAmount(s), count: cur.count + 1 });
    }
    return [...acc.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [active, cardNameById]);

  /** A seleção só vale para o que está à vista; esconder as inativas não pode deixar seleção fantasma. */
  const visibleSelectedIds = useMemo(
    () => selectedIds.filter((id) => rows.some((r) => r.id === id)),
    [selectedIds, rows],
  );
  function toggleRow(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  /** Com algo selecionado, limpa; vazio, marca tudo o que está à vista. */
  function toggleAll() {
    setSelectedIds(visibleSelectedIds.length > 0 ? [] : rows.map((r) => r.id));
  }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(sub: Subscription) {
    setEditing(sub);
    setForm({
      name: sub.name,
      amount: sub.amount,
      billing_cycle: sub.billing_cycle,
      renewal_day: sub.renewal_day,
      is_active: sub.is_active,
      paid_with_item_id: sub.paid_with_item_id,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateSubscription(editing.id, form);
        toast.success('Assinatura atualizada');
      } else {
        await addSubscription(form);
        toast.success('Assinatura adicionada');
      }
      setShowModal(false);
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSubscription(id);
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      toast.success('Assinatura removida');
    } catch {
      toast.error('Erro ao remover');
    }
  }

  async function handleToggle(id: string) {
    const sub = [...active, ...inactive].find((s) => s.id === id);
    if (!sub) return;
    try {
      await updateSubscription(id, { is_active: !sub.is_active });
    } catch {
      toast.error('Erro ao atualizar');
    }
  }

  async function handleCardChange(sub: Subscription, cardItemId: string | null) {
    if (cardItemId === sub.paid_with_item_id) return;
    try {
      await updateSubscription(sub.id, { paid_with_item_id: cardItemId });
    } catch {
      toast.error('Erro ao atualizar o cartão');
    }
  }

  async function handleApplyBulk() {
    if (visibleSelectedIds.length === 0) return;
    setApplyingBulk(true);
    try {
      const target = bulkCardId || null;
      await setCardForMany(visibleSelectedIds, target);
      toast.success(
        target
          ? `${visibleSelectedIds.length} assinatura(s) no cartão ${cardNameById.get(target) ?? ''}`.trim()
          : `${visibleSelectedIds.length} assinatura(s) sem cartão`,
      );
      setSelectedIds([]);
    } catch {
      toast.error('Erro ao aplicar em massa');
    } finally {
      setApplyingBulk(false);
    }
  }

  const columns: DataTableColumn<Subscription>[] = [
    {
      key: 'select',
      header: '',
      width: '40px',
      render: (s) => (
        <Checkbox
          aria-label={`Selecionar ${s.name}`}
          checked={selectedIds.includes(s.id)}
          onCheckedChange={() => toggleRow(s.id)}
        />
      ),
    },
    {
      key: 'name',
      header: 'Assinatura',
      sortable: true,
      render: (s) => (
        <span className={`font-medium ${s.is_active ? 'text-text-primary' : 'text-text-muted'}`}>
          {s.name}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Valor',
      width: '150px',
      sortable: true,
      render: (s) => (
        <span className="tabular-nums">
          {money.format(s.amount)}
          <span className="text-text-muted text-xs">
            {s.billing_cycle === 'yearly' ? '/ano' : '/mês'}
          </span>
        </span>
      ),
    },
    {
      key: 'monthly',
      header: 'Por mês',
      width: '120px',
      sortable: true,
      /* A coluna não existe na linha: é conta, e o DataTable precisa dela pronta. */
      sortValue: (s) => monthlyAmount(s),
      render: (s) => (
        <span className={`tabular-nums ${s.billing_cycle === 'yearly' ? 'text-text-secondary' : 'text-text-muted'}`}>
          {money.format(monthlyAmount(s))}
        </span>
      ),
    },
    {
      key: 'renewal_day',
      header: 'Dia',
      width: '70px',
      sortable: true,
      render: (s) => (
        <span className="text-text-muted tabular-nums">{s.renewal_day ?? '—'}</span>
      ),
    },
    {
      key: 'paid_with_item_id',
      header: 'Cartão',
      width: '200px',
      sortable: true,
      /* Ordena pelo nome do cartão, não pelo uuid guardado na linha. */
      sortValue: (s) => (s.paid_with_item_id ? (cardNameById.get(s.paid_with_item_id) ?? '') : null),
      render: (s) => (
        <CardSelect
          value={s.paid_with_item_id}
          cards={cardItems}
          onChange={(cardItemId) => void handleCardChange(s, cardItemId)}
          ariaLabel={`Cartão de ${s.name}`}
        />
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      width: '110px',
      sortable: true,
      /* Ativas primeiro no crescente: é a ordem que se quer ver. */
      sortValue: (s) => (s.is_active ? 0 : 1),
      render: (s) => (
        <ToggleStatusBadge
          checked={s.is_active}
          onToggle={() => handleToggle(s.id)}
          checkedLabel="Ativa"
          uncheckedLabel="Inativa"
          showIconWhenChecked={false}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (s) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => openEdit(s)}
            aria-label={`Editar ${s.name}`}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(s.id)}
            aria-label={`Remover ${s.name}`}
            className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  const inactiveToggle = inactive.length > 0 && (
    <button
      type="button"
      onClick={() => setShowInactive(!showInactive)}
      className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
    >
      {showInactive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      {inactive.length} assinaturas inativas
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Header com total */}
      <div className="flex items-center justify-between bg-surface-2 border border-border rounded-xl p-4">
        <div>
          <p className="text-xs text-text-muted mb-0.5">Total mensal ativo</p>
          <p className="text-2xl font-bold text-text-primary">{money.format(monthlyTotal)}<span className="text-sm font-normal text-text-muted">/mês</span></p>
        </div>
        <Button onClick={openAdd} leftIcon={<Plus size={14} />}>Nova Assinatura</Button>
      </div>

      {/* Quanto cada fatura carrega de assinatura */}
      {totalsByCard.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {totalsByCard.map((c) => (
            <span
              key={c.id || 'none'}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-surface-2 border border-border text-text-secondary"
            >
              {c.id ? <CreditCard size={11} className="text-text-muted" /> : null}
              <span className="text-text-primary">{c.name}</span>
              <span className="tabular-nums">{money.format(c.total)}/mês</span>
              <span className="text-text-muted">({c.count})</span>
            </span>
          ))}
        </div>
      )}

      {cardItems.length === 0 && (
        <p className="text-xs text-text-muted leading-relaxed">
          Você ainda não tem nenhuma linha marcada como fatura de cartão. Marque a despesa do cartão
          (ex.: “Itau Black”) na planilha de despesas e ela passa a aparecer aqui.
        </p>
      )}

      {/* ── Desktop: tabela + ação em massa ─────────────────────────── */}
      <div className="hidden md:flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Checkbox
              aria-label="Selecionar todas as assinaturas"
              checked={visibleSelectedIds.length > 0}
              onCheckedChange={toggleAll}
              disabled={rows.length === 0}
            />
            <button
              type="button"
              onClick={toggleAll}
              disabled={rows.length === 0}
              className="cursor-pointer hover:text-text-secondary transition-colors disabled:cursor-not-allowed"
            >
              {visibleSelectedIds.length > 0
                ? `${visibleSelectedIds.length} selecionada(s) — limpar`
                : 'Selecionar todas'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {inactiveToggle}
            {visibleSelectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-52">
                  <CardSelect
                    value={bulkCardId || null}
                    cards={cardItems}
                    onChange={(id) => setBulkCardId(id ?? '')}
                    ariaLabel="Cartão a aplicar na seleção"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleApplyBulk}
                  disabled={applyingBulk}
                  leftIcon={<CreditCard size={13} />}
                >
                  Aplicar em {visibleSelectedIds.length}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                  Limpar
                </Button>
              </div>
            )}
          </div>
        </div>

        <DataTable<Subscription>
          columns={columns}
          data={rows}
          keyExtractor={(s) => s.id}
          emptyTitle="Nenhuma assinatura ativa"
          emptyDescription="Adicione a primeira para começar a acompanhar o custo mensal."
        />
      </div>

      {/* ── Mobile: os cards de sempre ──────────────────────────────── */}
      <div className="md:hidden flex flex-col gap-4">
        {active.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-2 text-text-muted bg-surface-2 rounded-xl border border-border">
            <p className="text-sm">Nenhuma assinatura ativa.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {active.map((s) => (
              <SubscriptionCard
                key={s.id}
                sub={s}
                cardName={s.paid_with_item_id ? (cardNameById.get(s.paid_with_item_id) ?? null) : null}
                onEdit={openEdit}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}

        {inactive.length > 0 && (
          <div>
            <div className="mb-2">{inactiveToggle}</div>
            {showInactive && (
              <div className="flex flex-col gap-2">
                {inactive.map((s) => (
                  <SubscriptionCard
                    key={s.id}
                    sub={s}
                    cardName={s.paid_with_item_id ? (cardNameById.get(s.paid_with_item_id) ?? null) : null}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Assinatura' : 'Nova Assinatura'}>
        <div className="flex flex-col gap-3">
          <Input
            label="Nome"
            placeholder="Ex: Netflix, Cursor, Spotify"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Valor"
            type="number"
            step="0.01"
            placeholder="0,00"
            value={form.amount === 0 ? '' : String(form.amount)}
            onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
          />
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">Ciclo de cobrança</label>
            <select
              value={form.billing_cycle}
              onChange={(e) => setForm({ ...form, billing_cycle: e.target.value as 'monthly' | 'yearly' })}
              className="w-full px-3 py-2 rounded-lg bg-surface-3 border border-border text-sm text-text-primary outline-none focus:border-brand-primary"
            >
              <option value="monthly">Mensal</option>
              <option value="yearly">Anual</option>
            </select>
          </div>
          <Input
            label="Dia de cobrança (opcional)"
            type="number"
            min={1}
            max={31}
            placeholder="1–31"
            value={form.renewal_day ?? ''}
            onChange={(e) => setForm({ ...form, renewal_day: e.target.value ? parseInt(e.target.value) : null })}
          />
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1" htmlFor="subscription-card">
              Cartão (opcional)
            </label>
            <CardSelect
              value={form.paid_with_item_id}
              cards={cardItems}
              onChange={(id) => setForm({ ...form, paid_with_item_id: id })}
              className="px-3 py-2"
              ariaLabel="Cartão da assinatura"
            />
            <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
              {cardItems.length === 0
                ? 'Marque a despesa do cartão na planilha como “fatura de cartão” para ela aparecer aqui.'
                : 'Só organiza: diz em que fatura esta assinatura cai. Não altera o total do mês nem o orçamento — quem os move é a linha da fatura, na planilha de despesas.'}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>{editing ? 'Salvar' : 'Adicionar'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
