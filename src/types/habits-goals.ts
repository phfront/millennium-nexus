export type TrackerType = 'counter' | 'slider' | 'checklist' | 'boolean';
export type ScoringMode = 'completion' | 'per_unit';
export type NotificationType = 'interval' | 'fixed_time' | 'reminder';
export type TrackerPeriodKind = 'daily' | 'weekly' | 'monthly' | 'custom';
export type TrackerPeriodAggregation = 'aggregate' | 'single';

export type ChecklistItem = {
  label: string;
  points: number;
};

export type Tracker = {
  id: string;
  user_id: string;
  label: string;
  type: TrackerType;
  goal_value: number | null;
  unit: string | null;
  checklist_items: ChecklistItem[] | null;
  active: boolean;
  sort_order: number;
  scoring_enabled: boolean;
  scoring_mode: ScoringMode | null;
  points_value: number;
  points_on_miss: number | null;
  /** Dias da semana em que a meta deve aparecer (0=Dom … 6=Sáb). null = todos os dias. */
  recurrence_days: number[] | null;
  /** Data de início (ISO 'YYYY-MM-DD'). null = contar a partir do dia de criação da meta. */
  start_date: string | null;
  /** Data de fim (ISO 'YYYY-MM-DD'). null = sem restrição de fim. */
  end_date: string | null;
  /** Preenchido quando a meta foi removida (histórico de logs preservado). */
  deleted_at: string | null;
  created_at: string;
  period_kind: TrackerPeriodKind;
  period_aggregation: TrackerPeriodAggregation;
  period_anchor_date: string | null;
  period_length_days: number | null;
  /** 0=Dom … 6=Sáb — início da semana (weekly). */
  week_start: number;
};

export type Log = {
  id: string;
  tracker_id: string;
  value: number | null;
  checked_items: boolean[] | null;
  note: string | null;
  points_earned: number;
  created_at: string;
};

export type TrackerWithLog = Tracker & {
  log: Log | null;
};

export type TrackerNotification = {
  id: string;
  tracker_id: string;
  type: NotificationType;
  frequency_minutes: number | null;
  window_start: string | null;
  window_end: string | null;
  scheduled_times: string[] | null;
  target_time: string | null;
  lead_time: number | null;
  enabled: boolean;
  created_at: string;
};

export type DayCompletionData = {
  date: string;
  /** % de metas concluídas no dia */
  percent: number;
  pointsEarned: number;
  pointsMax: number;
  /** % dos pontos possíveis; 0 se pointsMax === 0 */
  pointsPercent: number;
};
