'use client';

import { useListItems } from '@/hooks/lists/use-list-items';
import { ListDetailHeader } from '../components/ListDetailHeader';
import { ListItemRow } from '../components/ListItemRow';
import { AddItemForm } from '../components/AddItemForm';
import type { List, ListItem } from '@/types/database';
import { CheckCheck } from 'lucide-react';

interface ListDetailClientProps {
  list: List;
  initialItems: ListItem[];
  householdName?: string;
}

export function ListDetailClient({
  list,
  initialItems,
  householdName,
}: ListDetailClientProps) {
  const {
    items,
    isLoading,
    estimatedTotal,
    pendingCount,
    checkedCount,
    add,
    toggle,
    remove,
    clearChecked,
  } = useListItems(list.id);

  // Usa items do hook (realtime+optimistic); cai de volta para os SSR enquanto ancora
  const displayItems = isLoading && items.length === 0 ? (initialItems as typeof items) : items;

  const pendingItems = displayItems.filter((i) => !i.is_checked);
  const checkedItems = displayItems.filter((i) => i.is_checked);

  const displayPending = isLoading && items.length === 0
    ? initialItems.filter((i) => !i.is_checked).length
    : pendingCount;

  const displayChecked = isLoading && items.length === 0
    ? initialItems.filter((i) => i.is_checked).length
    : checkedCount;

  return (
    <div className="space-y-4">
      {/* Header com progresso */}
      <ListDetailHeader
        list={list}
        pendingCount={displayPending}
        checkedCount={displayChecked}
        estimatedTotal={estimatedTotal}
        householdName={householdName}
      />

      {/* Formulário de adição */}
      <AddItemForm onAdd={add} />

      {/* Itens pendentes */}
      {pendingItems.length > 0 && (
        <div className="space-y-2">
          {pendingItems.map((item) => (
            <ListItemRow
              key={item.id}
              item={item}
              onToggle={toggle}
              onDelete={remove}
              showAddedBy={!!list.household_id}
            />
          ))}
        </div>
      )}

      {/* Itens concluídos */}
      {checkedItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
              Concluídos ({checkedItems.length})
            </p>
            <button
              onClick={clearChecked}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-red-400 transition-colors"
            >
              <CheckCheck size={12} />
              Limpar
            </button>
          </div>
          <div className="space-y-2">
            {checkedItems.map((item) => (
              <ListItemRow
                key={item.id}
                item={item}
                onToggle={toggle}
                onDelete={remove}
                showAddedBy={!!list.household_id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {displayItems.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="text-4xl">{list.icon}</span>
          <div>
            <p className="font-medium text-text-primary">Lista vazia</p>
            <p className="text-sm text-text-muted mt-0.5">
              Adicione o primeiro item acima
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
