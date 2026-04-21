import type { DashboardWidgetBreakpoint } from '@/types/database';

/** Altura mínima de cada linha da grelha da home / editor (slot vertical). */
export const DASHBOARD_GRID_ROW_HEIGHT = 200;

export const DASHBOARD_GRID_MARGIN: [number, number] = [8, 8];

export const DASHBOARD_GRID_CONTAINER_PADDING: [number, number] = [0, 0];

export const DASHBOARD_ALLOWED_COL_SPANS: Record<DashboardWidgetBreakpoint, number[]> = {
  lg: [1, 2, 3],
  md: [1, 2],
  sm: [1],
};

export const DASHBOARD_ALLOWED_ROW_SPANS = [1, 2, 3, 4];

export const DASHBOARD_EDITOR_MAX_WIDTH: Record<DashboardWidgetBreakpoint, string> = {
  lg: '100%',
  md: '860px',
  sm: '430px',
};
