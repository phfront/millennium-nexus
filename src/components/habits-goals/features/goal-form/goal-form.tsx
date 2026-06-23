'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  DatePicker,
  Input,
  Select,
  Switch,
  Tooltip,
} from '@phfront/millennium-ui';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Droplets,
  Flame,
  Gauge,
  ListChecks,
  Plus,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import type {
  Tracker,
  TrackerSourceKey,
  TrackerType,
  ScoringMode,
  ChecklistItem,
  TrackerPeriodKind,
  TrackerPeriodAggregation,
} from '@/types/habits-goals';
import { WEEK_DAY_LABELS } from '@/lib/habits-goals/scheduling';
import { defaultMealDiaryConfig, mealDiaryEffectiveDailyKcalGoal, parseMealDiaryConfig } from '@/lib/habits-goals/meal-diary';
import { MealDiaryGoalConfig } from '@/components/habits-goals/features/meal-diary/meal-diary-goal-config';
import type { MealDiarySourceConfig } from '@/types/meal-diary';

function parseLocalDate(iso: string): Date | undefined {
  const t = iso?.trim();
  if (!t) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  return new Date(y, mo - 1, d);
}

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function FieldLabelWithHelp({
  htmlFor,
  text,
  tooltip,
}: {
  htmlFor?: string;
  text: string;
  tooltip: ReactNode;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-sm font-medium text-text-primary">
          {text}
        </label>
      ) : (
        <span className="text-sm font-medium text-text-primary">{text}</span>
      )}
      <Tooltip
        content={tooltip}
        className="max-w-[min(92vw,280px)] whitespace-normal text-left leading-snug"
        position="top"
      >
        <button
          type="button"
          className="rounded p-0.5 text-text-muted hover:text-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          aria-label={`Ajuda: ${text}`}
        >
          <CircleHelp size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </Tooltip>
    </div>
  );
}

type TrackerPayload = Omit<Tracker, 'id' | 'user_id' | 'created_at' | 'deleted_at'>;

type FormPayloadSource = {
  label: string;
  type: TrackerType;
  sourceKey: TrackerSourceKey | null;
  goalValue: string;
  unit: string;
  active: boolean;
  checklistItems: ChecklistItem[];
  scoringEnabled: boolean;
  scoringMode: ScoringMode;
  pointsValue: string;
  pointsOnMiss: string;
  weeklyBonusPoints: string;
  recurrenceDays: number[] | null;
  startDate: string;
  endDate: string;
  sort_order: number;
  periodKind: TrackerPeriodKind;
  periodAggregation: TrackerPeriodAggregation;
  weekStart: number;
  periodAnchorDate: string;
  periodLengthDays: string;
  sourceConfig: MealDiarySourceConfig | null;
};

function buildPayload(s: FormPayloadSource): TrackerPayload {
  const needsGoalValue =
    (s.type === 'counter' || s.type === 'slider') && s.sourceKey !== 'meal_diary';
  const effectivePeriodKind = s.sourceKey ? 'daily' : s.periodKind;
  const isDaily = effectivePeriodKind === 'daily';
  const plen =
    s.periodKind === 'custom' && s.periodLengthDays
      ? Math.min(365, Math.max(2, Math.round(Number(s.periodLengthDays))))
      : null;
  const mealDiaryKcalGoal =
    s.sourceKey === 'meal_diary' && s.sourceConfig
      ? mealDiaryEffectiveDailyKcalGoal(s.sourceConfig)
      : null;

  return {
    label: s.label.trim(),
    type: s.type,
    source_key: s.sourceKey,
    source_config: s.sourceKey === 'meal_diary' && s.sourceConfig ? s.sourceConfig : null,
    goal_value: needsGoalValue
      ? Number(s.goalValue)
      : mealDiaryKcalGoal != null && mealDiaryKcalGoal > 0
        ? mealDiaryKcalGoal
        : null,
    unit: s.unit.trim() || null,
    active: s.active,
    checklist_items: s.type === 'checklist' ? s.checklistItems.filter((i) => i.label.trim()) : null,
    sort_order: s.sort_order,
    scoring_enabled:
      s.type === 'checklist'
        ? s.checklistItems.some((i) => i.label.trim() && i.points !== 0)
        : s.scoringEnabled,
    scoring_mode:
      s.scoringEnabled
        ? s.sourceKey === 'calories_burned'
          ? 'per_unit'
          : s.sourceKey === 'meal_diary'
            ? 'planned_items'
            : s.scoringMode
        : null,
    points_value: s.scoringEnabled ? Number(s.pointsValue) : 0,
    points_on_miss:
      s.scoringEnabled && s.pointsOnMiss
        ? s.sourceKey === 'meal_diary'
          ? -Math.abs(Number(s.pointsOnMiss))
          : Number(s.pointsOnMiss)
        : null,
    weekly_bonus_points:
      s.sourceKey === 'calories_burned' && s.scoringEnabled
        ? Number(s.weeklyBonusPoints || 0)
        : 0,
    recurrence_days: s.recurrenceDays,
    start_date: s.startDate || null,
    end_date: s.endDate || null,
    period_kind: effectivePeriodKind,
    period_aggregation: isDaily ? 'single' : s.periodAggregation,
    week_start: effectivePeriodKind === 'weekly' ? s.weekStart : 1,
    period_anchor_date:
      effectivePeriodKind === 'custom'
        ? s.periodAnchorDate || null
        : effectivePeriodKind === 'weekly' && s.periodAnchorDate
          ? s.periodAnchorDate
          : null,
    period_length_days: effectivePeriodKind === 'custom' ? plen : null,
  };
}

function initialToFormSource(initial?: Partial<Tracker>): FormPayloadSource {
  return {
    label: initial?.label ?? '',
    type: initial?.type ?? 'counter',
    sourceKey: initial?.source_key ?? null,
    goalValue: String(initial?.goal_value ?? ''),
    unit: initial?.unit ?? '',
    active: initial?.active ?? true,
    checklistItems:
      initial?.checklist_items == null
        ? [{ label: '', points: 0 }]
        : initial.checklist_items.map((c) => ({ ...c })),
    scoringEnabled: initial?.scoring_enabled ?? false,
    scoringMode:
      initial?.source_key === 'meal_diary'
        ? 'planned_items'
        : (initial?.scoring_mode ?? 'completion'),
    pointsValue: String(initial?.points_value ?? 0),
    pointsOnMiss:
      initial?.source_key === 'meal_diary' && initial?.points_on_miss != null
        ? String(Math.abs(Number(initial.points_on_miss)))
        : initial?.points_on_miss != null
          ? String(initial.points_on_miss)
          : '',
    weeklyBonusPoints: String(initial?.weekly_bonus_points ?? 0),
    recurrenceDays: initial?.recurrence_days ?? null,
    startDate: initial?.start_date ?? '',
    endDate: initial?.end_date ?? '',
    sort_order: initial?.sort_order ?? 0,
    periodKind: (initial?.period_kind as TrackerPeriodKind) ?? 'daily',
    periodAggregation: (initial?.period_aggregation as TrackerPeriodAggregation) ?? 'single',
    weekStart: initial?.week_start ?? 1,
    periodAnchorDate: initial?.period_anchor_date ?? '',
    periodLengthDays:
      initial?.period_length_days != null ? String(initial.period_length_days) : '',
    sourceConfig:
      initial?.source_key === 'meal_diary'
        ? parseMealDiaryConfig(initial.source_config)
        : null,
  };
}

interface GoalFormProps {
  initial?: Partial<Tracker>;
  onSubmit: (data: TrackerPayload) => Promise<void>;
  requireTypeSelection?: boolean;
  unavailableSpecificSources?: TrackerSourceKey[];
}

const TRACKER_TYPES: {
  value: TrackerType;
  label: string;
  tagline: string;
  description: string;
  example: string;
  icon: typeof Plus;
  iconClass: string;
  glowClass: string;
  chipClass: string;
}[] = [
  {
    value: 'counter',
    label: 'Contador',
    tagline: 'Quantitativo',
    description: 'Some ou subtraia valores até atingir um objetivo numérico.',
    example: 'Água, páginas lidas, repetições',
    icon: Plus,
    iconClass: 'bg-brand-primary/15 text-brand-primary ring-brand-primary/25',
    glowClass: 'from-brand-primary/14 via-brand-primary/5 to-transparent',
    chipClass: 'bg-brand-primary/10 text-brand-primary',
  },
  {
    value: 'slider',
    label: 'Escala',
    tagline: 'Intensidade',
    description: 'Registre rapidamente um valor dentro de uma faixa definida.',
    example: 'Humor, foco, nível de dor',
    icon: Gauge,
    iconClass: 'bg-amber-500/15 text-amber-400 ring-amber-400/25',
    glowClass: 'from-amber-500/14 via-amber-500/5 to-transparent',
    chipClass: 'bg-amber-500/10 text-amber-300',
  },
  {
    value: 'checklist',
    label: 'Checklist',
    tagline: 'Multi-tarefa',
    description: 'Divida a meta em etapas menores com progresso item a item.',
    example: 'Rotina matinal, treino, estudos',
    icon: ListChecks,
    iconClass: 'bg-violet-500/15 text-violet-400 ring-violet-400/25',
    glowClass: 'from-violet-500/14 via-violet-500/5 to-transparent',
    chipClass: 'bg-violet-500/10 text-violet-300',
  },
  {
    value: 'boolean',
    label: 'Sim ou não',
    tagline: 'Binário',
    description: 'Marque uma única ação como concluída ou pendente no dia.',
    example: 'Meditar, treinar, tomar remédio',
    icon: CheckCircle2,
    iconClass: 'bg-emerald-500/15 text-emerald-400 ring-emerald-400/25',
    glowClass: 'from-emerald-500/14 via-emerald-500/5 to-transparent',
    chipClass: 'bg-emerald-500/10 text-emerald-300',
  },
];

const TYPE_OPTIONS = TRACKER_TYPES.map(({ value, label }) => ({ value, label }));

const SPECIFIC_TRACKER_TYPES: {
  sourceKey: TrackerSourceKey;
  label: string;
  description: string;
  detail: string;
  icon: typeof Plus;
  defaultGoal: string;
  unit: string;
}[] = [
  {
    sourceKey: 'water_consumed',
    label: 'Total de água consumida',
    description: 'Controle a hidratação com registros próprios nesta meta.',
    detail: 'Mesma experiência da hidratação, sem compartilhar os dados.',
    icon: Droplets,
    defaultGoal: '2500',
    unit: 'ml',
  },
  {
    sourceKey: 'calories_burned',
    label: 'Calorias feitas',
    description: 'Registre calorias por dia e acompanhe o total da semana.',
    detail: 'Meta diária e semanal no mesmo acompanhamento.',
    icon: Flame,
    defaultGoal: '400',
    unit: 'kcal',
  },
  {
    sourceKey: 'meal_diary',
    label: 'Diário alimentar',
    description: 'Monte refeições com alimentos e registre item a item.',
    detail: 'Meta diária calculada pelo plano; calorias livres semanais para extras.',
    icon: UtensilsCrossed,
    defaultGoal: '',
    unit: 'kcal',
  },
];

const SCORING_MODE_OPTIONS = [
  { value: 'completion', label: 'Conclusão (pontos fixos ao atingir a meta)' },
  { value: 'per_unit', label: 'Por unidade (pontos × valor registrado)' },
];

const PERIOD_KIND_OPTIONS: { value: TrackerPeriodKind; label: string }[] = [
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'custom', label: 'Personalizado (ciclo)' },
];

const WEEK_START_OPTIONS = WEEK_DAY_LABELS.map((label, dow) => ({ value: dow, label }));

function GenericTypePreview({ type }: { type: TrackerType }) {
  if (type === 'counter') {
    return (
      <div className="rounded-xl bg-black/20 p-2.5 ring-1 ring-inset ring-white/8">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-semibold text-text-muted">−</span>
          <span className="text-sm font-semibold tabular-nums text-text-primary">
            12 <span className="text-[10px] font-normal text-text-muted">/ 20</span>
          </span>
          <span className="rounded-md bg-brand-primary/20 px-2 py-1 text-[10px] font-semibold text-brand-primary">+</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[60%] rounded-full bg-brand-primary" />
        </div>
      </div>
    );
  }

  if (type === 'slider') {
    return (
      <div className="rounded-xl bg-black/20 p-2.5 ring-1 ring-inset ring-white/8">
        <div className="flex items-baseline justify-between text-[10px] text-text-muted">
          <span className="text-sm font-semibold tabular-nums text-text-primary">7</span>
          <span>meta 10</span>
        </div>
        <div className="relative mt-2 h-1.5 rounded-full bg-white/10">
          <div className="absolute left-[70%] top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400 ring-2 ring-amber-400/30" />
        </div>
      </div>
    );
  }

  if (type === 'checklist') {
    return (
      <div className="space-y-1.5 rounded-xl bg-black/20 p-2.5 ring-1 ring-inset ring-white/8">
        {[
          { done: true, label: 'Alongamento' },
          { done: false, label: 'Leitura' },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span
              className={[
                'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                row.done
                  ? 'border-violet-400/50 bg-violet-500/25 text-violet-300'
                  : 'border-white/15 bg-white/5',
              ].join(' ')}
            >
              {row.done ? <CheckCircle2 size={9} aria-hidden /> : null}
            </span>
            <span className={`text-[11px] ${row.done ? 'text-text-secondary line-through' : 'text-text-primary'}`}>
              {row.label}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-black/20 p-2.5 ring-1 ring-inset ring-white/8">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-text-secondary">Concluído hoje</span>
        <span className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-emerald-500/80">
          <span className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm" />
        </span>
      </div>
    </div>
  );
}

function GenericGoalTypeCard({
  option,
  onSelect,
}: {
  option: (typeof TRACKER_TYPES)[number];
  onSelect: () => void;
}) {
  const Icon = option.icon;
  const examples = option.example.split(',').map((part) => part.trim()).filter(Boolean);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex min-h-[220px] flex-col overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-surface-2 via-surface-2 to-surface-3/90 text-left shadow-lg shadow-black/15 ring-1 ring-inset ring-white/5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/14 hover:shadow-xl hover:shadow-black/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${option.glowClass}`}
        aria-hidden
      />

      <div className="relative flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ${option.iconClass}`}
          >
            <Icon size={18} aria-hidden />
          </span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted ring-1 ring-inset ring-white/8">
            {option.tagline}
          </span>
        </div>

        <div className="mt-3">
          <GenericTypePreview type={option.value} />
        </div>

        <div className="mt-3 flex items-start justify-between gap-2">
          <h4 className="text-base font-semibold text-text-primary">{option.label}</h4>
          <ChevronRight
            size={16}
            className="mt-0.5 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand-primary"
            aria-hidden
          />
        </div>

        <p className="mt-1 line-clamp-2 text-sm leading-snug text-text-secondary">{option.description}</p>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
          {examples.map((sample) => (
            <span
              key={sample}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${option.chipClass}`}
            >
              {sample}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

export function GoalForm({
  initial,
  onSubmit,
  requireTypeSelection = false,
  unavailableSpecificSources = [],
}: GoalFormProps) {
  const router = useRouter();
  const pointsInputId = useId();
  const penaltyInputId = useId();
  const weeklyBonusInputId = useId();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSelectedType, setHasSelectedType] = useState(!requireTypeSelection);
  const [typeSearch, setTypeSearch] = useState('');

  const [label, setLabel] = useState(initial?.label ?? '');
  const [type, setType] = useState<TrackerType>(initial?.type ?? 'counter');
  const [sourceKey, setSourceKey] = useState<TrackerSourceKey | null>(initial?.source_key ?? null);
  const [goalValue, setGoalValue] = useState(String(initial?.goal_value ?? ''));
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [active, setActive] = useState(initial?.active ?? true);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(
    initial?.checklist_items ?? [{ label: '', points: 0 }],
  );
  const checklistLabelRefs = useRef<Array<HTMLInputElement | null>>([]);
  const focusChecklistRowRef = useRef<number | null>(null);

  const [scoringEnabled, setScoringEnabled] = useState(initial?.scoring_enabled ?? false);
  const [scoringMode, setScoringMode] = useState<ScoringMode>(initial?.scoring_mode ?? 'completion');
  const [pointsValue, setPointsValue] = useState(String(initial?.points_value ?? 0));
  const [pointsOnMiss, setPointsOnMiss] = useState(String(initial?.points_on_miss ?? ''));
  const [weeklyBonusPoints, setWeeklyBonusPoints] = useState(
    String(initial?.weekly_bonus_points ?? 0),
  );

  const [periodKind, setPeriodKind] = useState<TrackerPeriodKind>(
    (initial?.period_kind as TrackerPeriodKind) ?? 'daily',
  );
  const [periodAggregation, setPeriodAggregation] = useState<TrackerPeriodAggregation>(
    (initial?.period_aggregation as TrackerPeriodAggregation) ?? 'single',
  );
  const [weekStart, setWeekStart] = useState(initial?.week_start ?? 1);
  const [periodAnchorDate, setPeriodAnchorDate] = useState(initial?.period_anchor_date ?? '');
  const [periodLengthDays, setPeriodLengthDays] = useState(
    initial?.period_length_days != null ? String(initial.period_length_days) : '',
  );
  const [mealDiaryConfig, setMealDiaryConfig] = useState<MealDiarySourceConfig>(() =>
    initial?.source_key === 'meal_diary'
      ? parseMealDiaryConfig(initial.source_config)
      : defaultMealDiaryConfig(),
  );

  // Agendamento
  const [recurrenceDays, setRecurrenceDays] = useState<number[] | null>(initial?.recurrence_days ?? null);
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');

  const initialKey = initial?.id ?? '__new__';
  const [baselineStr, setBaselineStr] = useState(() =>
    JSON.stringify(buildPayload(initialToFormSource(initial))),
  );

  useEffect(() => {
    const src = initialToFormSource(initial);
    setLabel(src.label);
    setType(src.type);
    setSourceKey(src.sourceKey);
    setGoalValue(src.goalValue);
    setUnit(src.unit);
    setActive(src.active);
    setChecklistItems(src.checklistItems);
    setScoringEnabled(src.scoringEnabled);
    setScoringMode(src.scoringMode);
    setPointsValue(src.pointsValue);
    setPointsOnMiss(src.pointsOnMiss);
    setWeeklyBonusPoints(src.weeklyBonusPoints);
    setRecurrenceDays(src.recurrenceDays);
    setStartDate(src.startDate);
    setEndDate(src.endDate);
    setPeriodKind(src.periodKind);
    setPeriodAggregation(src.periodAggregation);
    setWeekStart(src.weekStart);
    setPeriodAnchorDate(src.periodAnchorDate);
    setPeriodLengthDays(src.periodLengthDays);
    setMealDiaryConfig(
      src.sourceKey === 'meal_diary' ? parseMealDiaryConfig(initial?.source_config) : defaultMealDiaryConfig(),
    );
    setBaselineStr(JSON.stringify(buildPayload(src)));
    setHasSelectedType(!requireTypeSelection);
  }, [initialKey, requireTypeSelection]);

  useEffect(() => {
    if (focusChecklistRowRef.current == null) return;
    const row = focusChecklistRowRef.current;
    focusChecklistRowRef.current = null;
    checklistLabelRefs.current[row]?.focus();
  }, [checklistItems]);

  const currentPayload = useMemo(
    () =>
      buildPayload({
        label,
        type,
        sourceKey,
        goalValue,
        unit,
        active,
        checklistItems,
        scoringEnabled,
        scoringMode,
        pointsValue,
        pointsOnMiss,
        weeklyBonusPoints,
        recurrenceDays,
        startDate,
        endDate,
        sort_order: initial?.sort_order ?? 0,
        periodKind,
        periodAggregation,
        weekStart,
        periodAnchorDate,
        periodLengthDays,
        sourceConfig: sourceKey === 'meal_diary' ? mealDiaryConfig : null,
      }),
    [
      label,
      type,
      sourceKey,
      goalValue,
      unit,
      active,
      checklistItems,
      scoringEnabled,
      scoringMode,
      pointsValue,
      pointsOnMiss,
      weeklyBonusPoints,
      recurrenceDays,
      startDate,
      endDate,
      initial?.sort_order,
      periodKind,
      periodAggregation,
      weekStart,
      periodAnchorDate,
      periodLengthDays,
      mealDiaryConfig,
    ],
  );

  const isDirty = JSON.stringify(currentPayload) !== baselineStr;

  const needsGoalValue =
    (type === 'counter' || type === 'slider') && sourceKey !== 'meal_diary';
  const selectedTrackerType = TRACKER_TYPES.find((option) => option.value === type);
  const selectedSpecificType = SPECIFIC_TRACKER_TYPES.find((option) => option.sourceKey === sourceKey);
  const selectedTypeDefinition = selectedSpecificType ?? selectedTrackerType;
  const SelectedTypeIcon = selectedTypeDefinition?.icon;
  const normalizedTypeSearch = typeSearch.trim().toLocaleLowerCase('pt-BR');
  const visibleGenericTypes = TRACKER_TYPES.filter((option) =>
    [option.label, option.description, option.example]
      .join(' ')
      .toLocaleLowerCase('pt-BR')
      .includes(normalizedTypeSearch),
  );
  const visibleSpecificTypes = SPECIFIC_TRACKER_TYPES.filter((option) =>
    [option.label, option.description, option.detail]
      .join(' ')
      .toLocaleLowerCase('pt-BR')
      .includes(normalizedTypeSearch),
  );

  const startDateValue = useMemo(() => parseLocalDate(startDate), [startDate]);
  const endDateValue = useMemo(() => parseLocalDate(endDate), [endDate]);

  function toggleDay(dow: number) {
    setRecurrenceDays((prev) => {
      if (prev === null) {
        // Ativar seleção personalizada: começa com todos exceto o clicado
        return [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== dow);
      }
      const next = prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort();
      // Se todos os 7 dias selecionados, volta para null (= todos)
      return next.length === 7 ? null : next;
    });
  }

  function handleChecklistItemEnter(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();

    setChecklistItems((prev) => {
      const updated = prev.map((item, i) =>
        i === index ? { ...item, label: item.label.trim() } : item,
      );
      const nextIndex = index + 1;
      if (nextIndex < updated.length) {
        focusChecklistRowRef.current = nextIndex;
        return updated;
      }
      focusChecklistRowRef.current = updated.length;
      return [...updated, { label: '', points: 0 }];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isDirty) return;
    if (!label.trim()) { setError('O nome da meta é obrigatório.'); return; }
    if (needsGoalValue && !goalValue) { setError('A meta precisa de um valor alvo.'); return; }
    if (sourceKey === 'meal_diary') {
      const itemCount = mealDiaryConfig.meals.reduce((sum, m) => sum + m.items.length, 0);
      if (itemCount === 0) {
        setError('Adicione pelo menos um alimento ao plano do dia.');
        return;
      }
    }
    if (periodKind === 'custom') {
      if (!periodAnchorDate.trim()) {
        setError('Meta personalizada: informe a data de início do ciclo.');
        return;
      }
      const n = Math.round(Number(periodLengthDays));
      if (!Number.isFinite(n) || n < 2 || n > 365) {
        setError('Meta personalizada: duração do ciclo entre 2 e 365 dias.');
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    try {
      await onSubmit(currentPayload);
      router.push('/habits-goals/config');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setIsLoading(false);
    }
  }

  if (!hasSelectedType) {
    return (
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-primary">
              Primeiro passo
            </p>
            <h2 className="mt-1 text-xl font-semibold text-text-primary">
              Como você quer acompanhar esta meta?
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Escolha o formato de registro. Você configurará os detalhes na próxima etapa.
            </p>
          </div>

          <Input
            label="Buscar tipo de meta"
            value={typeSearch}
            onChange={(event) => setTypeSearch(event.target.value)}
            placeholder="Ex.: água, checklist, humor, calorias"
          />

          {visibleGenericTypes.length > 0 && (
            <>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Metas genéricas</h3>
                <p className="mt-0.5 text-xs text-text-muted">
                  Você registra o progresso diretamente no card da meta.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                {visibleGenericTypes.map((option) => (
                  <GenericGoalTypeCard
                    key={option.value}
                    option={option}
                    onSelect={() => {
                      setType(option.value);
                      setSourceKey(null);
                      setHasSelectedType(true);
                      setError(null);
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {visibleSpecificTypes.length > 0 && (
            <>
              <div className="mt-3 border-t border-border pt-6">
                <h3 className="text-sm font-semibold text-text-primary">Metas específicas</h3>
                <p className="mt-0.5 text-xs text-text-muted">
                  Experiências especializadas com dados próprios desta área.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
            {visibleSpecificTypes.map((option) => {
              const Icon = option.icon;
              const unavailable = unavailableSpecificSources.includes(option.sourceKey);
              return (
                <button
                  key={option.sourceKey}
                  type="button"
                  disabled={unavailable}
                  onClick={() => {
                    setType('counter');
                    setSourceKey(option.sourceKey);
                    setLabel(option.label);
                    setGoalValue(option.defaultGoal);
                    setUnit(option.unit);
                    setPeriodKind('daily');
                    setPeriodAggregation('single');
                    setRecurrenceDays(
                      option.sourceKey === 'calories_burned' ? [1, 2, 3, 4, 5] : null,
                    );
                    if (option.sourceKey === 'calories_burned') {
                      setScoringMode('per_unit');
                    }
                    if (option.sourceKey === 'meal_diary') {
                      setMealDiaryConfig(defaultMealDiaryConfig());
                      setScoringMode('planned_items');
                    }
                    setHasSelectedType(true);
                    setError(null);
                  }}
                  className={[
                    'group flex min-h-40 flex-col rounded-xl border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
                    unavailable
                      ? 'cursor-not-allowed border-border bg-surface-2 opacity-50'
                      : 'border-border bg-surface-2 hover:border-brand-primary hover:bg-surface-3',
                  ].join(' ')}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                    <Icon size={21} aria-hidden />
                  </span>
                  <span className="mt-4 flex items-center justify-between gap-3">
                    <span className="font-semibold text-text-primary">{option.label}</span>
                    {!unavailable && (
                      <ChevronRight
                        size={18}
                        className="text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand-primary"
                        aria-hidden
                      />
                    )}
                  </span>
                  <span className="mt-1 text-sm leading-relaxed text-text-secondary">
                    {option.description}
                  </span>
                  <span className="mt-2 text-xs text-text-muted">
                    {unavailable ? 'Já existe uma meta ativa deste tipo.' : option.detail}
                  </span>
                </button>
              );
            })}
              </div>
            </>
          )}

          {visibleGenericTypes.length === 0 && visibleSpecificTypes.length === 0 && (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-sm font-medium text-text-primary">Nenhum tipo de meta encontrado</p>
              <p className="mt-1 text-xs text-text-muted">Tente buscar por outro termo.</p>
            </div>
          )}
        </section>

        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/habits-goals/config')}
          className="self-start"
        >
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && <Alert variant="danger">{error}</Alert>}

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Dados da meta</h2>

        {(requireTypeSelection || sourceKey) && selectedTypeDefinition && SelectedTypeIcon && (
          <div className="flex items-center gap-3 rounded-xl border border-brand-primary/30 bg-brand-primary/5 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
              <SelectedTypeIcon size={20} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-muted">Tipo de meta</p>
              <p className="font-medium text-text-primary">{selectedTypeDefinition.label}</p>
            </div>
            {requireTypeSelection && (
              <button
                type="button"
                onClick={() => setHasSelectedType(false)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-brand-primary hover:bg-brand-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <ArrowLeft size={14} aria-hidden />
                Trocar
              </button>
            )}
          </div>
        )}

        {sourceKey ? (
          <div>
            <p className="mb-1.5 text-sm font-medium text-text-primary">Nome da meta</p>
            <div className="rounded-lg border border-border bg-surface-3 px-3 py-2.5 text-sm text-text-secondary">
              {label}
            </div>
          </div>
        ) : (
          <Input
            label="Nome da meta *"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Beber 2L de água"
          />
        )}

        {!requireTypeSelection && !sourceKey && (
          <Select
            label="Tipo de tracker *"
            value={type}
            options={TYPE_OPTIONS}
            onChange={(v) => setType(v as TrackerType)}
          />
        )}

        {needsGoalValue && (
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                label={
                  sourceKey === 'calories_burned'
                    ? 'Meta diária *'
                    : sourceKey === 'water_consumed'
                      ? 'Meta diária de água *'
                      : sourceKey === 'meal_diary'
                        ? 'Meta diária (kcal) *'
                        : 'Valor alvo *'
                }
                type="number"
                value={goalValue}
                onChange={(e) => setGoalValue(e.target.value)}
                placeholder="Ex: 2000"
              />
            </div>
            <div className="flex-1">
              {sourceKey ? (
                <div>
                  <p className="mb-1.5 text-sm font-medium text-text-primary">Unidade</p>
                  <div className="rounded-lg border border-border bg-surface-3 px-3 py-2.5 text-sm text-text-secondary">
                    {unit}
                  </div>
                </div>
              ) : (
                <Input
                  label="Unidade"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="Ex: ml, min, km"
                />
              )}
            </div>
          </div>
        )}

        {sourceKey === 'meal_diary' && (
          <MealDiaryGoalConfig config={mealDiaryConfig} onChange={setMealDiaryConfig} />
        )}

        {sourceKey === 'calories_burned' && (
          <div className="rounded-xl border border-border bg-surface-3/60 px-3 py-2.5 text-xs text-text-secondary">
            A meta semanal será calculada pela meta diária × quantidade de dias selecionados no
            agendamento. O card fica disponível todos os dias para registro.
          </div>
        )}

        {type === 'boolean' && (
          <Input
            label="Unidade (opcional)"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Opcional"
          />
        )}

        {type === 'checklist' && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary">
              Itens da checklist
              <span className="ml-1 text-xs font-normal text-text-muted">(Enter salva e adiciona outro item)</span>
            </label>
            {checklistItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  ref={(el) => {
                    checklistLabelRefs.current[i] = el;
                  }}
                  value={item.label}
                  onChange={(e) => {
                    const updated = [...checklistItems];
                    updated[i] = { ...updated[i], label: e.target.value };
                    setChecklistItems(updated);
                  }}
                  onKeyDown={(e) => handleChecklistItemEnter(i, e)}
                  placeholder={`Item ${i + 1}`}
                />
                <input
                  type="number"
                  step="any"
                  value={item.points}
                  onChange={(e) => {
                    const updated = [...checklistItems];
                    updated[i] = { ...updated[i], points: Number(e.target.value) };
                    setChecklistItems(updated);
                  }}
                  onKeyDown={(e) => handleChecklistItemEnter(i, e)}
                  placeholder="pts"
                  className={`w-20 px-2 py-2 rounded-lg bg-surface-3 border border-border text-sm focus:outline-none focus:border-brand-primary text-center font-medium ${
                    item.points > 0 ? 'text-success' : item.points < 0 ? 'text-danger' : 'text-text-primary'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setChecklistItems((prev) => prev.filter((_, j) => j !== i))}
                  className="p-2 text-text-muted hover:text-danger transition-colors cursor-pointer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setChecklistItems((prev) => [...prev, { label: '', points: 0 }])}
              className="flex items-center gap-1.5 text-xs text-brand-primary hover:underline self-start cursor-pointer"
            >
              <Plus size={13} /> Adicionar item
            </button>
          </div>
        )}

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-text-primary">Meta ativa</p>
            <p className="text-xs text-text-muted">Exibir no dashboard diário</p>
          </div>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
      </section>

      {type !== 'checklist' && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Sistema de Pontuação</h2>
            <Switch checked={scoringEnabled} onCheckedChange={setScoringEnabled} />
          </div>

          {scoringEnabled && sourceKey === 'meal_diary' ? (
            <>
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 px-3 py-2.5 text-xs text-text-secondary">
                <p className="font-medium text-emerald-200/90">Aderência ao plano</p>
                <p className="mt-1 leading-relaxed">
                  Pontos do dia = proporção do plano cumprido × pontos configurados. Cada item do
                  plano pesa igual; consumo parcial vale pontos parciais. Substitutos contam para o
                  mesmo item. Refeições extras não pontuam, mas estourar as calorias livres da semana
                  aplica penalidade no dia do estouro.
                </p>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:gap-3">
                <div className="flex-1">
                  <FieldLabelWithHelp
                    htmlFor={pointsInputId}
                    text="Pontos (plano 100%)"
                    tooltip="Pontos ao cumprir todos os itens do plano no dia. Consumo parcial recebe a mesma fração."
                  />
                  <Input
                    id={pointsInputId}
                    type="number"
                    min={0}
                    step="any"
                    value={pointsValue}
                    onChange={(e) => setPointsValue(e.target.value)}
                    placeholder="Ex: 30"
                  />
                </div>
                <div className="flex-1">
                  <FieldLabelWithHelp
                    htmlFor={penaltyInputId}
                    text="Penalidade (estourar livres)"
                    tooltip="Pontos descontados no primeiro dia da semana em que as calorias livres forem ultrapassadas."
                  />
                  <Input
                    id={penaltyInputId}
                    type="number"
                    min={0}
                    step="any"
                    value={pointsOnMiss}
                    onChange={(e) => setPointsOnMiss(e.target.value)}
                    placeholder="Ex: 10"
                  />
                </div>
              </div>
            </>
          ) : scoringEnabled && sourceKey === 'calories_burned' ? (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:gap-3">
                <div className="flex-1">
                  <FieldLabelWithHelp
                    htmlFor={pointsInputId}
                    text="Pontos por kcal"
                    tooltip="Cada kcal registrada soma este valor aos pontos do dia."
                  />
                  <Input
                    id={pointsInputId}
                    type="number"
                    min={0}
                    step="any"
                    value={pointsValue}
                    onChange={(e) => setPointsValue(e.target.value)}
                    placeholder="Ex: 0.1"
                  />
                </div>
                <div className="flex-1">
                  <FieldLabelWithHelp
                    htmlFor={weeklyBonusInputId}
                    text="Bônus por meta semanal"
                    tooltip="Pontos extras concedidos uma única vez ao atingir a meta semanal (meta diária × dias ativos)."
                  />
                  <Input
                    id={weeklyBonusInputId}
                    type="number"
                    min={0}
                    step="any"
                    value={weeklyBonusPoints}
                    onChange={(e) => setWeeklyBonusPoints(e.target.value)}
                    placeholder="Ex: 50"
                  />
                </div>
              </div>
              <p className="text-xs text-text-muted">
                O bônus semanal é atribuído no primeiro dia em que o total da semana alcançar a meta e
                removido automaticamente se registros forem desfeitos.
              </p>
            </>
          ) : scoringEnabled && sourceKey !== 'meal_diary' ? (
            <>
              <Select
                label="Modo de pontuação"
                value={scoringMode}
                options={SCORING_MODE_OPTIONS}
                onChange={(v) => setScoringMode(v as ScoringMode)}
              />
              <div className="flex flex-col gap-4 sm:flex-row sm:gap-3">
                <div className="flex-1">
                  <FieldLabelWithHelp
                    htmlFor={pointsInputId}
                    text="Pontos"
                    tooltip="Valores positivos funcionam como recompensa ao cumprir a meta; valores negativos aplicam penalidade."
                  />
                  <Input
                    id={pointsInputId}
                    type="number"
                    step="any"
                    value={pointsValue}
                    onChange={(e) => setPointsValue(e.target.value)}
                    placeholder="Ex: 30 ou -20"
                  />
                </div>
                <div className="flex-1">
                  <FieldLabelWithHelp
                    htmlFor={penaltyInputId}
                    text="Penalidade"
                    tooltip="Opcional: pontos quando a meta não é concluída no dia (ex.: -10)."
                  />
                  <Input
                    id={penaltyInputId}
                    type="number"
                    step="any"
                    value={pointsOnMiss}
                    onChange={(e) => setPointsOnMiss(e.target.value)}
                    placeholder="Ex: -10"
                  />
                </div>
              </div>
            </>
          ) : null}
        </section>
      )}

      {!sourceKey && (
        <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Período</h2>
        <Select
          label="Frequência da meta"
          value={periodKind}
          options={PERIOD_KIND_OPTIONS}
          onChange={(v) => setPeriodKind(v as TrackerPeriodKind)}
        />
        {periodKind !== 'daily' && (
          <>
            <FieldLabelWithHelp
              text="Como contabilizar"
              tooltip={
                <>
                  <strong>Agregada:</strong> vários registos no período (ex.: km por dia; soma na semana).
                  <br />
                  <strong>Única:</strong> um registo por período (ex.: revisão semanal feita ou não).
                </>
              }
            />
            <div className="flex gap-2">
              {(
                [
                  { value: 'aggregate' as const, label: 'Agregada (soma)' },
                  { value: 'single' as const, label: 'Única (1 registo)' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPeriodAggregation(opt.value)}
                  className={`flex-1 rounded-lg py-2 px-2 text-xs font-medium transition-colors cursor-pointer ${
                    periodAggregation === opt.value
                      ? 'bg-brand-primary text-white'
                      : 'bg-surface-3 text-text-secondary hover:bg-surface-3/80'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {periodKind === 'weekly' && (
              <>
                <Select
                  label="Semana começa em"
                  value={String(weekStart)}
                  options={WEEK_START_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
                  onChange={(v) => setWeekStart(Number(v))}
                />
                <DatePicker
                  label="Data âncora (opcional)"
                  value={parseLocalDate(periodAnchorDate)}
                  onChange={(d) => setPeriodAnchorDate(d ? formatLocalDate(d) : '')}
                  clearable
                />
                <p className="text-xs text-text-muted -mt-2">
                  Avançado: alinhar ciclos a uma data fixa. Vazio = só o dia da semana acima.
                </p>
              </>
            )}
            {periodKind === 'custom' && (
              <div className="flex flex-col gap-4 sm:flex-row sm:gap-3">
                <div className="min-w-0 flex-1">
                  <DatePicker
                    label="Início do ciclo *"
                    value={parseLocalDate(periodAnchorDate)}
                    onChange={(d) => setPeriodAnchorDate(d ? formatLocalDate(d) : '')}
                    clearable={false}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Input
                    label="Duração (dias) *"
                    type="number"
                    min={2}
                    max={365}
                    value={periodLengthDays}
                    onChange={(e) => setPeriodLengthDays(e.target.value)}
                    placeholder="ex.: 14"
                  />
                </div>
              </div>
            )}
          </>
        )}
        </section>
      )}

      {/* Agendamento */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Agendamento</h2>

        {/* Dias da semana */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-secondary">
            Dias da semana
            <span className="ml-1 text-xs font-normal text-text-muted">
              {sourceKey === 'calories_burned'
                ? '(define a meta semanal — o card aparece todos os dias)'
                : '(opcional — padrão: todos os dias)'}
            </span>
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {WEEK_DAY_LABELS.map((label, dow) => {
              const isActive = recurrenceDays === null || recurrenceDays.includes(dow);
              return (
                <button
                  key={dow}
                  type="button"
                  onClick={() => toggleDay(dow)}
                  className={[
                    'w-10 h-10 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                    isActive
                      ? 'bg-brand-primary text-white'
                      : 'bg-surface-3 text-text-muted hover:bg-surface-4',
                  ].join(' ')}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {recurrenceDays !== null && (
            <button
              type="button"
              onClick={() => setRecurrenceDays(null)}
              className="text-xs text-brand-primary hover:underline self-start cursor-pointer"
            >
              Redefinir para todos os dias
            </button>
          )}
        </div>

        {/* Intervalo de datas */}
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-3">
          <div className="min-w-0 flex-1">
            <DatePicker
              label="Data de início (opcional)"
              value={startDateValue}
              onChange={(d) => setStartDate(d ? formatLocalDate(d) : '')}
              clearable
              helperText="Se vazio, a meta vale a partir do dia em que foi criada (não aparece em dias anteriores no histórico)."
            />
          </div>
          <div className="min-w-0 flex-1">
            <DatePicker
              label="Data de fim (opcional)"
              value={endDateValue}
              onChange={(d) => setEndDate(d ? formatLocalDate(d) : '')}
              clearable
              min={startDateValue}
            />
          </div>
        </div>
      </section>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={() => router.push('/habits-goals/config')} className="flex-1">
          Cancelar
        </Button>
        {isDirty ? (
          <Button type="submit" variant="primary" disabled={isLoading} className="flex-1">
            {isLoading ? 'Salvando…' : 'Salvar meta'}
          </Button>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-text-muted border border-transparent min-h-10">
            Nenhuma alteração
          </div>
        )}
      </div>
    </form>
  );
}
