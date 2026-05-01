export type CaloriasSettings = {
  user_id: string;
  daily_target_kcal: number;
  /** Bitmask: bit 0 = Mon … bit 6 = Sun */
  active_days: number;
  created_at: string;
  updated_at: string;
};

export type CaloriasLog = {
  id: string;
  user_id: string;
  logged_date: string;
  amount_kcal: number;
  note: string | null;
  logged_at: string;
};
