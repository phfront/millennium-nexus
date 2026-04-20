'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import type { Food } from '@/types/nutrition';

export function useFoods(searchTerm?: string) {
  const user = useUserStore((s) => s.user);
  const [foods, setFoods] = useState<Food[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFoods = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const supabase = createClient();

    let query = supabase
      .from('foods')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .order('name', { ascending: true })
      .limit(100);

    if (searchTerm && searchTerm.trim().length > 0) {
      query = query.ilike('name', `%${searchTerm.trim()}%`);
    }

    const { data } = await query;
    setFoods((data ?? []) as Food[]);
    setIsLoading(false);
  }, [user, searchTerm]);

  useEffect(() => {
    fetchFoods();
  }, [fetchFoods]);

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
    setFoods((prev) => [...prev, newFood].sort((a, b) => a.name.localeCompare(b.name)));
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
    setFoods((prev) => prev.map((f) => (f.id === id ? updated : f)));
    return updated;
  }

  async function deleteFood(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from('foods').delete().eq('id', id);
    if (error) throw new Error(error.message);
    setFoods((prev) => prev.filter((f) => f.id !== id));
  }

  return { foods, isLoading, refetch: fetchFoods, createFood, updateFood, deleteFood };
}
