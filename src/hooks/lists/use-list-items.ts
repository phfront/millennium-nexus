'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@phfront/millennium-ui';
import {
  addListItem as serverAdd,
  toggleListItem as serverToggle,
  deleteListItem as serverDelete,
  clearCheckedItems as serverClearChecked,
} from '@/lib/lists/actions';
import type { ListItem } from '@/types/database';

// Estende ListItem com flags de estado optimista
export type DisplayItem = ListItem & {
  _saving?: boolean;   // operação em curso (add / toggle / delete)
  _tempId?: string;    // presente só em items optimistas ainda não confirmados
};

export type AddItemInput = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  category?: string | null;
  notes?: string | null;
  estimated_price?: number | null;
};

function sortItems(items: DisplayItem[]): DisplayItem[] {
  return [...items].sort((a, b) => {
    // Não-concluídos primeiro
    if (a.is_checked !== b.is_checked) return a.is_checked ? 1 : -1;
    // Items em loading ficam no fundo do seu grupo
    if (!!a._saving !== !!b._saving) return a._saving ? 1 : -1;
    return a.sort_order - b.sort_order
      || new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export function useListItems(listId: string) {
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const { toast } = useToast();

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('list_items')
      .select('*')
      .eq('list_id', listId)
      .order('is_checked', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    setItems((data ?? []) as DisplayItem[]);
    setIsLoading(false);
  }, [listId]);

  useEffect(() => {
    refetch();

    const supabase = createClient();
    const channel = supabase
      .channel(`list_items_v2:${listId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'list_items', filter: `list_id=eq.${listId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as ListItem;
            setItems((prev) => {
              // Se tiver um temp com mesmo nome, substitui; senão, adiciona
              const tempIdx = prev.findIndex(
                (i) => i._tempId && i.name === newItem.name,
              );
              if (tempIdx !== -1) {
                const next = [...prev];
                next[tempIdx] = newItem; // substitui temp pelo real
                return sortItems(next);
              }
              // Evita duplicata
              if (prev.find((i) => i.id === newItem.id)) return prev;
              return sortItems([...prev, newItem]);
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as ListItem;
            setItems((prev) =>
              sortItems(
                prev.map((i) =>
                  i.id === updated.id
                    ? { ...updated, _saving: false } // limpa flag ao receber confirmação
                    : i,
                ),
              ),
            );
          } else if (payload.eventType === 'DELETE') {
            setItems((prev) => prev.filter((i) => i.id !== (payload.old as ListItem).id));
          }
        },
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [listId, refetch]);

  // ── Mutações com optimistic UI ──────────────────────────────

  /** Adiciona item: coloca temp imediatamente, remove quando realtime confirmar */
  async function add(data: AddItemInput) {
    const tempId = `temp-${Date.now()}`;
    const optimistic: DisplayItem = {
      id: tempId,
      _tempId: tempId,
      list_id: listId,
      name: data.name,
      quantity: data.quantity ?? null,
      unit: data.unit ?? null,
      category: data.category ?? null,
      notes: data.notes ?? null,
      estimated_price: data.estimated_price ?? null,
      is_checked: false,
      added_by: null,
      checked_by: null,
      checked_at: null,
      sort_order: items.filter((i) => !i._saving).length,
      created_at: new Date().toISOString(),
      _saving: true,
    };

    setItems((prev) => sortItems([...prev, optimistic]));

    try {
      const addedItem = await serverAdd(listId, data);
      
      // Substitui o temp pelo item real retornado pelo servidor
      setItems((prev) => {
        // Se o realtime já o inseriu por ter chegado rápido, evita duplicata
        if (prev.find((i) => i.id === addedItem.id && !i._tempId)) {
           return prev.filter((i) => i._tempId !== tempId);
        }
        return sortItems(
          prev.map((i) => (i._tempId === tempId ? addedItem : i))
        );
      });
    } catch {
      setItems((prev) => prev.filter((i) => i._tempId !== tempId));
      toast.error('Erro ao adicionar', 'Não foi possível adicionar o item.');
    }
  }

  /** Toggle checked: aplica imediatamente, reverte se falhar */
  async function toggle(itemId: string, isChecked: boolean) {
    setItems((prev) =>
      sortItems(
        prev.map((i) =>
          i.id === itemId
            ? { ...i, is_checked: isChecked, _saving: true }
            : i,
        ),
      ),
    );

    try {
      const supabase = createClient();
      
      // Update direto do client (evita a fila de Server Actions do Next.js)
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('list_items')
        .update({
          is_checked: isChecked,
          checked_by: isChecked && user ? user.id : null,
          checked_at: isChecked ? new Date().toISOString() : null,
        })
        .eq('id', itemId);

      if (error) throw error;

      // Limpa a flag de loading imediatamente
      setItems((prev) =>
        sortItems(
          prev.map((i) =>
            i.id === itemId ? { ...i, _saving: false } : i
          )
        )
      );
    } catch {
      setItems((prev) =>
        sortItems(
          prev.map((i) =>
            i.id === itemId
              ? { ...i, is_checked: !isChecked, _saving: false }
              : i,
          ),
        ),
      );
      toast.error('Erro', 'Não foi possível atualizar o item.');
    }
  }

  /** Delete: remove imediatamente, restaura se falhar */
  async function remove(itemId: string) {
    const backup = items.find((i) => i.id === itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));

    try {
      const supabase = createClient();
      const { error } = await supabase.from('list_items').delete().eq('id', itemId);
      if (error) throw error;
    } catch {
      if (backup) setItems((prev) => sortItems([...prev, backup]));
      toast.error('Erro ao remover', 'Não foi possível remover o item.');
    }
  }

  /** Limpa todos os concluídos: remove imediatamente, restaura se falhar */
  async function clearChecked() {
    const backup = items.filter((i) => i.is_checked && !i._saving);
    setItems((prev) => prev.filter((i) => !i.is_checked));

    try {
      await serverClearChecked(listId);
    } catch {
      setItems((prev) => sortItems([...prev, ...backup]));
      toast.error('Erro', 'Não foi possível limpar os itens concluídos.');
    }
  }

  // ── Computed ────────────────────────────────────────────────

  const confirmedItems = items.filter((i) => !i._tempId);
  const pendingCount = items.filter((i) => !i.is_checked).length;
  const checkedCount = items.filter((i) => i.is_checked && !i._saving).length;
  const estimatedTotal = items
    .filter((i) => !i.is_checked && !i._tempId && i.estimated_price != null)
    .reduce((acc, i) => acc + (i.estimated_price ?? 0) * (i.quantity ?? 1), 0);

  return {
    items,
    isLoading,
    refetch,
    pendingCount,
    checkedCount,
    estimatedTotal,
    // mutations
    add,
    toggle,
    remove,
    clearChecked,
  };
}
