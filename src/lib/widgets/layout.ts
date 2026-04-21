import {
  DASHBOARD_BREAKPOINTS,
  DASHBOARD_COLUMNS,
  DASHBOARD_WIDGET_BY_KEY,
  DASHBOARD_WIDGET_CATALOG,
  type DashboardWidgetKey,
} from '@/lib/widgets/catalog';
import {
  DASHBOARD_ALLOWED_COL_SPANS,
  DASHBOARD_ALLOWED_ROW_SPANS,
} from '@/lib/widgets/grid-config';
import { WIDGET_SLOT_SIZE_OVERRIDES } from '@/lib/widgets/widget-slot-size-config';
import type {
  DashboardWidgetBreakpoint,
  UserDashboardWidget,
  UserDashboardWidgetLayout,
} from '@/types/database';

export type WidgetLayoutByBreakpoint = Record<
  DashboardWidgetBreakpoint,
  Record<DashboardWidgetKey, Pick<UserDashboardWidgetLayout, 'x' | 'y' | 'w' | 'h'>>
>;

export function buildDefaultWidgetPrefs(
  userId: string,
  allowedModuleSlugs: Set<string>,
): UserDashboardWidget[] {
  return DASHBOARD_WIDGET_CATALOG
    .filter((item) => allowedModuleSlugs.has(item.moduleSlug))
    .sort((a, b) => a.defaultPosition - b.defaultPosition)
    .map((item) => ({
      user_id: userId,
      widget_key: item.key,
      is_visible: item.defaultVisible,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
}

export function buildDefaultWidgetLayouts(
  userId: string,
  allowedModuleSlugs: Set<string>,
): UserDashboardWidgetLayout[] {
  const widgets = DASHBOARD_WIDGET_CATALOG
    .filter((item) => allowedModuleSlugs.has(item.moduleSlug))
    .sort((a, b) => a.defaultPosition - b.defaultPosition);

  const rowsByBreakpoint: Record<DashboardWidgetBreakpoint, number> = {
    lg: 0,
    md: 0,
    sm: 0,
  };

  const nextXByBreakpoint: Record<DashboardWidgetBreakpoint, number> = {
    lg: 0,
    md: 0,
    sm: 0,
  };

  const rowsHeightByBreakpoint: Record<DashboardWidgetBreakpoint, number> = {
    lg: 0,
    md: 0,
    sm: 0,
  };

  const rows: UserDashboardWidgetLayout[] = [];

  for (const item of widgets) {
    for (const breakpoint of DASHBOARD_BREAKPOINTS) {
      const cols = DASHBOARD_COLUMNS[breakpoint];
      const width = clampLayoutSize(item.key, breakpoint, item.defaultW[breakpoint], 1).w;
      const height = clampLayoutSize(item.key, breakpoint, 1, item.defaultH[breakpoint]).h;

      const nextX = nextXByBreakpoint[breakpoint];
      const currentY = rowsByBreakpoint[breakpoint];

      if (nextX + width > cols) {
        rowsByBreakpoint[breakpoint] = rowsByBreakpoint[breakpoint] + rowsHeightByBreakpoint[breakpoint];
        rowsHeightByBreakpoint[breakpoint] = 0;
        nextXByBreakpoint[breakpoint] = 0;
      }

      const rowY = rowsByBreakpoint[breakpoint];
      const rowX = nextXByBreakpoint[breakpoint];

      rowsHeightByBreakpoint[breakpoint] = Math.max(rowsHeightByBreakpoint[breakpoint], height);
      nextXByBreakpoint[breakpoint] = rowX + width;

      rows.push({
        user_id: userId,
        widget_key: item.key,
        breakpoint,
        x: rowX,
        y: Math.max(currentY, rowY),
        w: width,
        h: height,
        unit_scale: 2,
        updated_at: new Date().toISOString(),
      });
    }
  }

  return rows;
}

export function normalizeWidgetLayouts(
  layouts: UserDashboardWidgetLayout[],
): WidgetLayoutByBreakpoint {
  const fallback: WidgetLayoutByBreakpoint = {
    lg: {} as WidgetLayoutByBreakpoint['lg'],
    md: {} as WidgetLayoutByBreakpoint['md'],
    sm: {} as WidgetLayoutByBreakpoint['sm'],
  };

  for (const row of layouts) {
    const widgetKey = row.widget_key as DashboardWidgetKey;
    if (!DASHBOARD_WIDGET_BY_KEY.has(widgetKey)) continue;
    fallback[row.breakpoint][widgetKey] = {
      x: row.x,
      y: row.y,
      w: row.w,
      h: row.h,
    };
  }

  return fallback;
}

export function clampLayoutSize(
  key: DashboardWidgetKey,
  breakpoint: DashboardWidgetBreakpoint,
  w: number,
  h: number,
): { w: number; h: number } {
  const item = DASHBOARD_WIDGET_BY_KEY.get(key);
  if (!item) return { w: 1, h: 1 };

  const override = WIDGET_SLOT_SIZE_OVERRIDES[key];
  const minW = Math.max(item.minW, override?.minColSpan?.[breakpoint] ?? 0);
  const maxColOverride = override?.maxColSpan?.[breakpoint];
  const maxW =
    maxColOverride !== undefined ? Math.min(item.maxW, maxColOverride) : item.maxW;
  const minH = Math.max(item.minH, override?.minRowSpan ?? 0);
  const maxH =
    override?.maxRowSpan !== undefined ? Math.min(item.maxH, override.maxRowSpan) : item.maxH;
  const safeMaxW = Math.max(minW, maxW);
  const safeMaxH = Math.max(minH, maxH);

  const allowedW = DASHBOARD_ALLOWED_COL_SPANS[breakpoint];
  const allowedH = DASHBOARD_ALLOWED_ROW_SPANS;
  const cols = DASHBOARD_COLUMNS[breakpoint];
  const maxByBreakpoint = Math.min(safeMaxW, cols, allowedW[allowedW.length - 1] ?? cols);

  let nextW = Math.max(minW, Math.min(maxByBreakpoint, w));
  if (!allowedW.includes(nextW)) {
    nextW = [...allowedW]
      .sort((a, b) => a - b)
      .find((value) => value >= nextW) ?? allowedW[allowedW.length - 1] ?? 1;
  }

  let nextH = Math.max(minH, Math.min(safeMaxH, h));
  if (!allowedH.includes(nextH)) {
    nextH = [...allowedH]
      .sort((a, b) => a - b)
      .find((value) => value >= nextH) ?? allowedH[allowedH.length - 1] ?? 1;
  }

  return { w: nextW, h: nextH };
}

export type BreakpointLayoutInput = {
  key: DashboardWidgetKey;
  x: number;
  y: number;
  w: number;
  h: number;
};

function overlaps(
  a: Pick<BreakpointLayoutInput, 'x' | 'y' | 'w' | 'h'>,
  b: Pick<BreakpointLayoutInput, 'x' | 'y' | 'w' | 'h'>,
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function sanitizeRect(
  item: BreakpointLayoutInput,
  breakpoint: DashboardWidgetBreakpoint,
): BreakpointLayoutInput {
  const cols = DASHBOARD_COLUMNS[breakpoint];
  const clamped = clampLayoutSize(item.key, breakpoint, item.w, item.h);
  const maxX = Math.max(0, cols - clamped.w);
  return {
    key: item.key,
    x: Math.min(maxX, Math.max(0, Math.round(item.x))),
    y: Math.max(0, Math.round(item.y)),
    w: clamped.w,
    h: clamped.h,
  };
}

export type NormalizeBreakpointLayoutOptions = {
  /**
   * Quando true (padrao), compacta tudo para o topo apos resolver colisoes.
   * Use false ao posicionar manualmente no editor (celula clicada) para preservar y.
   */
  compactToTop?: boolean;
};

export function normalizeBreakpointLayout(
  breakpoint: DashboardWidgetBreakpoint,
  entries: BreakpointLayoutInput[],
  options: NormalizeBreakpointLayoutOptions = {},
): BreakpointLayoutInput[] {
  const compactToTop = options.compactToTop ?? true;

  const sanitized = entries
    .map((entry) => sanitizeRect(entry, breakpoint))
    .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));

  const placed: BreakpointLayoutInput[] = [];

  for (const entry of sanitized) {
    const candidate = { ...entry };
    let guard = 0;
    while (guard < 500) {
      const collision = placed.find((placedItem) => overlaps(candidate, placedItem));
      if (!collision) break;
      candidate.y = collision.y + collision.h;
      guard += 1;
    }
    placed.push(candidate);
  }

  if (!compactToTop) {
    return placed;
  }

  const compacted: BreakpointLayoutInput[] = [];
  for (const entry of placed.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y))) {
    const candidate = { ...entry, y: 0 };
    let guard = 0;
    while (guard < 500) {
      const collision = compacted.find((placedItem) => overlaps(candidate, placedItem));
      if (!collision) break;
      candidate.y = collision.y + collision.h;
      guard += 1;
    }
    compacted.push(candidate);
  }

  return compacted;
}

export function getNextRowStart(
  entries: BreakpointLayoutInput[],
): number {
  return entries.reduce((max, entry) => Math.max(max, entry.y + entry.h), 0);
}

export type PlaceAtSlotOptions = {
  colSpan?: number;
  rowSpan?: number;
};

export function placeAtSlot(
  breakpoint: DashboardWidgetBreakpoint,
  entries: BreakpointLayoutInput[],
  key: DashboardWidgetKey,
  x: number,
  y: number,
  options: PlaceAtSlotOptions = {},
): BreakpointLayoutInput[] {
  const existingWithoutKey = entries.filter((entry) => entry.key !== key);
  const current = entries.find((entry) => entry.key === key);
  const w = options.colSpan ?? current?.w ?? 1;
  const h = options.rowSpan ?? current?.h ?? 1;
  const target = sanitizeRect(
    {
      key,
      x,
      y,
      w,
      h,
    },
    breakpoint,
  );
  const placed = [...existingWithoutKey];

  let nextY = target.y;
  let guard = 0;
  while (guard < 500) {
    const candidate = { ...target, y: nextY };
    const collision = placed.find((entry) => overlaps(candidate, entry));
    if (!collision) {
      placed.push(candidate);
      break;
    }
    nextY = collision.y + collision.h;
    guard += 1;
  }

  return normalizeBreakpointLayout(breakpoint, placed, { compactToTop: false });
}

export type WidgetEditorMoveDirection = 'left' | 'right' | 'up' | 'down';

function layoutPairwiseNonOverlapping(
  cols: number,
  items: BreakpointLayoutInput[],
): boolean {
  for (const e of items) {
    if (e.x < 0 || e.y < 0 || e.x + e.w > cols) return false;
  }
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (overlaps(items[i], items[j])) return false;
    }
  }
  return true;
}

/**
 * Tenta mover um widget uma celula (esquerda/direita/cima/baixo).
 * Se o destino estiver livre, move sem sobrepor.
 * Se colidir com exatamente um outro widget, tenta:
 * 1) troca de ancora (x,y) entre os dois;
 * 2) na mesma linha/coluna, troca em "segmento" (reordenar blocos sem mudar larguras/alturas),
 *    ex.: 1 coluna a esquerda de 2 colunas passa a ficar a direita do bloco maior.
 * Retorna null se o movimento for invalido ou ambiguo.
 */
export function tryMoveWidgetLayout(
  breakpoint: DashboardWidgetBreakpoint,
  entries: BreakpointLayoutInput[],
  key: DashboardWidgetKey,
  direction: WidgetEditorMoveDirection,
): BreakpointLayoutInput[] | null {
  const self = entries.find((e) => e.key === key);
  if (!self) return null;

  const cols = DASHBOARD_COLUMNS[breakpoint];
  const others = entries.filter((e) => e.key !== key);

  let nx = self.x;
  let ny = self.y;
  if (direction === 'left') nx -= 1;
  else if (direction === 'right') nx += 1;
  else if (direction === 'up') ny -= 1;
  else ny += 1;

  if (nx < 0 || nx + self.w > cols) return null;
  if (ny < 0) return null;

  const moved: BreakpointLayoutInput = {
    key: self.key,
    x: nx,
    y: ny,
    w: self.w,
    h: self.h,
  };
  const clamped = sanitizeRect(moved, breakpoint);
  if (clamped.w !== self.w || clamped.h !== self.h) return null;
  if (clamped.x < 0 || clamped.x + clamped.w > cols) return null;
  if (clamped.y < 0) return null;

  const overlapping = others.filter((o) => overlaps(clamped, o));
  if (overlapping.length === 0) {
    return [...others, clamped];
  }
  if (overlapping.length > 1) {
    return null;
  }

  const other = overlapping[0];
  const rest = others.filter((o) => o.key !== other.key);

  const swappedOther = sanitizeRect(
    { ...other, x: self.x, y: self.y },
    breakpoint,
  );
  if (
    swappedOther.w === other.w &&
    swappedOther.h === other.h &&
    swappedOther.x >= 0 &&
    swappedOther.y >= 0 &&
    swappedOther.x + swappedOther.w <= cols
  ) {
    const anchorSwap = [...rest, clamped, swappedOther];
    if (layoutPairwiseNonOverlapping(cols, anchorSwap)) {
      return anchorSwap;
    }
  }

  /** Troca em linha/coluna quando os blocos estao lado a lado (sem contencao parcial). */
  let segmentSelf: BreakpointLayoutInput | null = null;
  let segmentOther: BreakpointLayoutInput | null = null;

  if (
    direction === 'right' &&
    self.h === other.h &&
    self.y === other.y &&
    other.x >= self.x + self.w
  ) {
    segmentOther = sanitizeRect(
      { ...other, x: self.x, y: self.y },
      breakpoint,
    );
    segmentSelf = sanitizeRect(
      { ...self, x: other.x + other.w - self.w, y: self.y },
      breakpoint,
    );
  } else if (
    direction === 'left' &&
    self.h === other.h &&
    self.y === other.y &&
    other.x + other.w <= self.x
  ) {
    segmentSelf = clamped;
    segmentOther = sanitizeRect(
      { ...other, x: self.x + self.w, y: self.y },
      breakpoint,
    );
  } else if (
    direction === 'down' &&
    self.w === other.w &&
    self.x === other.x &&
    other.y >= self.y + self.h
  ) {
    segmentOther = sanitizeRect(
      { ...other, x: self.x, y: self.y },
      breakpoint,
    );
    segmentSelf = sanitizeRect(
      { ...self, x: self.x, y: other.y + other.h - self.h },
      breakpoint,
    );
  } else if (
    direction === 'up' &&
    self.w === other.w &&
    self.x === other.x &&
    other.y + other.h <= self.y
  ) {
    segmentSelf = clamped;
    segmentOther = sanitizeRect(
      { ...other, x: self.x, y: self.y + self.h },
      breakpoint,
    );
  }

  if (segmentSelf && segmentOther) {
    if (
      segmentSelf.w === self.w &&
      segmentSelf.h === self.h &&
      segmentOther.w === other.w &&
      segmentOther.h === other.h
    ) {
      const segmentSwap = [...rest, segmentSelf, segmentOther];
      if (layoutPairwiseNonOverlapping(cols, segmentSwap)) {
        return segmentSwap;
      }
    }
  }

  return null;
}
