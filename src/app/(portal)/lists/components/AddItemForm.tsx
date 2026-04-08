'use client';

import { useState, useRef } from 'react';
import type { AddItemInput } from '@/hooks/lists/use-list-items';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@phfront/millennium-ui';

interface AddItemFormProps {
  onAdd: (data: AddItemInput) => Promise<void>;
}

const UNITS = ['un', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'lata', 'dz'];

export function AddItemForm({ onAdd }: AddItemFormProps) {
  const [name, setName] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function resetDetail() {
    setQuantity('');
    setUnit('');
    setCategory('');
    setNotes('');
    setEstimatedPrice('');
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    // Reset imediato para o user poder continuar a digitar
    setName('');
    resetDetail();
    inputRef.current?.focus();

    // Chama callback optimista (não bloqueia)
    await onAdd({
      name: trimmed,
      quantity: quantity ? parseFloat(quantity.replace(',', '.')) : null,
      unit: unit || null,
      category: category || null,
      notes: notes || null,
      estimated_price: estimatedPrice
        ? parseFloat(estimatedPrice.replace(',', '.'))
        : null,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-2 overflow-hidden">
      {/* Linha rápida */}
      <form onSubmit={handleSubmit} className="flex items-center gap-3 px-4 py-3">
        <button
          type="submit"
          disabled={!name.trim()}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Plus size={15} />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Adicionar item..."
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-surface-3 text-text-muted hover:text-text-primary transition-colors"
          title={expanded ? 'Modo simples' : 'Modo detalhado'}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </form>

      {/* Campos detalhados */}
      {expanded && (
        <div className="border-t border-border/50 px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-text-muted">Quantidade</label>
            <Input
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Ex: 2"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-text-muted">Unidade</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-3 py-2 px-3 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/40"
            >
              <option value="">—</option>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-text-muted">Categoria</label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex: Laticínios"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-text-muted">Preço estimado (R$)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={estimatedPrice}
              onChange={(e) => setEstimatedPrice(e.target.value)}
              placeholder="Ex: 8.90"
            />
          </div>

          <div className="space-y-1 col-span-2">
            <label className="text-xs text-text-muted">Observação</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: sem glúten, integral..."
            />
          </div>
        </div>
      )}
    </div>
  );
}
