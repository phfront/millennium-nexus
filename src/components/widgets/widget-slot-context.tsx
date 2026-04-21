'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type WidgetSlotContextValue = {
  /** Linhas do slot na grelha da home (`grid-row: span h`). */
  rowSpan: number;
  /** Colunas do slot na grelha da home. */
  colSpan: number;
};

const WidgetSlotContext = createContext<WidgetSlotContextValue | null>(null);

export function WidgetSlotProvider({
  value,
  children,
}: {
  value: WidgetSlotContextValue;
  children: ReactNode;
}) {
  return <WidgetSlotContext.Provider value={value}>{children}</WidgetSlotContext.Provider>;
}

/** `null` fora da grelha (ex.: testes isolados). */
export function useWidgetSlotOptional(): WidgetSlotContextValue | null {
  return useContext(WidgetSlotContext);
}
