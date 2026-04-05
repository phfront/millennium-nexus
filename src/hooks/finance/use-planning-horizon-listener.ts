'use client';

import { useEffect } from 'react';
import { PLANNING_HORIZON_CHANGED_EVENT } from '@/lib/finance/finance-planning-events';

/** Refetch quando o horizonte de planilha encolhe e entradas futuras são removidas na BD. */
export function usePlanningHorizonListener(refetch: () => void | Promise<void>): void {
  useEffect(() => {
    const run = () => {
      void refetch();
    };
    window.addEventListener(PLANNING_HORIZON_CHANGED_EVENT, run);
    return () => window.removeEventListener(PLANNING_HORIZON_CHANGED_EVENT, run);
  }, [refetch]);
}
