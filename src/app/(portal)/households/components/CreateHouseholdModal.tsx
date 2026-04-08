'use client';

import { useState, useTransition } from 'react';
import { createHousehold } from '@/lib/households/actions';
import { Button, Input } from '@phfront/millennium-ui';
import { X } from 'lucide-react';

interface CreateHouseholdModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateHouseholdModal({ onClose, onSuccess }: CreateHouseholdModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Digite um nome para o grupo.');
      return;
    }

    startTransition(async () => {
      try {
        await createHousehold(name.trim());
        onSuccess?.();
        onClose();
      } catch {
        setError('Erro ao criar grupo. Tente novamente.');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-surface-2 border border-border shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Novo grupo</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-3 text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
              Nome do grupo
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Família Silva, República..."
              maxLength={60}
              autoFocus
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

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
              disabled={isPending || !name.trim()}
            >
              Criar grupo
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
