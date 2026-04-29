'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import {
  Card,
  HoldStepper,
  IntegerSlider,
  Checklist,
  CompletionToggle,
  PointsBadge,
  type BadgeVariant,
} from '@phfront/millennium-ui';
import { maxPossiblePointsForTracker } from '@/lib/habits-goals/scoring';
import { getGoalValueForDate } from '@/lib/habits-goals/goal-history';
import type { Tracker, Log } from '@/types/habits-goals';

const NUMERIC_LOG_DEBOUNCE_MS = 500;

/**
 * Mesmo layout que {@link IntegerSlider} (valor grande + "meta:" + slider), mas o valor representa o
 * **total do período** (soma das logs anteriores + rascunho de hoje); a linha "meta" mostra sempre a
 * meta do período (`goalMeta`), não o teto do range.
 */
function PeriodAggregateSliderShell({
  periodTotal,
  rangeMin,
  rangeMax,
  goalMeta,
  unit,
  disabled,
  onPeriodTotalChange,
}: {
  periodTotal: number;
  /** Mínimo atingível só ao ajustar o dia corrente (= soma dos outros dias no período). */
  rangeMin: number;
  rangeMax: number;
  goalMeta: number;
  unit: string | null;
  disabled: boolean;
  onPeriodTotalChange: (nextTotal: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const clamped = Math.min(Math.max(periodTotal, rangeMin), rangeMax);

  useEffect(() => {
    if (!editing) return;
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [editing]);

  function commitEdit() {
    const trimmed = draft.trim();
    if (trimmed === '') {
      setEditing(false);
      setError(null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < rangeMin || n > rangeMax) {
      setError(`Valor entre ${rangeMin} e ${rangeMax}.`);
      return;
    }
    onPeriodTotalChange(n);
    setEditing(false);
    setError(null);
    setDraft('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(false);
      setError(null);
      setDraft('');
    }
  }

  const valueBlock = (
    <div className="flex flex-col items-start gap-0.5 min-w-0">
      {editing ? (
        <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            onBlur={() => window.setTimeout(() => commitEdit(), 0)}
            onKeyDown={handleKeyDown}
            className={[
              'min-w-[4ch] max-w-[min(100%,12rem)] border-b-2 bg-transparent text-2xl font-bold tabular-nums text-text-primary outline-none',
              error ? 'border-red-400' : 'border-brand-primary',
            ].join(' ')}
            aria-invalid={!!error}
            aria-label="Editar total no período"
          />
          {unit ? <span className="text-sm font-normal text-text-muted">{unit}</span> : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setError(null);
            setDraft(String(clamped));
            setEditing(true);
          }}
          className={[
            'cursor-pointer rounded-sm text-left text-2xl font-bold tabular-nums text-text-primary',
            'decoration-text-muted/50 underline-offset-4 hover:underline',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1',
            'disabled:cursor-not-allowed disabled:opacity-40',
          ].join(' ')}
          aria-label={`Total no período: ${clamped}${unit ? ` ${unit}` : ''}. Clique para editar.`}
        >
          {clamped}
          {unit ? <span className="ml-1 text-sm font-normal text-text-muted">{unit}</span> : null}
        </button>
      )}
      {error ? <span className="text-xs text-red-400">{error}</span> : null}
    </div>
  );

  const metaStr = goalMeta > 0 ? String(goalMeta) : '—';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-2">
        {valueBlock}
        <span className="shrink-0 text-sm text-text-muted">
          meta: {metaStr}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={rangeMin}
        max={rangeMax}
        value={clamped}
        disabled={disabled}
        onChange={(e) => onPeriodTotalChange(Number(e.target.value))}
        aria-label={`Total no período: ${clamped} de ${metaStr}${unit ? ` ${unit}` : ''}`}
        className="h-2 w-full cursor-pointer rounded-full accent-brand-primary disabled:cursor-not-allowed disabled:opacity-40"
      />
    </div>
  );
}

/** Cor do badge: verde = recompensa (pontos positivos na meta), vermelho = penalidade. */
function pointsBadgeVariant(tracker: Tracker, maxPoints: number): BadgeVariant {
  if (maxPoints <= 0) return 'muted';
  if (tracker.type === 'checklist') return 'success';
  if (!tracker.scoring_enabled) return 'muted';
  const pv = Number(tracker.points_value ?? 0);
  if (pv < 0) return 'danger';
  if (pv > 0) return 'success';
  return 'muted';
}

interface TrackerCardProps {
  tracker: Tracker;
  log: Log | null;
  /** Soma no período corrente (counter/slider agregados); o cartão mostra progresso agregado. */
  periodNumericSum?: number | null;
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
  periodNumericSum = null,
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
  const maxPoints = maxPossiblePointsForTracker(tracker);
  const showPointsInTitle = (tracker.scoring_enabled || maxPoints > 0) && maxPoints > 0;
  const isNumericAggregate =
    (tracker.period_aggregation ?? 'single') === 'aggregate' &&
    (tracker.type === 'counter' || tracker.type === 'slider');
  const periodSum =
    periodNumericSum != null && isNumericAggregate ? periodNumericSum : null;
  const goalNum = Number(effectiveGoalValue ?? 0);
  const periodPct =
    goalNum > 0 && periodSum != null
      ? Math.min(100, (periodSum / goalNum) * 100)
      : periodSum != null && periodSum > 0
        ? 100
        : 0;
  const showPeriodAggregateBar =
    periodSum != null &&
    isNumericAggregate &&
    (tracker.period_kind ?? 'daily') !== 'daily' &&
    tracker.type !== 'slider';

  /** Soma no período com rascunho de hoje (para slider agregado = total do período no controlo). */
  const basePeriodSum = periodSum ?? serverValue;
  const optimisticPeriodTotal = isNumericAggregate
    ? basePeriodSum - serverValue + displayNumericValue
    : displayNumericValue;

  /**
   * Soma no período vinda de dias que não são o log de hoje — não dá para baixar o total abaixo disto
   * só mudando o dia corrente.
   */
  const othersInPeriod = Math.max(0, basePeriodSum - serverValue);

  /**
   * Teto do slider: meta do período (ou valor agregado se já acima).
   * Modo não agregado: meta diária / default.
   */
  const sliderRangeMax = isNumericAggregate
    ? Math.max(goalNum, optimisticPeriodTotal, othersInPeriod, 1)
    : effectiveGoalValue ?? 100;

  /**
   * Slider sempre começa em 0 visualmente para o thumb refletir `total / meta` (ex.: 350/2000 ≈ 17.5%),
   * mesmo quando os 350 vieram só de dias passados. O **valor mínimo real** (não dá para descer abaixo de
   * `othersInPeriod` só ajustando hoje) é imposto em {@link handleAggregatePeriodSlider}.
   */
  const sliderRangeMin = 0;

  function handleAggregatePeriodSlider(newPeriodTotal: number) {
    if (isReadonly) return;
    const clampedTotal = Math.min(
      Math.max(Math.round(newPeriodTotal), othersInPeriod),
      sliderRangeMax,
    );
    const newToday = clampedTotal - othersInPeriod;
    handleNumericChange(newToday);
  }

  return (
    <Card
      className={[
        'flex flex-col justify-between transition-all duration-200',
        hideSettingsLink
          ? 'h-full min-h-0 gap-2 rounded-xl border-0 bg-surface-3/35 p-3 shadow-none ring-1 ring-inset ring-white/6'
          : 'gap-3 p-4',
        isSaving ? 'ring-1 ring-brand-primary/40' : '',
      ].join(' ')}
    >
      {/* Header: nome trunca com …; pontos sempre visíveis à direita (não entram no truncate) */}
      <div className="flex min-w-0 items-start gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h3
            className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary"
            title={tracker.label}
          >
            {tracker.label}
          </h3>
          {isSaving && (
            <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-brand-primary" />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {tracker.unit && !isSaving && (
            <span className="text-xs text-text-muted">{tracker.unit}</span>
          )}
          {isSaving && (
            <span className="text-xs font-medium text-brand-primary/70">salvando…</span>
          )}
          {showPointsInTitle ? (
            <PointsBadge
              points={maxPoints}
              variant={pointsBadgeVariant(tracker, maxPoints)}
              aria-label={`Pontuação máxima: ${maxPoints} pontos`}
            />
          ) : null}
          {!hideSettingsLink && !tracker.deleted_at && (
            <Link
              href={`/habits-goals/config/${tracker.id}`}
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
          <div className="flex flex-col gap-2">
            <HoldStepper
              value={displayNumericValue}
              max={isNumericAggregate ? undefined : effectiveGoalValue ?? undefined}
              unit={tracker.unit}
              disabled={isReadonly}
              onChange={handleNumericChange}
              showProgressBar={!hideSettingsLink && !isNumericAggregate}
            />
            {showPeriodAggregateBar && (
              <div className="space-y-1">
                <p className="text-xs text-text-muted">
                  No período:{' '}
                  <span className="font-semibold text-text-secondary tabular-nums">
                    {periodSum} / {goalNum || '—'}
                  </span>
                  {tracker.unit ? ` ${tracker.unit}` : ''}
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-brand-primary transition-all duration-300"
                    style={{ width: `${periodPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        {tracker.type === 'slider' && (
          <div className="flex flex-col gap-2">
            {isNumericAggregate ? (
              <PeriodAggregateSliderShell
                periodTotal={optimisticPeriodTotal}
                rangeMin={sliderRangeMin}
                rangeMax={sliderRangeMax}
                goalMeta={goalNum}
                unit={tracker.unit}
                disabled={isReadonly}
                onPeriodTotalChange={handleAggregatePeriodSlider}
              />
            ) : (
              <IntegerSlider
                value={displayNumericValue}
                max={sliderRangeMax}
                unit={tracker.unit}
                disabled={isReadonly}
                onChange={handleNumericChange}
                compact={false}
              />
            )}
            {showPeriodAggregateBar && (
              <div className="space-y-1">
                <p className="text-xs text-text-muted">
                  No período:{' '}
                  <span className="font-semibold text-text-secondary tabular-nums">
                    {periodSum} / {goalNum || '—'}
                  </span>
                  {tracker.unit ? ` ${tracker.unit}` : ''}
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-brand-primary transition-all duration-300"
                    style={{ width: `${periodPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
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
          <div className="flex h-full items-end">
            <CompletionToggle
              checked={serverValue === 1}
              disabled={isReadonly}
              onCheckedChange={handleBooleanToggle}
              compact={hideSettingsLink}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
