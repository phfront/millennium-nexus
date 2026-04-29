'use client';

import { useEffect, useState } from 'react';
import { Plus, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Modal, Input, Button, Skeleton, useToast, ToggleStatusBadge } from '@phfront/millennium-ui';
import { useReceivables } from '@/hooks/finance/use-receivables';
import { useUserStore } from '@/store/user-store';
import { getLocalDateStr } from '@/lib/habits-goals/timezone';
import { formatBRL, formatDate, formatMonth } from '@/lib/finance/format';
import { receivableIsFullyPaid, receivableOutstanding } from '@/lib/finance/finance';
import type { Receivable } from '@/types/finance';

type Filter = 'all' | 'pending' | 'paid';

const EMPTY_FORM = {
  person_name: '',
  description: '',
  amount: '',
  amount_paid: '',
  reference_month: '',
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
        <p className="text-sm text-text-primary">{item.description}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-text-muted">
          <span>
            Valor <span className="text-text-secondary font-medium">{formatBRL(item.amount)}</span>
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
            Restante {formatBRL(outstanding)}
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

function PersonCard({
  person,
  items,
  onTogglePaid,
  onUpdatePaid,
  onDelete,
}: {
  person: string;
  items: Receivable[];
  onTogglePaid: (id: string) => void;
  onUpdatePaid: (id: string, paid: number) => Promise<void>;
  onDelete: (id: string) => void;
}) {
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
              {formatBRL(pendingTotal)} pendente · {formatBRL(total)} total
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
      </button>

      {expanded && (
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
      )}
    </div>
  );
}

export function ReceivablesList() {
  const {
    receivables,
    isLoading,
    people,
    addReceivable,
    updateAmountPaid,
    togglePaid,
    deleteReceivable,
    getByPerson,
    getPendingTotal,
  } = useReceivables();
  const user = useUserStore((s) => s.user);
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.person_name.trim() || !form.description.trim() || !form.amount) return;
    const amount = parseFloat(form.amount.replace(',', '.')) || 0;
    if (amount <= 0) {
      toast.error('Indique um valor maior que zero');
      return;
    }
    const paidRaw = parseFloat(form.amount_paid.replace(',', '.')) || 0;
    const amountPaid = Math.max(0, Math.min(amount, paidRaw));
    setSaving(true);
    try {
      await addReceivable({
        person_name: form.person_name.trim(),
        description: form.description.trim(),
        amount,
        amount_paid: amountPaid,
        reference_month: form.reference_month ? form.reference_month + '-01' : null,
        is_paid: amountPaid >= amount,
        paid_at: amountPaid >= amount ? getLocalDateStr(user?.profile?.timezone) : null,
      });
      setForm(EMPTY_FORM);
      setShowModal(false);
      toast.success('Cobrança adicionada');
    } catch {
      toast.error('Erro ao adicionar');
    } finally {
      setSaving(false);
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
          <p className="text-2xl font-bold text-text-primary">{formatBRL(totalPending)}</p>
        </div>
        <Button onClick={() => setShowModal(true)} leftIcon={<Plus size={14} />}>
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

      {receivables.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-2 text-text-muted bg-surface-2 rounded-xl border border-border">
          <p className="text-sm">Nenhuma cobrança registrada.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {people.map((person) => {
            const items = filterItems(getByPerson(person));
            if (items.length === 0) return null;
            return (
              <PersonCard
                key={person}
                person={person}
                items={items}
                onTogglePaid={handleToggle}
                onUpdatePaid={handleUpdatePaid}
                onDelete={handleDelete}
              />
            );
          })}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nova Cobrança">
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
            label="Valor total (R$)"
            type="number"
            step="0.01"
            placeholder="0,00"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <Input
            label="Já pago (R$) — opcional"
            type="number"
            step="0.01"
            min={0}
            placeholder="0"
            value={form.amount_paid}
            onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
          />
          <p className="text-[10px] text-text-muted -mt-1">
            Podes ir atualizando o “Pago” na lista até quitar o total.
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
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.person_name.trim() || !form.description.trim()}>
              Adicionar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
