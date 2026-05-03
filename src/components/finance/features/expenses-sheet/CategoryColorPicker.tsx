'use client';

import { useRef } from 'react';

export const CATEGORY_COLOR_PALETTE = [
  '#8b5cf6',
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#ec4899',
  '#64748b',
] as const;

function normalizeHex(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    const r = t[1]!;
    const g = t[2]!;
    const b = t[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

export type CategoryColorPickerProps = {
  value: string | null;
  onChange: (hex: string | null) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
};

export function CategoryColorPicker({ value, onChange, size = 'sm', disabled = false }: CategoryColorPickerProps) {
  const customInputRef = useRef<HTMLInputElement>(null);
  const swatchSize = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  const ring = 'ring-2 ring-offset-2 ring-offset-surface-3 ring-brand-primary';

  const normalized = value ? normalizeHex(value) : null;
  const inPalette = normalized && (CATEGORY_COLOR_PALETTE as readonly string[]).includes(normalized);

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Cor da categoria">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(null)}
        className={`flex ${swatchSize} shrink-0 items-center justify-center rounded-md border border-dashed border-border text-[10px] font-medium text-text-muted transition-opacity hover:bg-surface-4 disabled:opacity-50 ${
          !value ? ring : ''
        }`}
        title="Sem cor"
      >
        ∅
      </button>
      {CATEGORY_COLOR_PALETTE.map((hex) => (
        <button
          key={hex}
          type="button"
          disabled={disabled}
          onClick={() => onChange(hex)}
          className={`${swatchSize} shrink-0 rounded-md border border-border/60 transition-transform hover:scale-105 disabled:opacity-50 ${
            normalized === hex ? ring : ''
          }`}
          style={{ backgroundColor: hex }}
          title={hex}
          aria-label={`Cor ${hex}`}
        />
      ))}
      <div className="relative shrink-0">
        <button
          type="button"
          disabled={disabled}
          onClick={() => customInputRef.current?.click()}
          className={`flex ${swatchSize} items-center justify-center rounded-md border border-border bg-surface-4 text-[10px] font-semibold text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary disabled:opacity-50 ${
            value && !inPalette ? ring : ''
          }`}
          title="Cor personalizada"
        >
          +
        </button>
        <input
          ref={customInputRef}
          type="color"
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          aria-hidden
          tabIndex={-1}
          value={normalized ?? '#6366f1'}
          onChange={(e) => {
            const next = normalizeHex(e.target.value);
            if (next) onChange(next);
          }}
        />
      </div>
    </div>
  );
}
