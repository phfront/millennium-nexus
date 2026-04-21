'use client';

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
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
import { CircleHelp, Plus, Trash2 } from 'lucide-react';
import type { Tracker, TrackerType, ScoringMode, ChecklistItem } from '@/types/daily-goals';
import { WEEK_DAY_LABELS } from '@/lib/daily-goals/scheduling';

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
  goalValue: string;
  unit: string;
  active: boolean;
  checklistItems: ChecklistItem[];
  scoringEnabled: boolean;
  scoringMode: ScoringMode;
  pointsValue: string;
  pointsOnMiss: string;
  recurrenceDays: number[] | null;
  startDate: string;
  endDate: string;
  sort_order: number;
};

function buildPayload(s: FormPayloadSource): TrackerPayload {
  const needsGoalValue = s.type === 'counter' || s.type === 'slider';
  return {
    label: s.label.trim(),
    type: s.type,
    goal_value: needsGoalValue ? Number(s.goalValue) : null,
    unit: s.unit.trim() || null,
    active: s.active,
    checklist_items: s.type === 'checklist' ? s.checklistItems.filter((i) => i.label.trim()) : null,
    sort_order: s.sort_order,
    scoring_enabled:
      s.type === 'checklist'
        ? s.checklistItems.some((i) => i.label.trim() && i.points !== 0)
        : s.scoringEnabled,
    scoring_mode: s.scoringEnabled ? s.scoringMode : null,
    points_value: s.scoringEnabled ? Number(s.pointsValue) : 0,
    points_on_miss: s.scoringEnabled && s.pointsOnMiss ? Number(s.pointsOnMiss) : null,
    recurrence_days: s.recurrenceDays,
    start_date: s.startDate || null,
    end_date: s.endDate || null,
  };
}

function initialToFormSource(initial?: Partial<Tracker>): FormPayloadSource {
  return {
    label: initial?.label ?? '',
    type: initial?.type ?? 'counter',
    goalValue: String(initial?.goal_value ?? ''),
    unit: initial?.unit ?? '',
    active: initial?.active ?? true,
    checklistItems:
      initial?.checklist_items == null
        ? [{ label: '', points: 0 }]
        : initial.checklist_items.map((c) => ({ ...c })),
    scoringEnabled: initial?.scoring_enabled ?? false,
    scoringMode: initial?.scoring_mode ?? 'completion',
    pointsValue: String(initial?.points_value ?? 0),
    pointsOnMiss: initial?.points_on_miss != null ? String(initial.points_on_miss) : '',
    recurrenceDays: initial?.recurrence_days ?? null,
    startDate: initial?.start_date ?? '',
    endDate: initial?.end_date ?? '',
    sort_order: initial?.sort_order ?? 0,
  };
}

interface GoalFormProps {
  initial?: Partial<Tracker>;
  onSubmit: (data: TrackerPayload) => Promise<void>;
}

const TYPE_OPTIONS = [
  { value: 'counter', label: 'Contador (incremento/decremento)' },
  { value: 'slider', label: 'Slider (range)' },
  { value: 'checklist', label: 'Checklist (lista de itens)' },
  { value: 'boolean', label: 'Sim/Não (feito ou não)' },
];

const SCORING_MODE_OPTIONS = [
  { value: 'completion', label: 'Conclusão (pontos fixos ao atingir a meta)' },
  { value: 'per_unit', label: 'Por unidade (pontos × valor registrado)' },
];

export function GoalForm({ initial, onSubmit }: GoalFormProps) {
  const router = useRouter();
  const pointsInputId = useId();
  const penaltyInputId = useId();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState(initial?.label ?? '');
  const [type, setType] = useState<TrackerType>(initial?.type ?? 'counter');
  const [goalValue, setGoalValue] = useState(String(initial?.goal_value ?? ''));
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [active, setActive] = useState(initial?.active ?? true);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(
    initial?.checklist_items ?? [{ label: '', points: 0 }],
  );

  const [scoringEnabled, setScoringEnabled] = useState(initial?.scoring_enabled ?? false);
  const [scoringMode, setScoringMode] = useState<ScoringMode>(initial?.scoring_mode ?? 'completion');
  const [pointsValue, setPointsValue] = useState(String(initial?.points_value ?? 0));
  const [pointsOnMiss, setPointsOnMiss] = useState(String(initial?.points_on_miss ?? ''));

  // Agendamento
  const [recurrenceDays, setRecurrenceDays] = useState<number[] | null>(initial?.recurrence_days ?? null);
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');

  const initialKey = initial?.id ?? '__new__';
  const [baselineStr, setBaselineStr] = useState(() =>
    JSON.stringify(buildPayload(initialToFormSource(initial))),
  );

  useEffect(() => {
    setBaselineStr(JSON.stringify(buildPayload(initialToFormSource(initial))));
  }, [initialKey]);

  const currentPayload = useMemo(
    () =>
      buildPayload({
        label,
        type,
        goalValue,
        unit,
        active,
        checklistItems,
        scoringEnabled,
        scoringMode,
        pointsValue,
        pointsOnMiss,
        recurrenceDays,
        startDate,
        endDate,
        sort_order: initial?.sort_order ?? 0,
      }),
    [
      label,
      type,
      goalValue,
      unit,
      active,
      checklistItems,
      scoringEnabled,
      scoringMode,
      pointsValue,
      pointsOnMiss,
      recurrenceDays,
      startDate,
      endDate,
      initial?.sort_order,
    ],
  );

  const isDirty = JSON.stringify(currentPayload) !== baselineStr;

  const needsGoalValue = type === 'counter' || type === 'slider';

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isDirty) return;
    if (!label.trim()) { setError('O nome da meta é obrigatório.'); return; }
    if (needsGoalValue && !goalValue) { setError('A meta precisa de um valor alvo.'); return; }

    setIsLoading(true);
    setError(null);
    try {
      await onSubmit(currentPayload);
      router.push('/daily-goals/config');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && <Alert variant="danger">{error}</Alert>}

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Dados da meta</h2>

        <Input
          label="Nome da meta *"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex: Beber 2L de água"
        />

        <Select
          label="Tipo de tracker *"
          value={type}
          options={TYPE_OPTIONS}
          onChange={(v) => setType(v as TrackerType)}
        />

        {needsGoalValue && (
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                label="Valor alvo *"
                type="number"
                value={goalValue}
                onChange={(e) => setGoalValue(e.target.value)}
                placeholder="Ex: 2000"
              />
            </div>
            <div className="flex-1">
              <Input
                label="Unidade"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Ex: ml, min, km"
              />
            </div>
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
            <label className="text-sm font-medium text-text-secondary">Itens da checklist</label>
            {checklistItems.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  value={item.label}
                  onChange={(e) => {
                    const updated = [...checklistItems];
                    updated[i] = { ...updated[i], label: e.target.value };
                    setChecklistItems(updated);
                  }}
                  placeholder={`Item ${i + 1}`}
                />
                <input
                  type="number"
                  value={item.points}
                  onChange={(e) => {
                    const updated = [...checklistItems];
                    updated[i] = { ...updated[i], points: Number(e.target.value) };
                    setChecklistItems(updated);
                  }}
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

          {scoringEnabled && (
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
                    value={pointsOnMiss}
                    onChange={(e) => setPointsOnMiss(e.target.value)}
                    placeholder="Ex: -10"
                  />
                </div>
              </div>
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
            <span className="ml-1 text-xs font-normal text-text-muted">(opcional — padrão: todos os dias)</span>
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
        <Button type="button" variant="ghost" onClick={() => router.push('/daily-goals/config')} className="flex-1">
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
