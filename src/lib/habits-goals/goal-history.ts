import { createClient } from '@/lib/supabase/client';

/**
 * Busca o valor da meta de um tracker para uma data específica.
 * Considera o histórico de metas (se existir) ou retorna o valor atual.
 */
export async function getGoalValueForDate(
  trackerId: string,
  date: string
): Promise<number | null> {
  const supabase = createClient();
  
  // Usa a função RPC do Supabase
  const { data, error } = await supabase.rpc('get_tracker_goal_value', {
    p_tracker_id: trackerId,
    p_date: date,
  });
  
  if (error) {
    console.error('Erro ao buscar goal_value:', error);
    return null;
  }
  
  return data;
}

/**
 * Busca os valores de meta para múltiplos trackers em uma data específica.
 * Retorna um Map com tracker_id -> goal_value
 */
export async function getGoalValuesForDate(
  trackerIds: string[],
  date: string
): Promise<Map<string, number | null>> {
  const supabase = createClient();
  const result = new Map<string, number | null>();
  
  // Busca em paralelo
  const promises = trackerIds.map(async (id) => {
    const { data, error } = await supabase.rpc('get_tracker_goal_value', {
      p_tracker_id: id,
      p_date: date,
    });
    return { id, value: error ? null : data };
  });
  
  const responses = await Promise.all(promises);
  responses.forEach(({ id, value }) => result.set(id, value));
  
  return result;
}

/**
 * Busca o histórico completo de valores de meta para um tracker.
 */
export async function getGoalHistoryForTracker(
  trackerId: string
): Promise<{ effective_date: string; goal_value: number }[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('tracker_goal_history')
    .select('effective_date, goal_value')
    .eq('tracker_id', trackerId)
    .order('effective_date', { ascending: true });
  
  if (error) {
    console.error('Erro ao buscar histórico de metas:', error);
    return [];
  }
  
  return (data ?? []) as { effective_date: string; goal_value: number }[];
}

/**
 * Busca todos os valores de meta históricos para um período.
 * Útil para calcular retrospectivamente sem fazer muitas chamadas RPC.
 */
export async function getGoalHistoryForPeriod(
  trackerId: string,
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  const supabase = createClient();
  const result = new Map<string, number>();
  
  // Busca o histórico para o período
  const { data: historyData, error: historyError } = await supabase
    .from('tracker_goal_history')
    .select('effective_date, goal_value')
    .eq('tracker_id', trackerId)
    .gte('effective_date', startDate)
    .lte('effective_date', endDate)
    .order('effective_date', { ascending: true });
  
  if (historyError) {
    console.error('Erro ao buscar histórico:', historyError);
  }
  
  // Busca o valor atual do tracker (para preencher datas sem histórico)
  const { data: trackerData, error: trackerError } = await supabase
    .from('trackers')
    .select('goal_value')
    .eq('id', trackerId)
    .single();
  
  if (trackerError) {
    console.error('Erro ao buscar tracker:', trackerError);
    return result;
  }
  
  const currentGoalValue = trackerData?.goal_value ?? 0;
  const history = (historyData ?? []) as { effective_date: string; goal_value: number }[];
  
  // Preenche o resultado para cada dia do período
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    
    // Encontra o valor vigente para esta data
    // (último valor do histórico com effective_date <= dateStr, ou o valor atual)
    const applicableHistory = history.filter(h => h.effective_date <= dateStr);
    const latestHistory = applicableHistory[applicableHistory.length - 1];
    
    if (latestHistory) {
      result.set(dateStr, latestHistory.goal_value);
    } else {
      result.set(dateStr, currentGoalValue);
    }
  }
  
  return result;
}
