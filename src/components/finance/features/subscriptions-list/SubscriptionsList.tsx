'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Modal, Input, Button, Skeleton, useToast } from '@phfront/millennium-ui';
import { useSubscriptions } from '@/hooks/finance/use-subscriptions';
import { formatBRL } from '@/lib/finance/format';
import type { Subscription } from '@/types/finance';

function SubscriptionCard({
  sub,
  onEdit,
  onDelete,
  onToggle,
}: {
  sub: Subscription;
  onEdit: (s: Subscription) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const monthly = sub.billing_cycle === 'yearly' ? sub.amount / 12 : sub.amount;

  return (
    <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors
      ${sub.is_active ? 'bg-surface-2 border-border' : 'bg-surface-1 border-border/50 opacity-60'}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{sub.name}</p>
        <p className="text-xs text-text-muted">
          {formatBRL(sub.amount)}{sub.billing_cycle === 'yearly' ? '/ano' : '/mês'}
          {sub.billing_cycle === 'yearly' && (
            <span className="ml-1 text-text-muted">({formatBRL(monthly)}/mês)</span>
          )}
          {sub.renewal_day && <span className="ml-1">· dia {sub.renewal_day}</span>}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onToggle(sub.id)}
          className={`text-xs px-2 py-0.5 rounded-full transition-colors cursor-pointer
            ${sub.is_active ? 'bg-green-500/15 text-green-500 hover:bg-green-500/25' : 'bg-surface-3 text-text-muted hover:bg-surface-4'}`}
        >
          {sub.is_active ? 'Ativa' : 'Inativa'}
        </button>
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
};

export function SubscriptionsList() {
  const { active, inactive, monthlyTotal, isLoading, addSubscription, updateSubscription, deleteSubscription } = useSubscriptions();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showInactive, setShowInactive] = useState(false);
  const [saving, setSaving] = useState(false);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(sub: Subscription) {
    setEditing(sub);
    setForm({ name: sub.name, amount: sub.amount, billing_cycle: sub.billing_cycle, renewal_day: sub.renewal_day, is_active: sub.is_active });
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

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="flex flex-col gap-4">
      {/* Header com total */}
      <div className="flex items-center justify-between bg-surface-2 border border-border rounded-xl p-4">
        <div>
          <p className="text-xs text-text-muted mb-0.5">Total mensal ativo</p>
          <p className="text-2xl font-bold text-text-primary">{formatBRL(monthlyTotal)}<span className="text-sm font-normal text-text-muted">/mês</span></p>
        </div>
        <Button onClick={openAdd} leftIcon={<Plus size={14} />}>Nova Assinatura</Button>
      </div>

      {/* Assinaturas ativas */}
      {active.length === 0 ? (
        <div className="flex flex-col items-center py-10 gap-2 text-text-muted bg-surface-2 rounded-xl border border-border">
          <p className="text-sm">Nenhuma assinatura ativa.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {active.map((s) => (
            <SubscriptionCard key={s.id} sub={s} onEdit={openEdit} onDelete={handleDelete} onToggle={handleToggle} />
          ))}
        </div>
      )}

      {/* Inativas */}
      {inactive.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowInactive(!showInactive)}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors cursor-pointer mb-2"
          >
            {showInactive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {inactive.length} assinaturas inativas
          </button>
          {showInactive && (
            <div className="flex flex-col gap-2">
              {inactive.map((s) => (
                <SubscriptionCard key={s.id} sub={s} onEdit={openEdit} onDelete={handleDelete} onToggle={handleToggle} />
              ))}
            </div>
          )}
        </div>
      )}

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
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>{editing ? 'Salvar' : 'Adicionar'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
