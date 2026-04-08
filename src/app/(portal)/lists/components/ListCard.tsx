'use client';

import Link from 'next/link';
import type { List } from '@/types/database';
import { useUserStore } from '@/store/user-store';
import { ChevronRight, Users } from 'lucide-react';

interface ListCardProps {
  list: List & { item_count: number; checked_count: number };
  householdName?: string;
}

export function ListCard({ list, householdName }: ListCardProps) {
  const progress =
    list.item_count > 0
      ? Math.round((list.checked_count / list.item_count) * 100)
      : 0;

  const allDone = list.item_count > 0 && list.checked_count === list.item_count;

  return (
    <Link
      href={`/lists/${list.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-surface-2 px-5 py-4 hover:border-brand-primary/40 hover:bg-surface-3 transition-all duration-200"
    >
      {/* Ícone */}
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
        style={{
          backgroundColor: list.color ? `${list.color}20` : undefined,
        }}
      >
        {list.icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-text-primary truncate">{list.name}</p>
          {allDone && list.item_count > 0 && (
            <span className="shrink-0 text-xs text-green-400">✓ Completa</span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1">
          <p className="text-xs text-text-muted">
            {list.item_count === 0
              ? 'Sem itens'
              : `${list.checked_count}/${list.item_count} ${list.item_count === 1 ? 'item' : 'itens'}`}
          </p>
          {householdName && (
            <span className="inline-flex items-center gap-1 text-xs text-text-muted">
              <Users size={10} />
              {householdName}
            </span>
          )}
        </div>

        {/* Barra de progresso */}
        {list.item_count > 0 && (
          <div className="mt-2 h-1 w-full rounded-full bg-surface-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-primary transition-all duration-500"
              style={{
                width: `${progress}%`,
                backgroundColor: allDone ? '#22c55e' : undefined,
              }}
            />
          </div>
        )}
      </div>

      <ChevronRight
        size={16}
        className="text-text-muted shrink-0 group-hover:text-brand-primary transition-colors"
      />
    </Link>
  );
}
