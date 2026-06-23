-- Weekly completion bonus for specific calorie goals.

ALTER TABLE public.trackers
  ADD COLUMN IF NOT EXISTS weekly_bonus_points numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.trackers.weekly_bonus_points IS
  'Fixed bonus awarded once when a calories_burned tracker reaches its weekly target.';
