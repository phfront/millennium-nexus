'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/user-store';
import {
  DASHBOARD_BREAKPOINTS,
  DASHBOARD_COLUMNS,
  DASHBOARD_WIDGET_CATALOG,
  DASHBOARD_WIDGET_BY_KEY,
  type DashboardWidgetKey,
} from '@/lib/widgets/catalog';
import {
  buildDefaultWidgetLayouts,
  buildDefaultWidgetPrefs,
  clampLayoutSize,
  getNextRowStart,
  normalizeWidgetLayouts,
  normalizeBreakpointLayout,
  placeAtSlot,
  tryMoveWidgetLayout,
  type WidgetLayoutByBreakpoint,
  type BreakpointLayoutInput,
  type PlaceAtSlotOptions,
} from '@/lib/widgets/layout';
import {
  createDashboardWidgetsBroadcastChannel,
  DASHBOARD_WIDGETS_UPDATED_EVENT,
  type DashboardWidgetsBroadcastMessage,
} from '@/lib/widgets/broadcast';
import type {
  DashboardWidgetBreakpoint,
  UserDashboardWidget,
  UserDashboardWidgetLayout,
  UserDashboardWidgetVisibility,
} from '@/types/database';

type WidgetPrefsMap = Record<DashboardWidgetKey, UserDashboardWidget>;
type WidgetVisibilityByBreakpoint = Record<
  DashboardWidgetBreakpoint,
  Partial<Record<DashboardWidgetKey, boolean>>
>;

function visibleLayoutEntriesForBreakpoint(
  breakpoint: DashboardWidgetBreakpoint,
  layouts: WidgetLayoutByBreakpoint,
  visibility: WidgetVisibilityByBreakpoint,
): BreakpointLayoutInput[] {
  return Object.entries(layouts[breakpoint])
    .filter(([entryKey]) =>
      Boolean(visibility[breakpoint][entryKey as DashboardWidgetKey]),
    )
    .map(([entryKey, row]) => ({
      key: entryKey as DashboardWidgetKey,
      x: row.x,
      y: row.y,
      w: row.w,
      h: row.h,
    }));
}

type UseDashboardWidgetsOptions = {
  allowedModuleSlugs: string[];
};

export function useDashboardWidgets({ allowedModuleSlugs }: UseDashboardWidgetsOptions) {
  const user = useUserStore((s) => s.user);
  const [prefs, setPrefs] = useState<WidgetPrefsMap>({} as WidgetPrefsMap);
  const [visibility, setVisibility] = useState<WidgetVisibilityByBreakpoint>({
    lg: {},
    md: {},
    sm: {},
  });
  const [layouts, setLayouts] = useState<WidgetLayoutByBreakpoint>({
    lg: {} as WidgetLayoutByBreakpoint['lg'],
    md: {} as WidgetLayoutByBreakpoint['md'],
    sm: {} as WidgetLayoutByBreakpoint['sm'],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowedSet = useMemo(() => new Set(allowedModuleSlugs), [allowedModuleSlugs]);

  const publishWidgetsUpdated = useCallback(() => {
    if (!user) return;
    const channel = createDashboardWidgetsBroadcastChannel();
    if (!channel) return;
    const payload: DashboardWidgetsBroadcastMessage = {
      type: DASHBOARD_WIDGETS_UPDATED_EVENT,
      userId: user.id,
      at: Date.now(),
    };
    channel.postMessage(payload);
    channel.close();
  }, [user]);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const supabase = createClient();

    const [
      { data: prefRows, error: prefErr },
      { data: layoutRows, error: layoutErr },
      { data: visibilityRows, error: visibilityErr },
    ] = await Promise.all([
      supabase.from('user_dashboard_widgets').select('*').eq('user_id', user.id),
      supabase.from('user_dashboard_widget_layouts').select('*').eq('user_id', user.id),
      supabase.from('user_dashboard_widget_visibility').select('*').eq('user_id', user.id),
    ]);

    if (prefErr || layoutErr || visibilityErr) {
      setError(prefErr?.message ?? layoutErr?.message ?? visibilityErr?.message ?? 'Falha ao carregar widgets');
      setIsLoading(false);
      return;
    }

    let nextPrefs = (prefRows ?? []) as UserDashboardWidget[];
    let nextLayouts = (layoutRows ?? []) as UserDashboardWidgetLayout[];
    let nextVisibility = (visibilityRows ?? []) as UserDashboardWidgetVisibility[];

    if (nextPrefs.length === 0) {
      const defaults = buildDefaultWidgetPrefs(user.id, allowedSet);
      if (defaults.length > 0) {
        const { data: insertedPrefs, error: insertErr } = await supabase
          .from('user_dashboard_widgets')
          .upsert(defaults, { onConflict: 'user_id,widget_key' })
          .select('*');
        if (insertErr) {
          setError(insertErr.message);
          setIsLoading(false);
          return;
        }
        nextPrefs = (insertedPrefs ?? defaults) as UserDashboardWidget[];
      }
    }
    const allowedWidgetKeys = DASHBOARD_WIDGET_CATALOG
      .filter((item) => allowedSet.has(item.moduleSlug))
      .map((item) => item.key);

    const existingPrefKeys = new Set(nextPrefs.map((row) => row.widget_key as DashboardWidgetKey));
    const missingPrefKeys = allowedWidgetKeys.filter((key) => !existingPrefKeys.has(key));
    if (missingPrefKeys.length > 0) {
      const defaults = buildDefaultWidgetPrefs(user.id, allowedSet).filter((row) =>
        missingPrefKeys.includes(row.widget_key as DashboardWidgetKey),
      );
      if (defaults.length > 0) {
        const { data: insertedPrefs, error: insertErr } = await supabase
          .from('user_dashboard_widgets')
          .upsert(defaults, { onConflict: 'user_id,widget_key' })
          .select('*');
        if (insertErr) {
          setError(insertErr.message);
          setIsLoading(false);
          return;
        }
        nextPrefs = [
          ...nextPrefs,
          ...((insertedPrefs ?? defaults) as UserDashboardWidget[]),
        ];
      }
    }

    if (nextLayouts.length === 0 && nextPrefs.length > 0) {
      const defaults = buildDefaultWidgetLayouts(user.id, allowedSet);
      if (defaults.length > 0) {
        const { data: insertedLayouts, error: insertErr } = await supabase
          .from('user_dashboard_widget_layouts')
          .upsert(defaults, { onConflict: 'user_id,widget_key,breakpoint' })
          .select('*');
        if (insertErr) {
          setError(insertErr.message);
          setIsLoading(false);
          return;
        }
        nextLayouts = (insertedLayouts ?? defaults) as UserDashboardWidgetLayout[];
      }
    }
    const existingLayoutKeyByBp = new Set(
      nextLayouts.map((row) => `${row.widget_key}:${row.breakpoint}`),
    );
    const defaultLayouts = buildDefaultWidgetLayouts(user.id, allowedSet);
    const missingLayouts = defaultLayouts.filter(
      (row) => !existingLayoutKeyByBp.has(`${row.widget_key}:${row.breakpoint}`),
    );
    if (missingLayouts.length > 0) {
      const { data: insertedLayouts, error: insertErr } = await supabase
        .from('user_dashboard_widget_layouts')
        .upsert(missingLayouts, { onConflict: 'user_id,widget_key,breakpoint' })
        .select('*');
      if (insertErr) {
        setError(insertErr.message);
        setIsLoading(false);
        return;
      }
      nextLayouts = [
        ...nextLayouts,
        ...((insertedLayouts ?? missingLayouts) as UserDashboardWidgetLayout[]),
      ];
    }
    const sanitizedByBreakpoint: Record<DashboardWidgetBreakpoint, BreakpointLayoutInput[]> = {
      lg: [],
      md: [],
      sm: [],
    };
    for (const row of nextLayouts) {
      const key = row.widget_key as DashboardWidgetKey;
      const item = DASHBOARD_WIDGET_BY_KEY.get(key);
      if (!item) continue;
      if (!allowedSet.has(item.moduleSlug)) continue;

      sanitizedByBreakpoint[row.breakpoint].push({
        key,
        x: row.x,
        y: row.y,
        w: row.w,
        h: row.h,
      });
    }

    const sanitizedLayoutsByBp: Record<DashboardWidgetBreakpoint, BreakpointLayoutInput[]> = {
      lg: normalizeBreakpointLayout('lg', sanitizedByBreakpoint.lg),
      md: normalizeBreakpointLayout('md', sanitizedByBreakpoint.md),
      sm: normalizeBreakpointLayout('sm', sanitizedByBreakpoint.sm),
    };
    const sanitizedLayouts: UserDashboardWidgetLayout[] = (
      ['lg', 'md', 'sm'] as DashboardWidgetBreakpoint[]
    ).flatMap((bp) =>
      sanitizedLayoutsByBp[bp].map((row) => ({
        user_id: user.id,
        widget_key: row.key,
        breakpoint: bp,
        x: row.x,
        y: row.y,
        w: row.w,
        h: row.h,
        unit_scale: 2,
        updated_at: new Date().toISOString(),
      })),
    );
    const sanitizedToPersist: UserDashboardWidgetLayout[] = sanitizedLayouts.filter((row) => {
      const original = nextLayouts.find(
        (o) =>
          o.user_id === row.user_id &&
          o.widget_key === row.widget_key &&
          o.breakpoint === row.breakpoint,
      );
      if (!original) return true;
      return row.x !== original.x || row.y !== original.y || row.w !== original.w || row.h !== original.h;
    });

    if (sanitizedToPersist.length > 0) {
      const { error: sanitizeErr } = await supabase
        .from('user_dashboard_widget_layouts')
        .upsert(sanitizedToPersist, { onConflict: 'user_id,widget_key,breakpoint' });
      if (sanitizeErr) {
        setError(sanitizeErr.message);
        setIsLoading(false);
        return;
      }
    }
    nextLayouts = sanitizedLayouts;
    const existingVisibilityKeys = new Set(
      nextVisibility.map((row) => `${row.widget_key}:${row.breakpoint}`),
    );
    const visibilityDefaults = allowedWidgetKeys.flatMap((key) =>
      DASHBOARD_BREAKPOINTS.map((breakpoint) => ({
        user_id: user.id,
        widget_key: key,
        breakpoint,
        is_visible: true,
        updated_at: new Date().toISOString(),
      })),
    );
    const missingVisibility = visibilityDefaults.filter(
      (row) => !existingVisibilityKeys.has(`${row.widget_key}:${row.breakpoint}`),
    );
    if (missingVisibility.length > 0) {
      const { data: insertedVisibility, error: insertErr } = await supabase
        .from('user_dashboard_widget_visibility')
        .upsert(missingVisibility, { onConflict: 'user_id,widget_key,breakpoint' })
        .select('*');
      if (insertErr) {
        setError(insertErr.message);
        setIsLoading(false);
        return;
      }
      nextVisibility = [
        ...nextVisibility,
        ...((insertedVisibility ?? missingVisibility) as UserDashboardWidgetVisibility[]),
      ];
    }

    const prefMap = {} as WidgetPrefsMap;
    for (const pref of nextPrefs) {
      const key = pref.widget_key as DashboardWidgetKey;
      const item = DASHBOARD_WIDGET_BY_KEY.get(key);
      if (!item) continue;
      if (!allowedSet.has(item.moduleSlug)) continue;
      prefMap[key] = pref;
    }

    setPrefs(prefMap);
    setLayouts(normalizeWidgetLayouts(nextLayouts));
    const visibilityMap: WidgetVisibilityByBreakpoint = { lg: {}, md: {}, sm: {} };
    for (const row of nextVisibility) {
      const key = row.widget_key as DashboardWidgetKey;
      const item = DASHBOARD_WIDGET_BY_KEY.get(key);
      if (!item) continue;
      if (!allowedSet.has(item.moduleSlug)) continue;
      visibilityMap[row.breakpoint][key] = row.is_visible;
    }
    setVisibility(visibilityMap);
    setIsLoading(false);
  }, [allowedSet, user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const savePrefs = useCallback(
    async (entries: UserDashboardWidget[]) => {
      if (!user || entries.length === 0) return;
      setIsSaving(true);
      const supabase = createClient();
      const { error: saveErr } = await supabase
        .from('user_dashboard_widgets')
        .upsert(entries, { onConflict: 'user_id,widget_key' });
      if (saveErr) setError(saveErr.message);
      else publishWidgetsUpdated();
      setIsSaving(false);
    },
    [publishWidgetsUpdated, user],
  );

  const saveLayouts = useCallback(
    async (entries: UserDashboardWidgetLayout[]) => {
      if (!user || entries.length === 0) return;
      setIsSaving(true);
      const supabase = createClient();
      const { error: saveErr } = await supabase
        .from('user_dashboard_widget_layouts')
        .upsert(entries, { onConflict: 'user_id,widget_key,breakpoint' });
      if (saveErr) setError(saveErr.message);
      else publishWidgetsUpdated();
      setIsSaving(false);
    },
    [publishWidgetsUpdated, user],
  );

  const saveVisibilityRows = useCallback(
    async (rows: UserDashboardWidgetVisibility[]) => {
      if (!user || rows.length === 0) return;
      setIsSaving(true);
      const supabase = createClient();
      const { error: saveErr } = await supabase
        .from('user_dashboard_widget_visibility')
        .upsert(rows, { onConflict: 'user_id,widget_key,breakpoint' });
      if (saveErr) setError(saveErr.message);
      else publishWidgetsUpdated();
      setIsSaving(false);
    },
    [publishWidgetsUpdated, user],
  );

  const setWidgetVisibility = useCallback(
    async (key: DashboardWidgetKey, breakpoint: DashboardWidgetBreakpoint, isVisible: boolean) => {
      if (!user) return;
      const row: UserDashboardWidgetVisibility = {
        user_id: user.id,
        widget_key: key,
        breakpoint,
        is_visible: isVisible,
        updated_at: new Date().toISOString(),
      };
      setVisibility((prev) => ({
        ...prev,
        [breakpoint]: {
          ...prev[breakpoint],
          [key]: isVisible,
        },
      }));
      await saveVisibilityRows([row]);
    },
    [saveVisibilityRows, user],
  );

  const setWidgetSize = useCallback(
    async (
      key: DashboardWidgetKey,
      breakpoint: DashboardWidgetBreakpoint,
      nextW: number,
      nextH: number,
    ) => {
      if (!user) return;
      const current = layouts[breakpoint][key];
      if (!current) return;

      const clamped = clampLayoutSize(key, breakpoint, nextW, nextH);
      const updated: UserDashboardWidgetLayout = {
        user_id: user.id,
        widget_key: key,
        breakpoint,
        x: current.x,
        y: current.y,
        w: clamped.w,
        h: clamped.h,
        unit_scale: 2,
        updated_at: new Date().toISOString(),
      };

      setLayouts((prev) => ({
        ...prev,
        [breakpoint]: {
          ...prev[breakpoint],
          [key]: { ...prev[breakpoint][key], w: clamped.w, h: clamped.h },
        },
      }));

      await saveLayouts([updated]);
    },
    [layouts, saveLayouts, user],
  );

  const setWidgetSpan = useCallback(
    async (
      key: DashboardWidgetKey,
      breakpoint: DashboardWidgetBreakpoint,
      nextW: number,
      nextH: number,
    ) => {
      if (!user) return;
      const bpEntries = visibleLayoutEntriesForBreakpoint(breakpoint, layouts, visibility);
      const target = bpEntries.find((entry) => entry.key === key);
      if (!target) return;
      const packedBase = normalizeBreakpointLayout(breakpoint, bpEntries, { compactToTop: true });
      const clamped = clampLayoutSize(key, breakpoint, nextW, nextH);
      const normalized = normalizeBreakpointLayout(
        breakpoint,
        packedBase.map((entry) =>
          entry.key === key ? { ...entry, w: clamped.w, h: clamped.h } : entry,
        ),
        { compactToTop: false },
      );
      const normalizedRows: UserDashboardWidgetLayout[] = normalized.map((item) => ({
        user_id: user.id,
        widget_key: item.key,
        breakpoint,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        unit_scale: 2,
        updated_at: new Date().toISOString(),
      }));
      setLayouts((prev) => {
        const next = { ...prev };
        const bp = { ...next[breakpoint] };
        for (const row of normalizedRows) {
          const rowKey = row.widget_key as DashboardWidgetKey;
          bp[rowKey] = { x: row.x, y: row.y, w: row.w, h: row.h };
        }
        next[breakpoint] = bp;
        return next;
      });
      await saveLayouts(normalizedRows);
    },
    [layouts, saveLayouts, user, visibility],
  );

  const moveWidget = useCallback(
    async (
      key: DashboardWidgetKey,
      breakpoint: DashboardWidgetBreakpoint,
      direction: 'left' | 'right' | 'up' | 'down',
    ) => {
      if (!user) return;
      const bpEntries = visibleLayoutEntriesForBreakpoint(breakpoint, layouts, visibility);
      const packedBase = normalizeBreakpointLayout(breakpoint, bpEntries, { compactToTop: true });
      const next = tryMoveWidgetLayout(breakpoint, packedBase, key, direction);
      if (!next) return;
      const packedNext = normalizeBreakpointLayout(breakpoint, next, { compactToTop: true });
      const normalizedRows: UserDashboardWidgetLayout[] = packedNext.map((item) => ({
        user_id: user.id,
        widget_key: item.key,
        breakpoint,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        unit_scale: 2,
        updated_at: new Date().toISOString(),
      }));
      setLayouts((prev) => {
        const n = { ...prev };
        const bp = { ...n[breakpoint] };
        for (const row of normalizedRows) {
          const rowKey = row.widget_key as DashboardWidgetKey;
          bp[rowKey] = { x: row.x, y: row.y, w: row.w, h: row.h };
        }
        n[breakpoint] = bp;
        return n;
      });
      await saveLayouts(normalizedRows);
    },
    [layouts, saveLayouts, user, visibility],
  );

  const placeWidgetAtSlot = useCallback(
    async (
      key: DashboardWidgetKey,
      breakpoint: DashboardWidgetBreakpoint,
      x: number,
      y: number,
      slotOptions?: PlaceAtSlotOptions,
    ) => {
      if (!user) return;
      const bpEntries = visibleLayoutEntriesForBreakpoint(breakpoint, layouts, visibility);
      const packedBase = normalizeBreakpointLayout(breakpoint, bpEntries, { compactToTop: true });
      const normalized = placeAtSlot(breakpoint, packedBase, key, x, y, slotOptions);
      const normalizedRows: UserDashboardWidgetLayout[] = normalized.map((item) => ({
        user_id: user.id,
        widget_key: item.key,
        breakpoint,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        unit_scale: 2,
        updated_at: new Date().toISOString(),
      }));
      setLayouts((prev) => {
        const next = { ...prev };
        const bp = { ...next[breakpoint] };
        for (const row of normalizedRows) {
          const rowKey = row.widget_key as DashboardWidgetKey;
          bp[rowKey] = { x: row.x, y: row.y, w: row.w, h: row.h };
        }
        next[breakpoint] = bp;
        return next;
      });
      await saveLayouts(normalizedRows);
    },
    [layouts, saveLayouts, user, visibility],
  );

  const reorderWidgets = useCallback(
    async (breakpoint: DashboardWidgetBreakpoint, orderedKeys: DashboardWidgetKey[]) => {
      if (!user) return;

      const nextEntries: UserDashboardWidgetLayout[] = [];
      let cursorX = 0;
      let cursorY = 0;
      let rowHeight = 1;

      for (const key of orderedKeys) {
        const current = layouts[breakpoint][key];
        if (!current) continue;

        const cols = DASHBOARD_COLUMNS[breakpoint];
        if (cursorX + current.w > cols) {
          cursorY += rowHeight;
          cursorX = 0;
          rowHeight = 1;
        }

        rowHeight = Math.max(rowHeight, current.h);

        nextEntries.push({
          user_id: user.id,
          widget_key: key,
          breakpoint,
          x: cursorX,
          y: cursorY,
          w: current.w,
          h: current.h,
          unit_scale: 2,
          updated_at: new Date().toISOString(),
        });

        cursorX += current.w;
      }

      setLayouts((prev) => {
        const bpLayout = { ...prev[breakpoint] };
        for (const entry of nextEntries) {
          const key = entry.widget_key as DashboardWidgetKey;
          bpLayout[key] = { x: entry.x, y: entry.y, w: entry.w, h: entry.h };
        }
        return { ...prev, [breakpoint]: bpLayout };
      });

      await saveLayouts(nextEntries);
    },
    [layouts, saveLayouts, user],
  );

  const ensureWidgetInLayouts = useCallback(
    async (key: DashboardWidgetKey) => {
      if (!user) return;
      const existing = DASHBOARD_BREAKPOINTS.every((bp) => Boolean(layouts[bp][key]));
      if (existing) return;

      const item = DASHBOARD_WIDGET_BY_KEY.get(key);
      if (!item) return;

      const now = new Date().toISOString();
      const rowsToInsert: UserDashboardWidgetLayout[] = [];

      for (const bp of DASHBOARD_BREAKPOINTS) {
        if (layouts[bp][key]) continue;

        const { w, h } = clampLayoutSize(key, bp, item.defaultW[bp], item.defaultH[bp]);

        const currentRows = Object.entries(layouts[bp]).map(([entryKey, row]) => ({
          key: entryKey as DashboardWidgetKey,
          x: row.x,
          y: row.y,
          w: row.w,
          h: row.h,
        }));
        const nextY = getNextRowStart(currentRows);

        rowsToInsert.push({
          user_id: user.id,
          widget_key: key,
          breakpoint: bp,
          x: 0,
          y: nextY,
          w,
          h,
          unit_scale: 2,
          updated_at: now,
        });
      }

      if (rowsToInsert.length === 0) return;

      setLayouts((prev) => {
        const next = { ...prev };
        for (const row of rowsToInsert) {
          const rowKey = row.widget_key as DashboardWidgetKey;
          next[row.breakpoint] = {
            ...next[row.breakpoint],
            [rowKey]: { x: row.x, y: row.y, w: row.w, h: row.h },
          };
        }
        return next;
      });

      await saveLayouts(rowsToInsert);
    },
    [layouts, saveLayouts, user],
  );

  const addWidget = useCallback(
    async (key: DashboardWidgetKey, breakpoint: DashboardWidgetBreakpoint) => {
      if (!user) return;
      const existing = prefs[key];
      const next: UserDashboardWidget = {
        user_id: user.id,
        widget_key: key,
        is_visible: true,
        created_at: existing?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setPrefs((prev) => ({ ...prev, [key]: next }));
      await savePrefs([next]);
      await ensureWidgetInLayouts(key);
      await setWidgetVisibility(key, breakpoint, true);
    },
    [ensureWidgetInLayouts, prefs, savePrefs, setWidgetVisibility, user],
  );

  const getVisibleWidgetKeys = useCallback(
    (breakpoint: DashboardWidgetBreakpoint) =>
      (Object.keys(prefs) as DashboardWidgetKey[]).filter(
        (key) => Boolean(visibility[breakpoint][key]),
      ),
    [prefs, visibility],
  );

  const saveBreakpointLayout = useCallback(
    async (breakpoint: DashboardWidgetBreakpoint, nextLayout: BreakpointLayoutInput[]) => {
      if (!user || nextLayout.length === 0) return;

      const normalized = normalizeBreakpointLayout(breakpoint, nextLayout);
      const normalizedRows: UserDashboardWidgetLayout[] = normalized.map((item) => ({
        user_id: user.id,
        widget_key: item.key,
        breakpoint,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        unit_scale: 2,
        updated_at: new Date().toISOString(),
      }));

      setLayouts((prev) => {
        const next = { ...prev };
        const bp = { ...next[breakpoint] };
        for (const row of normalizedRows) {
          const key = row.widget_key as DashboardWidgetKey;
          bp[key] = { x: row.x, y: row.y, w: row.w, h: row.h };
        }
        next[breakpoint] = bp;
        return next;
      });

      await saveLayouts(normalizedRows);
    },
    [saveLayouts, user],
  );

  return {
    prefs,
    visibility,
    layouts,
    getVisibleWidgetKeys,
    isLoading,
    isSaving,
    error,
    refetch: fetchAll,
    setWidgetVisibility,
    setWidgetSize,
    setWidgetSpan,
    reorderWidgets,
    addWidget,
    placeWidgetAtSlot,
    moveWidget,
    saveBreakpointLayout,
  };
}
