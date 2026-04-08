'use client';

import { useState } from 'react';
import type { DisplayItem } from '@/hooks/lists/use-list-items';
import { Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface ListItemRowProps {
  item: DisplayItem;
  onToggle: (id: string, isChecked: boolean) => void;
  onDelete: (id: string) => void;
  showAddedBy?: boolean;
}

const UNIT_ABBR: Record<string, string> = {
  quilograma: 'kg',
  grama: 'g',
  litro: 'L',
  mililitro: 'ml',
  unidade: 'un',
  caixa: 'cx',
  pacote: 'pct',
  lata: 'lt',
};

function formatQuantity(quantity: number | null, unit: string | null): string | null {
  if (!quantity && !unit) return null;
  const qty =
    quantity != null
      ? Number.isInteger(quantity)
        ? quantity
        : quantity.toFixed(2).replace('.', ',')
      : '';
  const u = unit ? (UNIT_ABBR[unit.toLowerCase()] ?? unit) : '';
  return [qty, u].filter(Boolean).join(' ');
}

const CATEGORY_COLORS: Record<string, string> = {
  laticinios: '#60a5fa',
  hortifruti: '#4ade80',
  carnes: '#f87171',
  limpeza: '#a78bfa',
  higiene: '#fb923c',
  bebidas: '#38bdf8',
  padaria: '#fbbf24',
  outros: '#94a3b8',
};

function categoryColor(category: string | null): string {
  if (!category) return '#94a3b8';
  const key = category
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  for (const k of Object.keys(CATEGORY_COLORS)) {
    if (key.includes(k)) return CATEGORY_COLORS[k];
  }
  return '#94a3b8';
}

export function ListItemRow({ item, onToggle, onDelete, showAddedBy = false }: ListItemRowProps) {
  const [showDetails, setShowDetails] = useState(false);
  const quantityLabel = formatQuantity(item.quantity, item.unit);
  const isSaving = !!item._saving;

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        item.is_checked
          ? 'border-border/50 bg-surface-2/50 opacity-60'
          : isSaving
          ? 'border-border/60 bg-surface-2/70 opacity-80'
          : 'border-border bg-surface-2'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Checkbox / spinner */}
        <button
          onClick={() => !isSaving && onToggle(item.id, !item.is_checked)}
          disabled={isSaving}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ${
            isSaving
              ? 'border-border cursor-not-allowed'
              : item.is_checked
              ? 'border-green-400 bg-green-400'
              : 'border-border hover:border-brand-primary cursor-pointer'
          }`}
        >
          {isSaving ? (
            <Loader2 size={10} className="animate-spin text-text-muted" />
          ) : item.is_checked ? (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path
                d="M1 4L3.5 6.5L9 1"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </button>

        {/* Nome + info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-sm font-medium transition-all ${
                item.is_checked ? 'line-through text-text-muted' : 'text-text-primary'
              }`}
            >
              {item.name}
            </span>
            {quantityLabel && (
              <span className="text-xs text-text-muted bg-surface-3 rounded px-1.5 py-0.5">
                {quantityLabel}
              </span>
            )}
            {item.category && (
              <span
                className="text-xs rounded px-1.5 py-0.5 font-medium"
                style={{
                  backgroundColor: `${categoryColor(item.category)}20`,
                  color: categoryColor(item.category),
                }}
              >
                {item.category}
              </span>
            )}
            {isSaving && (
              <span className="text-xs text-text-muted italic">salvando...</span>
            )}
          </div>
          {item.notes && !showDetails && (
            <p className="text-xs text-text-muted mt-0.5 truncate">{item.notes}</p>
          )}
        </div>

        {/* Preço estimado */}
        {item.estimated_price != null && (
          <span className="text-xs text-text-muted shrink-0">
            R$ {item.estimated_price.toFixed(2).replace('.', ',')}
          </span>
        )}

        {/* Expand details */}
        {(item.notes || item.estimated_price != null) && (
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-muted hover:text-text-primary transition-colors"
          >
            {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}

        {/* Delete */}
        <button
          onClick={() => !isSaving && onDelete(item.id)}
          disabled={isSaving}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Remover item"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Painel de detalhes expandível */}
      {showDetails && (
        <div className="border-t border-border/50 px-4 py-2.5 space-y-1">
          {item.notes && (
            <p className="text-xs text-text-muted">
              <span className="font-medium text-text-primary">Nota: </span>
              {item.notes}
            </p>
          )}
          {item.estimated_price != null && item.quantity && (
            <p className="text-xs text-text-muted">
              <span className="font-medium text-text-primary">Total estimado: </span>
              R$ {(item.estimated_price * item.quantity).toFixed(2).replace('.', ',')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
