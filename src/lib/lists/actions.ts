'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth';
import type { ListItem } from '@/types/database';

// ── Lists ────────────────────────────────────────────────────

export async function createList(values: {
  name: string;
  icon?: string;
  color?: string;
  household_id?: string | null;
}) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('lists')
    .insert({
      owner_id: user.id,
      name: values.name.trim(),
      icon: values.icon ?? '📋',
      color: values.color ?? null,
      household_id: values.household_id ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/lists');
  return data;
}

export async function updateList(
  listId: string,
  values: { name?: string; icon?: string; color?: string; household_id?: string | null; is_archived?: boolean },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('lists')
    .update(values)
    .eq('id', listId);
  if (error) throw new Error(error.message);
  revalidatePath('/lists');
  revalidatePath(`/lists/${listId}`);
}

export async function deleteList(listId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('lists').delete().eq('id', listId);
  if (error) throw new Error(error.message);
  revalidatePath('/lists');
}

// ── List Items ───────────────────────────────────────────────

export async function addListItem(
  listId: string,
  values: {
    name: string;
    quantity?: number | null;
    unit?: string | null;
    category?: string | null;
    notes?: string | null;
    estimated_price?: number | null;
  },
) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const supabase = await createClient();

  // Próximo sort_order
  const { count } = await supabase
    .from('list_items')
    .select('*', { count: 'exact', head: true })
    .eq('list_id', listId);

  const { data, error } = await supabase
    .from('list_items')
    .insert({
      list_id: listId,
      name: values.name.trim(),
      quantity: values.quantity ?? null,
      unit: values.unit?.trim() || null,
      category: values.category?.trim() || null,
      notes: values.notes?.trim() || null,
      estimated_price: values.estimated_price ?? null,
      is_checked: false,
      added_by: user.id,
      sort_order: count ?? 0,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/lists/${listId}`);
  return data as ListItem;
}

export async function toggleListItem(itemId: string, listId: string, isChecked: boolean) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const supabase = await createClient();

  const { error } = await supabase
    .from('list_items')
    .update({
      is_checked: isChecked,
      checked_by: isChecked ? user.id : null,
      checked_at: isChecked ? new Date().toISOString() : null,
    })
    .eq('id', itemId);

  if (error) throw new Error(error.message);
  revalidatePath(`/lists/${listId}`);
}

export async function updateListItem(
  itemId: string,
  listId: string,
  values: Partial<{
    name: string;
    quantity: number | null;
    unit: string | null;
    category: string | null;
    notes: string | null;
    estimated_price: number | null;
  }>,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('list_items')
    .update(values)
    .eq('id', itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/lists/${listId}`);
}

export async function deleteListItem(itemId: string, listId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('list_items').delete().eq('id', itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/lists/${listId}`);
}

export async function clearCheckedItems(listId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('list_items')
    .delete()
    .eq('list_id', listId)
    .eq('is_checked', true);
  if (error) throw new Error(error.message);
  revalidatePath(`/lists/${listId}`);
}
