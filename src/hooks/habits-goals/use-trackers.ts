'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import type { Tracker } from '@/types/habits-goals';

function trackerMutationError(error: { code?: string; message: string }): Error {
  if (error.code === '23505' && error.message.includes('uq_trackers_active_specific_source')) {
    return new Error('Já existe uma meta ativa deste tipo. Desative a atual antes de ativar outra.');
  }
  return new Error(error.message);
}

export type UseTrackersOptions = {
  /** Incluir metas removidas (soft delete), p.ex. para o histórico por dia. */
  includeDeleted?: boolean;
};

export function useTrackers(activeOnly = false, options?: UseTrackersOptions) {
  const user = useUserStore((s) => s.user);
  const includeDeleted = options?.includeDeleted ?? false;
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrackers = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    let query = supabase
      .from('trackers')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });

    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    if (activeOnly) {
      query = query.eq('active', true);
    }

    const { data, error: err } = await query;
    if (err) {
      setError(err.message);
    } else {
      setTrackers((data ?? []) as Tracker[]);
    }
    setIsLoading(false);
  }, [user, activeOnly, includeDeleted]);

  useEffect(() => {
    fetchTrackers();
  }, [fetchTrackers]);

  async function createTracker(payload: Omit<Tracker, 'id' | 'user_id' | 'created_at' | 'deleted_at'>) {
    if (!user) return null;
    const supabase = createClient();
    const nextSortOrder =
      trackers.length > 0 ? Math.max(...trackers.map((tracker) => tracker.sort_order)) + 1 : 0;
    const { data, error: err } = await supabase
      .from('trackers')
      .insert({
        ...payload,
        sort_order: nextSortOrder,
        user_id: user.id,
        deleted_at: null,
      })
      .select()
      .single();
    if (err) throw trackerMutationError(err);
    await fetchTrackers();
    return data as Tracker;
  }

  async function updateTracker(id: string, payload: Partial<Tracker>) {
    const supabase = createClient();
    const { error: err } = await supabase
      .from('trackers')
      .update(payload)
      .eq('id', id);
    if (err) throw trackerMutationError(err);
    await fetchTrackers();
  }

  /** Remove a meta da lista sem apagar logs nem histórico de valores de meta. */
  async function deleteTracker(id: string) {
    const supabase = createClient();
    const deletedAt = new Date().toISOString();
    const { error: err } = await supabase
      .from('trackers')
      .update({ deleted_at: deletedAt, active: false })
      .eq('id', id);
    if (err) throw new Error(err.message);
    await supabase.from('tracker_notifications').delete().eq('tracker_id', id);
    await fetchTrackers();
  }

  async function reorderTrackers(orderedIds: string[]) {
    const previous = trackers;
    const byId = new Map(trackers.map((tracker) => [tracker.id, tracker]));
    const reordered = orderedIds
      .map((id, index) => {
        const tracker = byId.get(id);
        return tracker ? { ...tracker, sort_order: index } : null;
      })
      .filter((tracker): tracker is Tracker => tracker != null);

    if (reordered.length !== orderedIds.length) {
      throw new Error('Ordem inválida.');
    }

    setTrackers(reordered);

    const supabase = createClient();
    const results = await Promise.all(
      orderedIds.map((id, index) =>
        supabase.from('trackers').update({ sort_order: index }).eq('id', id),
      ),
    );

    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setTrackers(previous);
      throw new Error(failed.error.message);
    }
  }

  return {
    trackers,
    isLoading,
    error,
    refetch: fetchTrackers,
    createTracker,
    updateTracker,
    deleteTracker,
    reorderTrackers,
  };
}
