'use client';

import { useEffect, useState } from 'react';
import { Plus, ChevronDown, ChevronUp, Trash2, Pencil, Repeat } from 'lucide-react';
import {
  Modal,
  Input,
  Button,
  Checkbox,
  Skeleton,
  useToast,
  ToggleStatusBadge,
} from '@phfront/millennium-ui';
import { useReceivables } from '@/hooks/finance/use-receivables';
import { useUserStore } from '@/store/user-store';
import { getLocalDateStr } from '@/lib/habits-goals/timezone';
import { formatDate, formatMonth } from '@/lib/finance/format';
import { currencySymbol } from '@/lib/finance/currency';
import { useMoneyFormat } from '@/hooks/finance/use-money-format';
import {
  firstDayToMonthInputValue,
  monthInputValueToFirstDay,
  receivableIsFullyPaid,
  receivableOutstanding,
} from '@/lib/finance/finance';
import type { Receivable, ReceivableSeries } from '@/types/finance';

type Filter = 'all' | 'pending' | 'paid';

const EMPTY_FORM = {
  person_name: '',
  description: '',
  amount: '',
  amount_paid: '',
  reference_month: '',
  /** Vira regra recorrente em vez de cobrança única. */
  is_recurring: false,
  /** Primeiro mês cobrado pela regra (YYYY-MM). */
  start_month: '',
  /** Dia em que costuma cair; informativo. */
  due_day: '',
};

function ReceivableRow({
  item,
  onTogglePaid,
  onUpdatePaid,
  onDelete,
}: {
  item: Receivable;
  onTogglePaid: (id: string) => void;
  onUpdatePaid: (id: string, paid: number) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const money = useMoneyFormat();
  const outstanding = receivableOutstanding(item);
  const full = receivableIsFullyPaid(item);
  const [paidLocal, setPaidLocal] = useState(() => String(item.amount_paid));
  const [savingPaid, setSavingPaid] = useState(false);

  useEffect(() => {
    setPaidLocal(String(item.amount_paid));
  }, [item.id, item.amount_paid]);

  async function commitPaid() {
    const n = Math.max(0, Math.min(item.amount, parseFloat(paidLocal.replace(',', '.')) || 0));
    if (Math.abs(n - item.amount_paid) < 0.0001) return;
    setSavingPaid(true);
    try {
      await onUpdatePaid(item.id, n);
    } finally {
      setSavingPaid(false);
    }
  }

  return (
    <div className={`flex items-start gap-3 px-4 py-2.5 ${full ? 'opacity-60' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="flex items-center gap-1.5 text-sm text-text-primary">
          {item.series_id && (
            <Repeat
              size={11}
              className="shrink-0 text-text-muted"
              aria-label="Gerada por cobrança recorrente"
            />
          )}
          {item.description}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-text-muted">
          <span>
            Valor <span className="text-text-secondary font-medium">{money.format(item.amount)}</span>
          </span>
          <label className="inline-flex items-center gap-1.5 cursor-text">
            <span className="shrink-0">Pago</span>
            <input
              type="number"
              step="0.01"
              min={0}
              max={item.amount}
              disabled={savingPaid}
              className="w-26 px-1.5 py-0.5 rounded bg-surface-3 border border-border text-text-primary text-right text-xs outline-none focus:border-brand-primary disabled:opacity-50"
              value={paidLocal}
              onChange={(e) => setPaidLocal(e.target.value)}
              onBlur={() => void commitPaid()}
              onKeyDown={(e) => e.key === 'Enter' && void commitPaid()}
            />
          </label>
          <span className={outstanding > 0 ? 'text-amber-400/90' : 'text-green-400/90'}>
            Restante {money.format(outstanding)}
          </span>
          {item.reference_month && <span>· {formatMonth(item.reference_month)}</span>}
          {full && item.paid_at && <span>· quitado em {formatDate(item.paid_at)}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
        <ToggleStatusBadge checked={full} onToggle={() => onTogglePaid(item.id)} size="sm" />
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="p-1 rounded text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
          aria-label="Remover cobrança"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

/**
 * A regra, não a cobrança. Fica no topo do card da pessoa para se ver de onde
 * vêm as linhas de baixo — e para pausar sem apagar o que já foi cobrado.
 */
function SeriesStrip({
  series,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  series: ReceivableSeries;
  onEdit: (s: ReceivableSeries) => void;
  onToggleActive: (s: ReceivableSeries) => void;
  onDelete: (s: ReceivableSeries) => void;
}) {
  const money = useMoneyFormat();

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 text-xs ${series.is_active ? '' : 'opacity-60'}`}
    >
      <Repeat size={12} className="shrink-0 text-brand-primary" />
      <div className="min-w-0 flex-1">
        <span className="text-text-primary">{series.description}</span>
        <span className="text-text-muted">
          {' · '}
          {money.format(series.amount)}/mês
          {' · desde '}
          {formatMonth(series.start_month)}
          {series.due_day != null && ` · dia ${series.due_day}`}
          {series.end_month && ` · até ${formatMonth(series.end_month)}`}
        </span>
      </div>
      <ToggleStatusBadge
        checked={series.is_active}
        onToggle={() => onToggleActive(series)}
        checkedLabel="Ativa"
        uncheckedLabel="Pausada"
        showIconWhenChecked={false}
        size="sm"
      />
      <button
        type="button"
        onClick={() => onEdit(series)}
        aria-label={`Editar recorrência ${series.description}`}
        className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer"
      >
        <Pencil size={12} />
      </button>
      <button
        type="button"
        onClick={() => onDelete(series)}
        aria-label={`Remover recorrência ${series.description}`}
        className="p-1 rounded text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function PersonCard({
  person,
  items,
  series,
  onTogglePaid,
  onUpdatePaid,
  onDelete,
  onEditSeries,
  onToggleSeriesActive,
  onDeleteSeries,
}: {
  person: string;
  items: Receivable[];
  series: ReceivableSeries[];
  onTogglePaid: (id: string) => void;
  onUpdatePaid: (id: string, paid: number) => Promise<void>;
  onDelete: (id: string) => void;
  onEditSeries: (s: ReceivableSeries) => void;
  onToggleSeriesActive: (s: ReceivableSeries) => void;
  onDeleteSeries: (s: ReceivableSeries) => void;
}) {
  const money = useMoneyFormat();
  const [expanded, setExpanded] = useState(true);
  const pendingTotal = items.reduce((s, i) => s + receivableOutstanding(i), 0);
  const total = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-3 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center text-xs font-bold text-brand-primary uppercase">
            {person.charAt(0)}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-text-primary">{person}</p>
            <p className="text-xs text-text-muted">
              {money.format(pendingTotal)} pendente · {money.format(total)} total
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
      </button>

      {expanded && (
        <>
          {series.length > 0 && (
            <div className="border-t border-border bg-surface-1/40 divide-y divide-border/40">
              {series.map((s) => (
                <SeriesStrip
                  key={s.id}
                  series={s}
                  onEdit={onEditSeries}
                  onToggleActive={onToggleSeriesActive}
                  onDelete={onDeleteSeries}
                />
              ))}
            </div>
          )}
          <div className="border-t border-border divide-y divide-border/50">
            {items.map((item) => (
              <ReceivableRow
                key={item.id}
                item={item}
                onTogglePaid={onTogglePaid}
                onUpdatePaid={onUpdatePaid}
                onDelete={onDelete}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ReceivablesList() {
  const {
    receivables,
    series,
    isLoading,
    people,
    addReceivable,
    updateAmountPaid,
    togglePaid,
    deleteReceivable,
    addSeries,
    updateSeries,
    deleteSeries,
    getByPerson,
    getSeriesByPerson,
    getPendingTotal,
  } = useReceivables();
  const money = useMoneyFormat();
  const user = useUserStore((s) => s.user);
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** Mês corrente como valor de `<input type="month">`, para o padrão da regra. */
  const currentMonthValue = getLocalDateStr(user?.profile?.timezone).slice(0, 7);

  function openAdd() {
    setEditingSeriesId(null);
    setForm({ ...EMPTY_FORM, start_month: currentMonthValue });
    setShowModal(true);
  }

  function openEditSeries(s: ReceivableSeries) {
    setEditingSeriesId(s.id);
    setForm({
      person_name: s.person_name,
      description: s.description,
      amount: String(s.amount),
      amount_paid: '',
      reference_month: '',
      is_recurring: true,
      start_month: firstDayToMonthInputValue(s.start_month),
      due_day: s.due_day != null ? String(s.due_day) : '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.person_name.trim() || !form.description.trim() || !form.amount) return;
    const amount = parseFloat(form.amount.replace(',', '.')) || 0;
    if (amount <= 0) {
      toast.error('Indique um valor maior que zero');
      return;
    }
    const dueDay = form.due_day ? Math.min(31, Math.max(1, parseInt(form.due_day, 10))) : null;
    setSaving(true);
    try {
      if (form.is_recurring) {
        const values = {
          person_name: form.person_name.trim(),
          description: form.description.trim(),
          amount,
          due_day: dueDay,
          start_month: monthInputValueToFirstDay(form.start_month || currentMonthValue),
          end_month: null,
          is_active: true,
        };
        if (editingSeriesId) {
          await updateSeries(editingSeriesId, values);
          toast.success('Recorrência atualizada');
        } else {
          await addSeries(values);
          toast.success('Cobrança recorrente criada');
        }
      } else {
        const paidRaw = parseFloat(form.amount_paid.replace(',', '.')) || 0;
        const amountPaid = Math.max(0, Math.min(amount, paidRaw));
        await addReceivable({
          person_name: form.person_name.trim(),
          description: form.description.trim(),
          amount,
          amount_paid: amountPaid,
          reference_month: form.reference_month ? form.reference_month + '-01' : null,
          is_paid: amountPaid >= amount,
          paid_at: amountPaid >= amount ? getLocalDateStr(user?.profile?.timezone) : null,
          series_id: null,
        });
        toast.success('Cobrança adicionada');
      }
      setForm(EMPTY_FORM);
      setEditingSeriesId(null);
      setShowModal(false);
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSeriesActive(s: ReceivableSeries) {
    try {
      await updateSeries(s.id, { is_active: !s.is_active });
    } catch {
      toast.error('Erro ao atualizar recorrência');
    }
  }

  async function handleDeleteSeries(s: ReceivableSeries) {
    try {
      await deleteSeries(s.id);
      toast.success('Recorrência removida — as cobranças já geradas ficaram');
    } catch {
      toast.error('Erro ao remover recorrência');
    }
  }

  async function handleToggle(id: string) {
    try {
      await togglePaid(id);
    } catch {
      toast.error('Erro ao atualizar');
    }
  }

  async function handleUpdatePaid(id: string, paid: number) {
    try {
      await updateAmountPaid(id, paid);
    } catch {
      toast.error('Erro ao atualizar valor pago');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteReceivable(id);
      toast.success('Cobrança removida');
    } catch {
      toast.error('Erro ao remover');
    }
  }

  function filterItems(items: Receivable[]): Receivable[] {
    if (filter === 'pending') return items.filter((i) => !receivableIsFullyPaid(i));
    if (filter === 'paid') return items.filter((i) => receivableIsFullyPaid(i));
    return items;
  }

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  const totalPending = getPendingTotal();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between bg-surface-2 border border-border rounded-xl p-4">
        <div>
          <p className="text-xs text-text-muted mb-0.5">Total pendente</p>
          <p className="text-2xl font-bold text-text-primary">{money.format(totalPending)}</p>
        </div>
        <Button onClick={openAdd} leftIcon={<Plus size={14} />}>
          Nova Cobrança
        </Button>
      </div>

      <div className="flex gap-1 bg-surface-2 border border-border rounded-lg p-1 w-fit">
        {(['all', 'pending', 'paid'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer
              ${filter === f ? 'bg-brand-primary text-white' : 'text-text-muted hover:text-text-primary'}`}
          >
            {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : 'Pagas'}
          </button>
        ))}
      </div>

      {receivables.length === 0 && series.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-2 text-text-muted bg-surface-2 rounded-xl border border-border">
          <p className="text-sm">Nenhuma cobrança registrada.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {people.map((person) => {
            const items = filterItems(getByPerson(person));
            const personSeries = getSeriesByPerson(person);
            if (items.length === 0 && personSeries.length === 0) return null;
            return (
              <PersonCard
                key={person}
                person={person}
                items={items}
                series={personSeries}
                onTogglePaid={handleToggle}
                onUpdatePaid={handleUpdatePaid}
                onDelete={handleDelete}
                onEditSeries={openEditSeries}
                onToggleSeriesActive={handleToggleSeriesActive}
                onDeleteSeries={handleDeleteSeries}
              />
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingSeriesId(null);
        }}
        title={
          editingSeriesId
            ? 'Editar cobrança recorrente'
            : form.is_recurring
              ? 'Nova cobrança recorrente'
              : 'Nova Cobrança'
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">Pessoa</label>
            <input
              list="people-list"
              placeholder="Nome da pessoa"
              value={form.person_name}
              onChange={(e) => setForm({ ...form, person_name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-surface-3 border border-border text-sm text-text-primary outline-none focus:border-brand-primary"
            />
            <datalist id="people-list">
              {people.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <Input
            label="Descrição"
            placeholder="Ex: Notebook, Fatura, Ingresso"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Input
            label={`Valor total (${currencySymbol(money.currency)})`}
            type="number"
            step="0.01"
            placeholder="0,00"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          {/* Recorrente muda a natureza do que se grava: regra, não cobrança.
              Editar uma regra existente não permite voltar atrás daqui. */}
          {!editingSeriesId && (
            <div className="flex items-start gap-2 rounded-lg bg-surface-3/50 border border-border p-3">
              <Checkbox
                aria-label="Repetir todo mês"
                checked={form.is_recurring}
                onCheckedChange={(checked) =>
                  setForm({
                    ...form,
                    is_recurring: checked,
                    start_month: form.start_month || currentMonthValue,
                  })
                }
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">Repetir todo mês</p>
                <p className="text-[10px] text-text-muted leading-relaxed mt-0.5">
                  {form.is_recurring
                    ? 'Vira uma regra: o sistema gera uma cobrança por mês, do mês inicial até o mês corrente. Meses futuros só aparecem quando chegarem.'
                    : 'Cobrança única, do jeito de sempre.'}
                </p>
              </div>
            </div>
          )}

          {form.is_recurring ? (
            <>
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1">
                  Mês inicial
                </label>
                <input
                  type="month"
                  value={form.start_month}
                  onChange={(e) => setForm({ ...form, start_month: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-surface-3 border border-border text-sm text-text-primary outline-none focus:border-brand-primary"
                />
                <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                  Um mês inicial no passado gera de uma vez todas as cobranças de lá até agora — e
                  todas entram no pendente até você marcá-las como pagas.
                </p>
              </div>
              <Input
                label="Dia do mês (opcional)"
                type="number"
                min={1}
                max={31}
                placeholder="1–31"
                value={form.due_day}
                onChange={(e) => setForm({ ...form, due_day: e.target.value })}
              />
              {editingSeriesId && (
                <p className="text-[10px] text-text-muted -mt-1 leading-relaxed">
                  Alterar o valor vale para os meses ainda não gerados. As cobranças já emitidas
                  ficam como estão — se quiser corrigir alguma, edite-a na lista.
                </p>
              )}
            </>
          ) : (
            <>
              <Input
                label={`Já pago (${currencySymbol(money.currency)}) — opcional`}
                type="number"
                step="0.01"
                min={0}
                placeholder="0"
                value={form.amount_paid}
                onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
              />
              <p className="text-[10px] text-text-muted -mt-1">
                Você pode ir atualizando o “Pago” na lista até quitar o total.
              </p>
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1">Mês de referência (opcional)</label>
                <input
                  type="month"
                  value={form.reference_month}
                  onChange={(e) => setForm({ ...form, reference_month: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-surface-3 border border-border text-sm text-text-primary outline-none focus:border-brand-primary"
                />
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowModal(false);
                setEditingSeriesId(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.person_name.trim() || !form.description.trim()}>
              {editingSeriesId ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
