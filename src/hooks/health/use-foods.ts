'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { searchTextMatches } from '@/lib/string-utils';
import { useUserStore } from '@/store/user-store';
import type { Food } from '@/types/nutrition';

const FOODS_CATALOG_LIMIT = 1000;
const FOODS_BROWSE_LIMIT = 100;

export function useFoods(searchTerm?: string) {
  const user = useUserStore((s) => s.user);
  const [allFoods, setAllFoods] = useState<Food[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFoods = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const supabase = createClient();

    const { data } = await supabase
      .from('foods')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .order('name', { ascending: true })
      .limit(FOODS_CATALOG_LIMIT);

    setAllFoods((data ?? []) as Food[]);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchFoods();
  }, [fetchFoods]);

  const foods = useMemo(() => {
    const term = searchTerm?.trim();
    if (!term) return allFoods.slice(0, FOODS_BROWSE_LIMIT);
    return allFoods.filter((food) => searchTextMatches(food.name, term));
  }, [allFoods, searchTerm]);

  async function createFood(
    values: Pick<Food, 'name' | 'kcal_per_100g' | 'protein_per_100g' | 'carbs_per_100g' | 'fat_per_100g' | 'serving_unit'>,
    isGlobal = false,
  ) {
    if (!user) throw new Error('Não autenticado');
    const supabase = createClient();
    const { data, error } = await supabase
      .from('foods')
      .insert({
        ...values,
        user_id: isGlobal ? null : user.id,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new Error('Alimento já cadastrado com esse nome.');
      throw new Error(error.message);
    }
    const newFood = data as Food;
    setAllFoods((prev) => [...prev, newFood].sort((a, b) => a.name.localeCompare(b.name)));
    return newFood;
  }

  async function updateFood(
    id: string,
    values: Partial<Pick<Food, 'name' | 'kcal_per_100g' | 'protein_per_100g' | 'carbs_per_100g' | 'fat_per_100g' | 'serving_unit'>>,
  ) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('foods')
      .update(values)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const updated = data as Food;
    setAllFoods((prev) => prev.map((f) => (f.id === id ? updated : f)));
    return updated;
  }

  async function deleteFood(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from('foods').delete().eq('id', id);
    if (error) throw new Error(error.message);
    setAllFoods((prev) => prev.filter((f) => f.id !== id));
  }

  return { foods, isLoading, refetch: fetchFoods, createFood, updateFood, deleteFood };
}
