'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import {
  Check,
  CheckCircle2,
  Droplets,
  Flame,
  Gauge,
  ListChecks,
  Settings,
  Target,
  UtensilsCrossed,
} from 'lucide-react';
import {
  Card,
  HoldStepper,
  IntegerSlider,
  CompletionToggle,
  PointsBadge,
  Modal,
  Button,
  type BadgeVariant,
} from '@phfront/millennium-ui';
import { maxPossiblePointsForTracker, formatScore } from '@/lib/habits-goals/scoring';
import { getGoalValueForDate } from '@/lib/habits-goals/goal-history';
import { isTrackerCompletedForView } from '@/lib/habits-goals/period';
import { TrackerChecklistControl } from '@/components/habits-goals/features/tracker-card/tracker-checklist-control';
import { TrackerNumericSlider } from '@/components/habits-goals/features/tracker-card/tracker-numeric-slider';
import { TrackerCounterControl } from '@/components/habits-goals/features/tracker-card/tracker-counter-control';
import { TrackerWaterDashboardControl } from '@/components/habits-goals/features/tracker-card/tracker-water-dashboard-control';
import { TrackerCaloriesDashboardControl } from '@/components/habits-goals/features/tracker-card/tracker-calories-dashboard-control';
import { TrackerMealDiaryDashboardControl } from '@/components/habits-goals/features/tracker-card/tracker-meal-diary-dashboard-control';
import type { Tracker, Log } from '@/types/habits-goals';

const NUMERIC_LOG_DEBOUNCE_MS = 500;

type TrackerCardVariant = 'default' | 'dashboard';

type TrackerVisual = {
  Icon: typeof Target;
  label: string;
  iconClass: string;
  glowClass: string;
  progressClass: string;
};

function trackerVisual(tracker: Tracker): TrackerVisual {
  if (tracker.source_key === 'water_consumed') {
    return {
      Icon: Droplets,
      label: 'Hidratação',
      iconClass: 'bg-sky-500/15 text-sky-400 ring-sky-400/25',
      glowClass: 'from-sky-500/10 via-transparent to-transparent',
      progressClass: 'bg-sky-400',
    };
  }
  if (tracker.source_key === 'calories_burned') {
    return {
      Icon: Flame,
      label: 'Calorias',
      iconClass: 'bg-orange-500/15 text-orange-400 ring-orange-400/25',
      glowClass: 'from-orange-500/12 via-transparent to-transparent',
      progressClass: 'bg-orange-400',
    };
  }
  if (tracker.source_key === 'meal_diary') {
    return {
      Icon: UtensilsCrossed,
      label: 'Diário alimentar',
      iconClass: 'bg-emerald-500/15 text-emerald-400 ring-emerald-400/25',
      glowClass: 'from-emerald-500/12 via-transparent to-transparent',
      progressClass: 'bg-emerald-400',
    };
  }
  switch (tracker.type) {
    case 'checklist':
      return {
        Icon: ListChecks,
        label: 'Checklist',
        iconClass: 'bg-violet-500/15 text-violet-400 ring-violet-400/25',
        glowClass: 'from-violet-500/10 via-transparent to-transparent',
        progressClass: 'bg-violet-400',
      };
    case 'boolean':
      return {
        Icon: CheckCircle2,
        label: 'Sim ou não',
        iconClass: 'bg-emerald-500/15 text-emerald-400 ring-emerald-400/25',
        glowClass: 'from-emerald-500/10 via-transparent to-transparent',
        progressClass: 'bg-emerald-400',
      };
    case 'slider':
      return {
        Icon: Gauge,
        label: 'Escala',
        iconClass: 'bg-amber-500/15 text-amber-400 ring-amber-400/25',
        glowClass: 'from-amber-500/10 via-transparent to-transparent',
        progressClass: 'bg-amber-400',
      };
    default:
      return {
        Icon: Target,
        label: 'Contador',
        iconClass: 'bg-brand-primary/15 text-brand-primary ring-brand-primary/25',
        glowClass: 'from-brand-primary/10 via-transparent to-transparent',
        progressClass: 'bg-brand-primary',
      };
  }
}

function dashboardProgressMeta(
  tracker: Tracker,
  log: Log | null,
  periodSum: number | null,
  goalNum: number,
  checkedItems: boolean[],
  isNumericAggregate: boolean,
): { pct: number; detail: string } {
  if (tracker.type === 'boolean') {
    return {
      pct: log?.value === 1 ? 100 : 0,
      detail: log?.value === 1 ? 'Concluída hoje' : 'Ainda não registrada',
    };
  }
  if (tracker.type === 'checklist') {
    const total = tracker.checklist_items?.length ?? 0;
    const done = checkedItems.filter(Boolean).length;
    return {
      pct: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0,
      detail: total > 0 ? `${done} de ${total} itens` : 'Sem itens',
    };
  }
  if (periodSum != null && isNumericAggregate) {
    return {
      pct: goalNum > 0 ? Math.min(100, Math.round((periodSum / goalNum) * 100)) : 0,
      detail: `${periodSum} / ${goalNum || '—'}${tracker.unit ? ` ${tracker.unit}` : ''} no período`,
    };
  }
  const value = Number(log?.value ?? 0);
  return {
    pct: goalNum > 0 ? Math.min(100, Math.round((value / goalNum) * 100)) : value > 0 ? 100 : 0,
    detail: `${value} / ${goalNum || '—'}${tracker.unit ? ` ${tracker.unit}` : ''}`,
  };
}

function readSpecificEntries(note: string | null | undefined): number[] {
  if (!note) return [];
  try {
    const parsed = JSON.parse(note) as { entries?: unknown };
    return Array.isArray(parsed.entries)
      ? parsed.entries.filter((value): value is number => typeof value === 'number' && value > 0)
      : [];
  } catch {
    return [];
  }
}

function SpecificTrackerControl({
  tracker,
  log,
  weekTotal,
  mealDiaryWeekLogs,
  readonly,
  onLogChange,
  variant = 'default',
}: {
  tracker: Tracker;
  log: Log | null;
  weekTotal: number | null;
  mealDiaryWeekLogs?: { note?: string | null }[];
  readonly: boolean;
  onLogChange: (tracker: Tracker, partial: Partial<Log>) => void;
  variant?: TrackerCardVariant;
}) {
  const isWater = tracker.source_key === 'water_consumed';
  const isMealDiary = tracker.source_key === 'meal_diary';
  const isDashboard = variant === 'dashboard';
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const quickValues = isWater ? [100, 500] : [100, 250, 500];
  const current = Number(log?.value ?? 0);
  const goal = Number(tracker.goal_value ?? 0);
  const entries = readSpecificEntries(log?.note);
  const progress = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;
  const weeklyGoal = goal * (tracker.recurrence_days?.length ?? 7);
  const Icon = isWater ? Droplets : Flame;
  const unitLabel = tracker.unit ?? '';

  function saveEntries(nextEntries: number[]) {
    onLogChange(tracker, {
      value: nextEntries.reduce((sum, value) => sum + value, 0),
      note: JSON.stringify({ entries: nextEntries }),
    });
  }

  function handleCustomSave() {
    const value = Math.round(Number(customValue));
    if (!Number.isFinite(value) || value <= 0) return;
    saveEntries([...entries, value]);
    setCustomValue('');
    setShowCustomModal(false);
  }

  if (isDashboard || isMealDiary) {
    if (isWater) {
      return (
        <TrackerWaterDashboardControl
          current={current}
          goal={goal}
          unit={unitLabel}
          entries={entries}
          readonly={readonly}
          quickValues={quickValues}
          onSaveEntries={saveEntries}
        />
      );
    }

    if (isMealDiary) {
      return (
        <TrackerMealDiaryDashboardControl
          tracker={tracker}
          note={log?.note}
          weekLogs={mealDiaryWeekLogs}
          readonly={readonly}
          onSaveNote={(note, value) => onLogChange(tracker, { note, value })}
        />
      );
    }

    return (
      <TrackerCaloriesDashboardControl
        current={current}
        goal={goal}
        unit={unitLabel}
        weekTotal={weekTotal}
        weeklyGoal={weeklyGoal}
        entries={entries}
        readonly={readonly}
        onSaveEntries={saveEntries}
      />
    );
  }

  const quickBtnClass =
    'min-h-10 rounded-lg border border-border bg-surface-3 px-1 text-xs font-semibold tabular-nums text-text-primary hover:border-brand-primary/50 hover:bg-brand-primary/10';
  const otherBtnClass = quickBtnClass;
  const undoBtnClass =
    'min-h-10 rounded-lg border border-border bg-surface-3 px-1 text-xs font-semibold text-text-secondary hover:border-amber-400/40 hover:bg-amber-500/10 disabled:opacity-40';

  const actions = !readonly ? (
    <>
      <div className="grid grid-cols-3 gap-2">
        {quickValues.map((value) => (
          <button key={value} type="button" onClick={() => saveEntries([...entries, value])} className={quickBtnClass}>
            +{value}
          </button>
        ))}
        <button type="button" onClick={() => setShowCustomModal(true)} className={otherBtnClass}>
          Outro
        </button>
        <button
          type="button"
          disabled={entries.length === 0}
          onClick={() => saveEntries(entries.slice(0, -1))}
          className={`${undoBtnClass} col-span-2`}
        >
          Desfazer
        </button>
      </div>

      <Modal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        title={`Outro valor (${unitLabel})`}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Valor em {unitLabel}
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
              placeholder={isWater ? 'Ex: 350' : 'Ex: 150'}
              className="w-full rounded-lg border border-border bg-surface-3 px-3 py-2 text-sm text-text-primary tabular-nums outline-none focus:border-brand-primary"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={() => setShowCustomModal(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleCustomSave}>
              Adicionar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  ) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon size={17} className={isWater ? 'text-sky-400' : 'text-brand-primary'} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xl font-semibold tabular-nums text-text-primary">
              {current} <span className="text-xs font-normal text-text-muted">{tracker.unit}</span>
            </span>
            <span className="text-xs text-text-muted">{progress}% hoje</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className={isWater ? 'h-full rounded-full bg-sky-500' : 'h-full rounded-full bg-brand-primary'}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-text-muted">
            Meta diária: {goal} {tracker.unit}
            {!isWater && weekTotal != null
              ? ` · Semana: ${weekTotal} / ${weeklyGoal} ${tracker.unit}`
              : ''}
          </p>
        </div>
      </div>

      {actions}
    </div>
  );
}

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

function dashboardPointsBadgeClass(points: number, accent: DashboardAccent = 'default'): string {
  if (points > 0) {
    if (accent === 'orange') return 'bg-orange-500/12 text-orange-300';
    if (accent === 'sky') return 'bg-sky-500/12 text-sky-300';
    if (accent === 'emerald') return 'bg-emerald-500/12 text-emerald-300';
    return 'bg-emerald-500/12 text-emerald-400';
  }
  if (points < 0) return 'bg-red-500/12 text-red-400';
  if (accent === 'orange') return 'bg-orange-500/8 text-orange-300/70';
  if (accent === 'sky') return 'bg-sky-500/8 text-sky-300/70';
  if (accent === 'emerald') return 'bg-emerald-500/8 text-emerald-300/70';
  return 'bg-white/5 text-text-muted';
}

type DashboardAccent = 'default' | 'orange' | 'sky' | 'emerald';

function getDashboardAccent(tracker: Tracker): DashboardAccent {
  if (tracker.source_key === 'calories_burned') return 'orange';
  if (tracker.source_key === 'water_consumed') return 'sky';
  if (tracker.source_key === 'meal_diary') return 'emerald';
  return 'default';
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
  /** Logs da semana civil (calorias queimadas / diário alimentar). */
  mealDiaryWeekLogs?: { note?: string | null }[];
  readonly?: boolean;
  isSaving?: boolean;
  viewDate?: string;  // Data para buscar goal_value histórico (quando readonly)
  onLogChange: (tracker: Tracker, partial: Partial<Log>) => void;
  /** Esconde o atalho de configuração. */
  hideSettingsLink?: boolean;
  /** Visual premium para a home do módulo. */
  variant?: TrackerCardVariant;
}

export function TrackerCard({
  tracker,
  log,
  periodNumericSum = null,
  mealDiaryWeekLogs,
  readonly = false,
  isSaving = false,
  viewDate,
  onLogChange,
  hideSettingsLink = false,
  variant = 'default',
}: TrackerCardProps) {
  const isDashboard = variant === 'dashboard';
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

  const visual = trackerVisual(tracker);
  const { Icon: TrackerIcon } = visual;
  const isCompleted = isTrackerCompletedForView(
    tracker,
    log,
    periodSum,
    effectiveGoalValue ?? null,
  );
  const progressMeta = dashboardProgressMeta(
    tracker,
    log,
    periodSum,
    goalNum,
    checkedItems,
    isNumericAggregate,
  );
  const earnedPoints = Number(log?.points_earned ?? 0);
  const booleanRewardPoints =
    tracker.type === 'boolean' && tracker.scoring_enabled ? Number(tracker.points_value ?? 0) : 0;
  const dailySliderGoal = Math.max(Number(effectiveGoalValue ?? 0), 1);
  const useDashboardNumericSlider =
    isDashboard && !isNumericAggregate && tracker.type === 'slider';

  const controlBody = (
    <>
      {tracker.source_key ? (
        <SpecificTrackerControl
          tracker={tracker}
          log={log}
          weekTotal={periodNumericSum}
          mealDiaryWeekLogs={mealDiaryWeekLogs}
          readonly={isReadonly}
          onLogChange={onLogChange}
          variant={variant}
        />
      ) : tracker.type === 'counter' && (
        <div className="flex flex-col gap-2">
          {isDashboard && !isNumericAggregate ? (
            <TrackerCounterControl
              value={displayNumericValue}
              max={effectiveGoalValue ?? undefined}
              unit={tracker.unit}
              disabled={isReadonly}
              accentClass={visual.progressClass}
              onChange={handleNumericChange}
            />
          ) : (
            <HoldStepper
              value={displayNumericValue}
              max={isNumericAggregate ? undefined : effectiveGoalValue ?? undefined}
              unit={tracker.unit}
              disabled={isReadonly}
              onChange={handleNumericChange}
              showProgressBar={!hideSettingsLink && !isNumericAggregate && !isDashboard}
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
          ) : useDashboardNumericSlider ? (
            <TrackerNumericSlider
              value={displayNumericValue}
              max={dailySliderGoal}
              unit={tracker.unit}
              disabled={isReadonly}
              accentClass={visual.progressClass}
              onChange={handleNumericChange}
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
        <TrackerChecklistControl
          items={tracker.checklist_items ?? []}
          checked={checkedItems}
          disabled={isReadonly}
          onToggle={handleChecklistToggle}
          variant={variant}
        />
      )}
      {tracker.type === 'boolean' && (
        <div className={isDashboard ? 'flex items-center justify-center py-1' : 'flex h-full items-end'}>
          <CompletionToggle
            checked={serverValue === 1}
            disabled={isReadonly}
            onCheckedChange={handleBooleanToggle}
            compact={hideSettingsLink && !isDashboard}
            labelOff={
              isDashboard && booleanRewardPoints !== 0
                ? `Marcar concluído · ${formatScore(booleanRewardPoints)}`
                : undefined
            }
            labelOn={
              isDashboard
                ? booleanRewardPoints !== 0
                  ? `Concluído · ${formatScore(earnedPoints)}`
                  : 'Concluído'
                : undefined
            }
          />
        </div>
      )}
    </>
  );

  if (isDashboard) {
    const isBoolean = tracker.type === 'boolean';
    const isNumericProgressControl = tracker.type === 'counter' || tracker.type === 'slider';
    const showCardProgress = !tracker.source_key && !isBoolean && !isNumericProgressControl;
    const showGenericStatus = !isBoolean;
    const showDashboardPointsBadge = showPointsInTitle || earnedPoints !== 0;
    const dashboardAccent = getDashboardAccent(tracker);
    const isThemedDashboard = dashboardAccent !== 'default';

    return (
      <article
        className={[
          'group relative flex flex-col rounded-xl border border-white/8 sm:rounded-2xl',
          isThemedDashboard ? 'overflow-visible' : 'overflow-hidden',
          'bg-gradient-to-br from-surface-2 via-surface-2 to-surface-3/90 shadow-lg shadow-black/20',
          'ring-1 ring-inset ring-white/5 transition-all duration-300',
          isSaving
            ? dashboardAccent === 'orange'
              ? 'ring-orange-400/45'
              : dashboardAccent === 'sky'
                ? 'ring-sky-400/45'
                : dashboardAccent === 'emerald'
                  ? 'ring-emerald-400/45'
                  : 'ring-brand-primary/40'
            : dashboardAccent === 'orange'
              ? 'hover:border-orange-400/25'
              : dashboardAccent === 'sky'
                ? 'hover:border-sky-400/25'
                : dashboardAccent === 'emerald'
                  ? 'hover:border-emerald-400/25'
                  : 'hover:border-white/12',
        ].join(' ')}
      >
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b ${visual.glowClass}`}
          aria-hidden
        />

        <div className="relative flex flex-col gap-2.5 p-3.5 sm:gap-3 sm:p-4">
          <div className="flex items-start gap-2.5">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset sm:h-10 sm:w-10 sm:rounded-2xl ${visual.iconClass}`}
            >
              <TrackerIcon size={18} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-text-primary sm:text-base" title={tracker.label}>
                    {tracker.label}
                  </h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <p className="text-[11px] text-text-muted">{visual.label}</p>
                    {isSaving ? (
                      <span
                        className={[
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                          dashboardAccent === 'orange'
                            ? 'bg-orange-500/12 text-orange-400'
                            : dashboardAccent === 'sky'
                              ? 'bg-sky-500/12 text-sky-400'
                              : dashboardAccent === 'emerald'
                                ? 'bg-emerald-500/12 text-emerald-400'
                                : 'bg-brand-primary/10 text-brand-primary',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'h-1.5 w-1.5 animate-pulse rounded-full',
                            dashboardAccent === 'orange'
                              ? 'bg-orange-400'
                              : dashboardAccent === 'sky'
                                ? 'bg-sky-400'
                                : dashboardAccent === 'emerald'
                                  ? 'bg-emerald-400'
                                  : 'bg-brand-primary',
                          ].join(' ')}
                        />
                        Salvando
                      </span>
                    ) : showGenericStatus ? (
                      isCompleted ? (
                        <span
                          className={[
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            dashboardAccent === 'orange'
                              ? 'bg-orange-500/12 text-orange-400'
                              : dashboardAccent === 'sky'
                                ? 'bg-sky-500/12 text-cyan-300'
                                : dashboardAccent === 'emerald'
                                  ? 'bg-emerald-500/12 text-emerald-300'
                                  : 'bg-emerald-500/12 text-emerald-400',
                          ].join(' ')}
                        >
                          <Check size={11} aria-hidden />
                          Concluída
                        </span>
                      ) : (
                        <span
                          className={[
                            'rounded-full px-2 py-0.5 text-[10px] font-medium',
                            dashboardAccent === 'orange'
                              ? 'bg-orange-500/10 text-orange-300/90'
                              : dashboardAccent === 'sky'
                                ? 'bg-sky-500/10 text-sky-300/90'
                                : dashboardAccent === 'emerald'
                                  ? 'bg-emerald-500/10 text-emerald-300/90'
                                  : 'bg-white/5 text-text-muted',
                          ].join(' ')}
                        >
                          Em progresso
                        </span>
                      )
                    ) : null}
                    {showDashboardPointsBadge && (
                      <span
                        className={[
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums',
                          dashboardPointsBadgeClass(earnedPoints, dashboardAccent),
                        ].join(' ')}
                      >
                        {formatScore(earnedPoints)}
                      </span>
                    )}
                  </div>
                </div>
                {!tracker.deleted_at && (
                  <Link
                    href={`/habits-goals/config/${tracker.id}`}
                    className={[
                      'inline-flex shrink-0 rounded-lg p-1.5 text-text-muted transition-colors',
                      dashboardAccent === 'orange'
                        ? 'hover:bg-orange-500/10 hover:text-orange-300'
                        : dashboardAccent === 'sky'
                          ? 'hover:bg-sky-500/10 hover:text-sky-300'
                          : dashboardAccent === 'emerald'
                            ? 'hover:bg-emerald-500/10 hover:text-emerald-300'
                            : 'hover:bg-white/5 hover:text-text-primary',
                    ].join(' ')}
                    aria-label="Configurar meta"
                  >
                    <Settings size={15} />
                  </Link>
                )}
              </div>
            </div>
          </div>

          {showCardProgress && (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-text-secondary">{progressMeta.detail}</span>
                <span className="shrink-0 font-semibold tabular-nums text-text-primary">{progressMeta.pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-black/25">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${visual.progressClass}`}
                  style={{ width: `${progressMeta.pct}%` }}
                />
              </div>
            </div>
          )}

          {controlBody}
        </div>
      </article>
    );
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
          {tracker.source_key && !isSaving && (
            <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-medium text-brand-primary">
              específica
            </span>
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
        {controlBody}
      </div>
    </Card>
  );
}
