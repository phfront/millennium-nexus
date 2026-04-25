'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { Button, Card, EmptyState, Modal, Skeleton } from '@phfront/millennium-ui';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Plus,
  Save,
  Smartphone,
  Tablet,
  Monitor,
  Trash2,
} from 'lucide-react';
import {
  DASHBOARD_COLUMNS,
  DASHBOARD_WIDGET_BY_KEY,
  DASHBOARD_WIDGET_CATALOG,
  type DashboardWidgetKey,
} from '@/lib/widgets/catalog';
import {
  DASHBOARD_ALLOWED_COL_SPANS,
  DASHBOARD_ALLOWED_ROW_SPANS,
  DASHBOARD_EDITOR_MAX_WIDTH,
  DASHBOARD_GRID_MARGIN,
  DASHBOARD_GRID_ROW_HEIGHT,
} from '@/lib/widgets/grid-config';
import type { DashboardWidgetBreakpoint } from '@/types/database';
import {
  clampLayoutSize,
  normalizeBreakpointLayout,
  tryMoveWidgetLayout,
  type BreakpointLayoutInput,
} from '@/lib/widgets/layout';
import { useDashboardWidgets } from '@/hooks/widgets/use-dashboard-widgets';
import { useActiveBreakpoint } from '@/hooks/ui/use-active-breakpoint';

type WidgetEditorProps = {
  allowedModuleSlugs: string[];
};

const BREAKPOINT_LABELS: Record<DashboardWidgetBreakpoint, string> = {
  lg: 'Desktop',
  md: 'Tablet',
  sm: 'Mobile',
};

const BREAKPOINT_ICONS: Record<DashboardWidgetBreakpoint, ComponentType<{ className?: string }>> = {
  lg: Monitor,
  md: Tablet,
  sm: Smartphone,
};

const BREAKPOINT_RANK: Record<DashboardWidgetBreakpoint, number> = {
  sm: 1,
  md: 2,
  lg: 3,
};

export function WidgetEditor({ allowedModuleSlugs }: WidgetEditorProps) {
  const viewportBreakpoint = useActiveBreakpoint();
  const [breakpoint, setBreakpoint] = useState<DashboardWidgetBreakpoint>('lg');
  const [isAddWidgetModalOpen, setIsAddWidgetModalOpen] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<{ x: number; y: number } | null>(null);
  const [extraRowsByBreakpoint, setExtraRowsByBreakpoint] = useState<Record<DashboardWidgetBreakpoint, number>>({
    lg: 0,
    md: 0,
    sm: 0,
  });
  const {
    isLoading,
    isSaving,
    error,
    prefs,
    visibility,
    layouts,
    setWidgetVisibility,
    setWidgetSpan,
    addWidget,
    placeWidgetAtSlot,
    moveWidget,
  } = useDashboardWidgets({ allowedModuleSlugs });

  const selectableBreakpoints = useMemo(
    () =>
      (['lg', 'md', 'sm'] as DashboardWidgetBreakpoint[]).filter(
        (bp) => BREAKPOINT_RANK[bp] <= BREAKPOINT_RANK[viewportBreakpoint],
      ),
    [viewportBreakpoint],
  );

  useEffect(() => {
    if (!selectableBreakpoints.includes(breakpoint)) {
      setBreakpoint(selectableBreakpoints[0] ?? 'sm');
    }
  }, [breakpoint, selectableBreakpoints]);

  /** Mesmo critério que `placeWidgetAtSlot` / `moveWidget` no hook (layouts visíveis neste breakpoint). */
  const bpLayoutEntries = useMemo((): BreakpointLayoutInput[] => {
    return Object.entries(layouts[breakpoint])
      .filter(([entryKey]) => Boolean(visibility[breakpoint][entryKey as DashboardWidgetKey]))
      .map(([entryKey, row]) => ({
        key: entryKey as DashboardWidgetKey,
        x: row.x,
        y: row.y,
        w: row.w,
        h: row.h,
      }));
  }, [breakpoint, layouts, visibility]);

  /** Compactar para o topo como na home — evita `y` com "buracos" e desalinhamento no CSS Grid. */
  const packedLayoutEntries = useMemo(
    () => normalizeBreakpointLayout(breakpoint, bpLayoutEntries, { compactToTop: true }),
    [breakpoint, bpLayoutEntries],
  );

  const visibleItems = useMemo(() => {
    const cols = DASHBOARD_COLUMNS[breakpoint];
    const items = packedLayoutEntries
      .filter((entry) => prefs[entry.key])
      .map((entry) => {
        const item = DASHBOARD_WIDGET_BY_KEY.get(entry.key);
        if (!item) return null;
        const w = Math.max(item.minW, Math.min(item.maxW, Math.min(cols, entry.w)));
        const h = Math.max(item.minH, Math.min(item.maxH, entry.h));
        const x = Math.min(Math.max(0, entry.x), Math.max(0, cols - w));
        const y = Math.max(0, entry.y);
        return { key: entry.key, x, y, w, h, item };
      })
      .filter(Boolean) as Array<{
      key: DashboardWidgetKey;
      x: number;
      y: number;
      w: number;
      h: number;
      item: NonNullable<ReturnType<typeof DASHBOARD_WIDGET_BY_KEY.get>>;
    }>;
    return items.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
  }, [breakpoint, packedLayoutEntries, prefs]);

  const occupiedBottom = useMemo(
    () => visibleItems.reduce((max, item) => Math.max(max, item.y + item.h), 0),
    [visibleItems],
  );
  const baseTemplateRows = Math.max(1, occupiedBottom + 1);
  const totalRows = baseTemplateRows + extraRowsByBreakpoint[breakpoint];

  const slots = useMemo(() => {
    const cols = DASHBOARD_COLUMNS[breakpoint];
    const matrix = Array.from({ length: totalRows }, () =>
      Array.from({ length: cols }, () => ({ occupied: false })),
    );
    for (const widget of visibleItems) {
      for (let row = widget.y; row < widget.y + widget.h; row += 1) {
        if (row >= totalRows) continue;
        for (let col = widget.x; col < widget.x + widget.w; col += 1) {
          if (col >= cols) continue;
          matrix[row][col].occupied = true;
        }
      }
    }
    return matrix;
  }, [breakpoint, totalRows, visibleItems]);

  const hiddenWidgets = useMemo(() => {
    return DASHBOARD_WIDGET_CATALOG.filter((item) => {
      if (!allowedModuleSlugs.includes(item.moduleSlug)) return false;
      return !visibility[breakpoint][item.key];
    });
  }, [allowedModuleSlugs, breakpoint, visibility]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton variant="block" className="h-20 w-full" />
        <Skeleton variant="block" className="h-44 w-full" />
        <Skeleton variant="block" className="h-44 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-text-primary">Editar Widgets</h1>
          <p className="text-sm text-text-muted">
            Adicione, reordene e redimensione sua home.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="outline">Voltar</Button>
          </Link>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() =>
              setExtraRowsByBreakpoint((prev) => ({
                ...prev,
                [breakpoint]: prev[breakpoint] + 1,
              }))
            }
          >
            Adicionar linha
          </Button>
          <Button variant="ghost" disabled className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Salvando...' : 'Salvo'}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {selectableBreakpoints.map((bp) => {
          const Icon = BREAKPOINT_ICONS[bp];
          const active = bp === breakpoint;
          return (
            <Button
              key={bp}
              onClick={() => setBreakpoint(bp)}
              variant={active ? undefined : 'outline'}
              className="min-h-11"
              leftIcon={<Icon className="h-4 w-4" />}
            >
              {BREAKPOINT_LABELS[bp]}
            </Button>
          );
        })}
      </div>

      {error ? (
        <EmptyState className="py-8" title="Erro ao salvar widgets" description={error} />
      ) : null}

      <div
        className={[
          'widget-editor-grid rounded-xl border border-border p-2',
          breakpoint === 'lg' ? 'w-full max-w-none' : 'mx-auto w-full',
        ].join(' ')}
        style={breakpoint === 'lg' ? undefined : { maxWidth: DASHBOARD_EDITOR_MAX_WIDTH[breakpoint] }}
      >
        <div
          className="relative"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${DASHBOARD_COLUMNS[breakpoint]}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${totalRows}, ${DASHBOARD_GRID_ROW_HEIGHT}px)`,
            gap: `${DASHBOARD_GRID_MARGIN[1]}px ${DASHBOARD_GRID_MARGIN[0]}px`,
          }}
        >
          {slots.map((row, rowIndex) =>
            row.map((slot, colIndex) => (
              <button
                key={`slot-${rowIndex}-${colIndex}`}
                type="button"
                disabled={slot.occupied}
                onClick={() => {
                  setPendingSlot({ x: colIndex, y: rowIndex });
                  setIsAddWidgetModalOpen(true);
                }}
                className={[
                  'rounded-lg border border-dashed transition-colors',
                  slot.occupied
                    ? 'border-transparent bg-transparent'
                    : 'border-border bg-surface-2/40 hover:border-brand-primary/60 hover:bg-surface-2/70 cursor-pointer',
                ].join(' ')}
                style={{
                  gridColumn: `${colIndex + 1} / span 1`,
                  gridRow: `${rowIndex + 1} / span 1`,
                }}
                aria-label={`Slot ${rowIndex + 1}-${colIndex + 1}`}
              />
            )),
          )}

            {visibleItems.map((widget) => {
              const colOptions = DASHBOARD_ALLOWED_COL_SPANS[breakpoint];
              const rowOptions = DASHBOARD_ALLOWED_ROW_SPANS;
              const minColsInSlot = clampLayoutSize(widget.key, breakpoint, 1, widget.h).w;
              const minRowsInSlot = clampLayoutSize(widget.key, breakpoint, widget.w, 1).h;
              const nextColUp = colOptions.find((value) => value > widget.w) ?? widget.w;
              const nextColDown = [...colOptions].reverse().find((value) => value < widget.w) ?? widget.w;
              const nextRowUp = rowOptions.find((value) => value > widget.h) ?? widget.h;
              const nextRowDown = [...rowOptions].reverse().find((value) => value < widget.h) ?? widget.h;

              return (
              <div
                key={widget.key}
                style={{
                  gridColumn: `${widget.x + 1} / span ${widget.w}`,
                  gridRow: `${widget.y + 1} / span ${widget.h}`,
                }}
              >
                <Card className="relative flex h-full flex-col overflow-hidden p-3">
                  {/* Header: title + remove */}
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 pr-1">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {widget.item.title}
                      </p>
                      <p className="truncate text-xs text-text-muted">
                        {widget.item.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remover ${widget.item.title}`}
                      title="Remover"
                      onClick={() => void setWidgetVisibility(widget.key, breakpoint, false)}
                      className="-mt-1 -mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Single horizontal control row:
                      [<<]  [- W +]  [↑/↓ d-pad]  [- H +]  [>>] */}
                  {(() => {
                    const upDisabled =
                      tryMoveWidgetLayout(breakpoint, packedLayoutEntries, widget.key, 'up') === null;
                    const downDisabled =
                      tryMoveWidgetLayout(breakpoint, packedLayoutEntries, widget.key, 'down') === null;
                    const leftDisabled =
                      tryMoveWidgetLayout(breakpoint, packedLayoutEntries, widget.key, 'left') === null;
                    const rightDisabled =
                      tryMoveWidgetLayout(breakpoint, packedLayoutEntries, widget.key, 'right') === null;
                    const edgeBtn =
                      'flex h-12 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-surface-2 text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-2';
                    const dpadBtn =
                      'flex h-7 w-9 cursor-pointer items-center justify-center rounded-md border border-border bg-surface-2 text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-2';
                    const stepperBtn =
                      'flex h-8 w-7 cursor-pointer items-center justify-center text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

                    return (
                      <div className="flex h-full flex-col justify-between items-center gap-1.5 pt-1">
                        {/* Top: up arrow */}
                        <button
                          type="button"
                          aria-label="Mover para cima"
                          disabled={upDisabled}
                          onClick={() => void moveWidget(widget.key, breakpoint, 'up')}
                          className={dpadBtn}
                        >
                          <ChevronUp size={14} />
                        </button>

                        {/* Middle: left edge | stacked W/H steppers | right edge */}
                        <div className="flex w-full items-center justify-between gap-2">
                          <button
                            type="button"
                            aria-label="Mover para a esquerda"
                            disabled={leftDisabled}
                            onClick={() => void moveWidget(widget.key, breakpoint, 'left')}
                            className={edgeBtn}
                          >
                            <ChevronLeft size={18} />
                          </button>

                          <div className="flex flex-col items-center gap-1.5">
                            {/* Width stepper */}
                            <div className="inline-flex items-center overflow-hidden rounded-md border border-border bg-surface-2">
                              <button
                                type="button"
                                aria-label="Diminuir largura"
                                disabled={nextColDown === widget.w || nextColDown < minColsInSlot}
                                onClick={() =>
                                  void setWidgetSpan(widget.key, breakpoint, nextColDown, widget.h)
                                }
                                className={stepperBtn}
                              >
                                <span aria-hidden>−</span>
                              </button>
                              <span
                                className="border-x border-border py-1 text-center text-xs font-medium tabular-nums text-text-primary"
                                style={{ width: '80px' }}
                              >
                                {widget.w} {widget.w === 1 ? 'Coluna' : 'Colunas'}
                              </span>
                              <button
                                type="button"
                                aria-label="Aumentar largura"
                                disabled={nextColUp === widget.w}
                                onClick={() =>
                                  void setWidgetSpan(widget.key, breakpoint, nextColUp, widget.h)
                                }
                                className={stepperBtn}
                              >
                                <span aria-hidden>+</span>
                              </button>
                            </div>

                            {/* Height stepper */}
                            <div className="inline-flex items-center overflow-hidden rounded-md border border-border bg-surface-2">
                              <button
                                type="button"
                                aria-label="Diminuir altura"
                                disabled={nextRowDown === widget.h || nextRowDown < minRowsInSlot}
                                onClick={() =>
                                  void setWidgetSpan(widget.key, breakpoint, widget.w, nextRowDown)
                                }
                                className={stepperBtn}
                              >
                                <span aria-hidden>−</span>
                              </button>
                              <span
                                className="border-x border-border py-1 text-center text-xs font-medium tabular-nums text-text-primary"
                                style={{ width: '80px' }}
                              >
                                {widget.h} {widget.h === 1 ? 'Linha' : 'Linhas'}
                              </span>
                              <button
                                type="button"
                                aria-label="Aumentar altura"
                                disabled={nextRowUp === widget.h}
                                onClick={() =>
                                  void setWidgetSpan(widget.key, breakpoint, widget.w, nextRowUp)
                                }
                                className={stepperBtn}
                              >
                                <span aria-hidden>+</span>
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            aria-label="Mover para a direita"
                            disabled={rightDisabled}
                            onClick={() => void moveWidget(widget.key, breakpoint, 'right')}
                            className={edgeBtn}
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>

                        {/* Bottom: down arrow */}
                        <button
                          type="button"
                          aria-label="Mover para baixo"
                          disabled={downDisabled}
                          onClick={() => void moveWidget(widget.key, breakpoint, 'down')}
                          className={dpadBtn}
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    );
                  })()}
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        isOpen={isAddWidgetModalOpen}
        onClose={() => setIsAddWidgetModalOpen(false)}
        title="Adicionar Widgets"
        size="lg"
      >
        {hiddenWidgets.length === 0 ? (
          <p className="text-sm text-text-muted">Todos os widgets disponiveis ja estao ativos.</p>
        ) : (
          <div className="space-y-2">
            {hiddenWidgets.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary font-medium">{item.title}</p>
                  <p className="text-xs text-text-muted">{item.description}</p>
                </div>
                <Button
                  variant="outline"
                  className="min-h-11"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={async () => {
                    await addWidget(item.key, breakpoint);
                    if (pendingSlot) {
                      await placeWidgetAtSlot(item.key, breakpoint, pendingSlot.x, pendingSlot.y, {
                        colSpan: 1,
                        rowSpan: 1,
                      });
                    }
                    setPendingSlot(null);
                    setIsAddWidgetModalOpen(false);
                  }}
                >
                  Adicionar
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
