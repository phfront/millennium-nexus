'use client';

import { useState, useTransition } from 'react';
import { updateList } from '@/lib/lists/actions';
import { Button, Input } from '@phfront/millennium-ui';
import { HouseholdSelector } from '@/components/households/HouseholdSelector';
import { X } from 'lucide-react';
import type { List } from '@/types/database';

const ICONS = ['📋', '🛒', '🏠', '💊', '📚', '🎁', '🍕', '🧹', '🐾', '✈️', '💼', '🎯'];
const COLORS = [
  null,
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#f97316',
];

interface EditListModalProps {
  list: List;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditListModal({ list, onClose, onSuccess }: EditListModalProps) {
  const [name, setName] = useState(list.name);
  const [icon, setIcon] = useState(list.icon || '📋');
  const [color, setColor] = useState<string | null>(list.color);
  const [householdId, setHouseholdId] = useState<string | null>(list.household_id);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Digite um nome para a lista.');
      return;
    }
    startTransition(async () => {
      try {
        await updateList(list.id, { 
          name: name.trim(), 
          icon, 
          color: color ?? undefined,
          household_id: householdId
        });
        onSuccess?.();
        onClose();
      } catch {
        setError('Erro ao atualizar lista. Tente novamente.');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-surface-2 border border-border shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Editar lista</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-3 text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
              Nome
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Lista de supermercado"
              maxLength={60}
              autoFocus
            />
          </div>

          {/* Ícone */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
              Ícone
            </label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-xl transition-all ${
                    icon === ic
                      ? 'ring-2 ring-brand-primary bg-brand-primary/10 scale-110'
                      : 'bg-surface-3 hover:bg-surface-3/80'
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Cor */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
              Cor
            </label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c ?? 'none'}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all ${
                    color === c
                      ? 'border-text-primary scale-110'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c ?? 'var(--color-surface-3)' }}
                  title={c ?? 'Sem cor'}
                >
                  {c === null && (
                    <span className="text-xs text-text-muted font-bold">∅</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Grupo */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
              Grupo (opcional)
            </label>
            <HouseholdSelector
              value={householdId}
              onChange={setHouseholdId}
              noneLabel="Nenhum (lista pessoal)"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              isLoading={isPending}
              disabled={isPending || !name.trim() || (name === list.name && icon === list.icon && color === list.color && householdId === list.household_id)}
            >
              Salvar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
