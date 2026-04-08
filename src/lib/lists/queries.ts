import { createClient } from '@/lib/supabase/server';
import type { List, ListItem } from '@/types/database';

export async function fetchUserLists(userId: string): Promise<
  (List & { item_count: number; checked_count: number })[]
> {
  const supabase = await createClient();

  // Busca listas pessoais
  const { data: personalLists } = await supabase
    .from('lists')
    .select('*')
    .eq('owner_id', userId)
    .is('household_id', null)
    .eq('is_archived', false)
    .order('sort_order', { ascending: true });

  // Busca households do user para listar listas partilhadas
  const { data: memberRows } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  const memberHouseholdIds = (memberRows ?? []).map((r) => r.household_id);

  // Busca listas de household do qual o user faz parte ou é owner
  const { data: ownedHouseholds } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', userId);

  const ownedIds = (ownedHouseholds ?? []).map((h) => h.id);
  const allHouseholdIds = [...new Set([...memberHouseholdIds, ...ownedIds])];

  let householdLists: List[] = [];
  if (allHouseholdIds.length > 0) {
    const { data } = await supabase
      .from('lists')
      .select('*')
      .in('household_id', allHouseholdIds)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true });
    householdLists = (data ?? []) as List[];
  }

  const allLists = [...(personalLists ?? []) as List[], ...householdLists];
  if (allLists.length === 0) return [];

  // Busca contagem de itens para cada lista
  const listIds = allLists.map((l) => l.id);
  const { data: items } = await supabase
    .from('list_items')
    .select('list_id, is_checked')
    .in('list_id', listIds);

  return allLists.map((list) => {
    const listItems = (items ?? []).filter((i) => i.list_id === list.id);
    return {
      ...list,
      item_count: listItems.length,
      checked_count: listItems.filter((i) => i.is_checked).length,
    };
  });
}

export async function fetchHouseholdLists(householdId: string): Promise<List[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('lists')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_archived', false)
    .order('sort_order', { ascending: true });
  return (data ?? []) as List[];
}

export async function fetchListById(listId: string): Promise<List | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('lists')
    .select('*')
    .eq('id', listId)
    .single();
  if (error || !data) return null;
  return data as List;
}

export async function fetchListItems(listId: string): Promise<ListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('list_items')
    .select('*')
    .eq('list_id', listId)
    .order('is_checked', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return (data ?? []) as ListItem[];
}
