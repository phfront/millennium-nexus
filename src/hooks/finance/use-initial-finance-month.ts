'use client';

import { useEffect, useRef, useState } from 'react';
import { useUserStore } from '@/store/user-store';
import { createClient } from '@/lib/supabase/client';
import { getNextMonth, toMonthDate } from '@/lib/finance/finance';

/**
 * Mês em que uma tela de finanças abre: o corrente do calendário, ou o primeiro
 * que ainda não foi concluído. Um mês concluído está arquivado — abrir nele só
 * obrigava a avançar à mão.
 *
 * `finance_ensure_month_snapshots` só arquiva meses anteriores ao corrente, por
 * isso um snapshot em `month >= corrente` é sempre conclusão explícita.
 */
export function useInitialFinanceMonth(maxPlanningMonth: string) {
  const user = useUserStore((s) => s.user);
  const [month, setMonth] = useState(() => toMonthDate(new Date()));
  const resolvedRef = useRef(false);

  useEffect(() => {
    if (!user?.id || resolvedRef.current) return;

    const calendarMonth = toMonthDate(new Date());
    let cancelled = false;

    void (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('finance_month_snapshots')
        .select('month')
        .eq('user_id', user.id)
        .gte('month', calendarMonth);

      if (cancelled) return;
      resolvedRef.current = true;
      if (!data?.length) return;

      const concluded = new Set(data.map((row) => row.month as string));
      let next = calendarMonth;
      while (concluded.has(next)) next = getNextMonth(next);
      if (next === calendarMonth) return;

      setMonth(next > maxPlanningMonth ? maxPlanningMonth : next);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, maxPlanningMonth]);

  return [month, setMonth] as const;
}
