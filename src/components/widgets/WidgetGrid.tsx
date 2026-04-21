'use client';

import { useMemo } from 'react';
import { Card } from '@phfront/millennium-ui';
import {
  DASHBOARD_COLUMNS,
  DASHBOARD_WIDGET_BY_KEY,
  type DashboardWidgetKey,
} from '@/lib/widgets/catalog';
import {
  DASHBOARD_GRID_MARGIN,
  DASHBOARD_GRID_ROW_HEIGHT,
} from '@/lib/widgets/grid-config';
import type { DashboardWidgetBreakpoint } from '@/types/database';
import {
  clampLayoutSize,
  normalizeBreakpointLayout,
  type WidgetLayoutByBreakpoint,
} from '@/lib/widgets/layout';
import { WidgetRenderer } from '@/components/widgets/widget-registry';
import { WidgetSlotProvider } from '@/components/widgets/widget-slot-context';

type WidgetGridProps = {
  widgetKeys: DashboardWidgetKey[];
  layouts: WidgetLayoutByBreakpoint;
  breakpoint: DashboardWidgetBreakpoint;
};

export function WidgetGrid({ widgetKeys, layouts, breakpoint }: WidgetGridProps) {
  const items = useMemo(() => {
    const cols = DASHBOARD_COLUMNS[breakpoint];
    const raw: Array<{ key: DashboardWidgetKey; x: number; y: number; w: number; h: number }> = [];
    for (const key of widgetKeys) {
      const current = layouts[breakpoint][key];
      const catalog = DASHBOARD_WIDGET_BY_KEY.get(key);
      if (!current || !catalog) continue;
      const { w, h } = clampLayoutSize(key, breakpoint, current.w, current.h);
      const x = Math.min(Math.max(0, current.x), Math.max(0, cols - w));
      raw.push({ key, x, y: Math.max(0, current.y), w, h });
    }
    if (raw.length === 0) return raw;
    /** Sem isto, `y > 0` com linhas vazias acima cria trilhos implicitos e o widget parece "descolado" do topo. */
    const packed = normalizeBreakpointLayout(breakpoint, raw, { compactToTop: true });
    return packed.map((entry) => ({
      key: entry.key,
      x: entry.x,
      y: entry.y,
      w: entry.w,
      h: entry.h,
    }));
  }, [breakpoint, layouts, widgetKeys]);

  return (
    <div
      className="widget-view-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${DASHBOARD_COLUMNS[breakpoint]}, minmax(0, 1fr))`,
        gridAutoRows: `${DASHBOARD_GRID_ROW_HEIGHT}px`,
        gap: `${DASHBOARD_GRID_MARGIN[1]}px ${DASHBOARD_GRID_MARGIN[0]}px`,
      }}
    >
      {items.map((item) => (
        <div
          key={item.key}
          className="min-h-0 overflow-hidden"
          style={{
            gridColumn: `${item.x + 1} / span ${item.w}`,
            gridRow: `${item.y + 1} / span ${item.h}`,
          }}
        >
          <Card className="h-full min-h-0 overflow-hidden">
            <WidgetSlotProvider value={{ rowSpan: item.h, colSpan: item.w }}>
              <WidgetRenderer widgetKey={item.key} />
            </WidgetSlotProvider>
          </Card>
        </div>
      ))}
    </div>
  );
}
