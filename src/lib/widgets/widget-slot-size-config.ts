import type { DashboardWidgetKey } from '@/lib/widgets/catalog';
import type { DashboardWidgetBreakpoint } from '@/types/database';

/**
 * Ajustes de tamanho em slots (colunas x linhas da grid do dashboard).
 * Complementam os limites base em `DASHBOARD_WIDGET_CATALOG` e têm prioridade no `clampLayoutSize`.
 *
 * - `minRowSpan` / `maxRowSpan`: número mínimo/máximo de linhas do slot (campo `h` persistido).
 * - `minColSpan` / `maxColSpan`: por breakpoint, colunas mínimas/máximas (campo `w`).
 */
export type WidgetSlotSizeOverride = {
  minRowSpan?: number;
  maxRowSpan?: number;
  minColSpan?: Partial<Record<DashboardWidgetBreakpoint, number>>;
  maxColSpan?: Partial<Record<DashboardWidgetBreakpoint, number>>;
};

export const WIDGET_SLOT_SIZE_OVERRIDES: Partial<Record<DashboardWidgetKey, WidgetSlotSizeOverride>> = {
  health_meals: {
    minRowSpan: 2,
  },
};
