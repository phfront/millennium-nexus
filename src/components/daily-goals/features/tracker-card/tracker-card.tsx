'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import {
  Card,
  HoldStepper,
  IntegerSlider,
  Checklist,
  CompletionToggle,
} from '@phfront/millennium-ui';
import { formatScore, getScoreColor, maxPossiblePointsForTracker, calculatePoints } from '@/lib/daily-goals/scoring';
import { getGoalValueForDate } from '@/lib/daily-goals/goal-history';
import type { Tracker, Log } from '@/types/daily-goals';

const NUMERIC_LOG_DEBOUNCE_MS = 500;

interface TrackerCardProps {
  tracker: Tracker;
  log: Log | null;
  readonly?: boolean;
  isSaving?: boolean;
  viewDate?: string;  // Data para buscar goal_value histórico (quando readonly)
  onLogChange: (tracker: Tracker, partial: Partial<Log>) => void;
  /** Esconde o atalho de configuração (ex.: widget na home). */
  hideSettingsLink?: boolean;
}

export function TrackerCard({
  tracker,
  log,
  readonly = false,
  isSaving = false,
  viewDate,
  onLogChange,
  hideSettingsLink = false,
}: TrackerCardProps) {
  const isReadonly = readonly;
  const isNumericType = tracker.type === 'counter' || tracker.type === 'slider';
  const serverValue = log?.value ?? 0;
  
  // Busca goal_value histórico quando readonly e viewDate está definida
  const [historicalGoalValue, setHistoricalGoalValue] = useState<number | null>(null);
  const effectiveGoalValue = historicalGoalValue !== null ? historicalGoalValue : tracker.goal_value;
  
  useEffect(() => {
    if (readonly && viewDate && (tracker.type === 'counter' || tracker.type === 'slider')) {
      getGoalValueForDate(tracker.id, viewDate).then((value) => {
        if (value !== null) {
          setHistoricalGoalValue(value);
        }
      });
    }
  }, [readonly, viewDate, tracker.id, tracker.type]);

  const [draftValue, setDraftValue] = useState<number | null>(null);
  const displayNumericValue = draftValue !== null ? draftValue : serverValue;

  const onLogChangeRef = useRef(onLogChange);
  const trackerRef = useRef(tracker);
  onLogChangeRef.current = onLogChange;
  trackerRef.current = tracker;

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestPendingRef = useRef<number | null>(null);

  const flushDebouncedNumeric = useCallback(() => {
    const v = latestPendingRef.current;
    latestPendingRef.current = null;
    if (v === null) return;
    onLogChangeRef.current(trackerRef.current, { value: v });
  }, []);

  const scheduleDebouncedNumeric = useCallback(
    (value: number) => {
      latestPendingRef.current = value;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(flushDebouncedNumeric, NUMERIC_LOG_DEBOUNCE_MS);
    },
    [flushDebouncedNumeric],
  );

  useEffect(() => {
    if (!isNumericType) return;
    if (draftValue === null) return;
    if (log?.value === draftValue) {
      setDraftValue(null);
    }
  }, [isNumericType, log?.value, draftValue]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      const v = latestPendingRef.current;
      if (v !== null) {
        latestPendingRef.current = null;
        onLogChangeRef.current(trackerRef.current, { value: v });
      }
    };
  }, []);

  function handleNumericChange(value: number) {
    if (isReadonly) return;
    setDraftValue(value);
    scheduleDebouncedNumeric(value);
  }

  function handleChecklistToggle(index: number, checked: boolean) {
    const current = log?.checked_items ?? tracker.checklist_items?.map(() => false) ?? [];
    const updated = [...current];
    updated[index] = checked;
    onLogChange(tracker, { checked_items: updated });
  }

  function handleBooleanToggle(done: boolean) {
    onLogChange(tracker, { value: done ? 1 : 0 });
  }

  const checkedItems = log?.checked_items ?? tracker.checklist_items?.map(() => false) ?? [];

  return (
    <Card
      className={[
        'flex flex-col transition-all duration-200',
        hideSettingsLink
          ? 'h-full min-h-0 gap-2 rounded-xl border-0 bg-surface-3/35 p-3 shadow-none ring-1 ring-inset ring-white/6'
          : 'gap-3 p-4',
        isSaving ? 'ring-1 ring-brand-primary/40' : '',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-text-primary">{tracker.label}</h3>
          {isSaving && (
            <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-brand-primary" />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {tracker.unit && !isSaving && (
            <span className="text-xs text-text-muted">{tracker.unit}</span>
          )}
          {isSaving && (
            <span className="text-xs font-medium text-brand-primary/70">salvando…</span>
          )}
          {!hideSettingsLink && !tracker.deleted_at && (
            <Link
              href={`/daily-goals/config/${tracker.id}`}
              className="inline-flex cursor-pointer rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
              aria-label="Configurar meta"
            >
              <Settings size={15} />
            </Link>
          )}
        </div>
      </div>

      {/* Input dinâmico */}
      <div className={hideSettingsLink ? 'min-h-0 flex-1 overflow-y-auto' : undefined}>
        {tracker.type === 'counter' && (
          <HoldStepper
            value={displayNumericValue}
            max={effectiveGoalValue}
            unit={tracker.unit}
            disabled={isReadonly}
            onChange={handleNumericChange}
          />
        )}
        {tracker.type === 'slider' && (
          <IntegerSlider
            value={displayNumericValue}
            max={effectiveGoalValue ?? 100}
            unit={tracker.unit}
            disabled={isReadonly}
            onChange={handleNumericChange}
          />
        )}
        {tracker.type === 'checklist' && (
          <Checklist
            items={tracker.checklist_items ?? []}
            checked={checkedItems}
            disabled={isReadonly}
            onToggle={handleChecklistToggle}
          />
        )}
        {tracker.type === 'boolean' && (
          <CompletionToggle
            checked={serverValue === 1}
            disabled={isReadonly}
            onCheckedChange={handleBooleanToggle}
          />
        )}
      </div>

      {/* Rodapé de pontuação */}
      {(tracker.scoring_enabled || maxPossiblePointsForTracker(tracker) > 0) && (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-text-muted">Pontuação</span>
          <span className={`text-xs font-semibold tabular-nums ${getScoreColor(log?.points_earned ?? 0)}`}>
            {log ? formatScore(log.points_earned) : readonly && viewDate 
              ? formatScore(calculatePoints({ ...tracker, goal_value: effectiveGoalValue }, {}, effectiveGoalValue))
              : `Vale ${formatScore(maxPossiblePointsForTracker(tracker))}`
            }
          </span>
        </div>
      )}
    </Card>
  );
}
