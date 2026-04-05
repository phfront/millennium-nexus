export type HealthSettings = {
  user_id: string;
  start_weight: number;
  start_date: string; // 'YYYY-MM-DD' — data em que a jornada começou
  target_weight: number;
  target_date: string; // 'YYYY-MM-DD'
  height: number | null; // cm
  created_at: string;
  updated_at: string;
};

export type WeightLog = {
  id: string;
  user_id: string;
  weight: number; // kg, 1 casa decimal
  logged_at: string; // 'YYYY-MM-DD'
  note: string | null;
  created_at: string;
};

export type HealthSummary = {
  user_id: string;
  start_weight: number;
  start_date: string; // 'YYYY-MM-DD'
  target_weight: number;
  target_date: string;
  height: number | null;
  current_weight: number;
  last_logged_at: string;
  total_lost: number;
  remaining: number;
  progress_percent: number;
  current_bmi: number | null;
};

export type FeasibilityLevel = 'safe' | 'moderate' | 'aggressive' | 'unfeasible';

export type FeasibilityResult = {
  level: FeasibilityLevel;
  weeklyRateNeeded: number; // kg/semana
  message: string;
};
