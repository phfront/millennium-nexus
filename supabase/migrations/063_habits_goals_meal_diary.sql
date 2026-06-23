-- Meal diary specific tracker: plan in source_config, logs in tracker_logs.note.

ALTER TABLE public.trackers
  ADD COLUMN IF NOT EXISTS source_config jsonb;

COMMENT ON COLUMN public.trackers.source_config IS
  'JSON config for specific trackers (e.g. meal_diary planned meals).';

ALTER TABLE public.trackers
  DROP CONSTRAINT IF EXISTS trackers_source_key_check;

ALTER TABLE public.trackers
  ADD CONSTRAINT trackers_source_key_check
    CHECK (source_key IS NULL OR source_key IN ('water_consumed', 'calories_burned', 'meal_diary'));

COMMENT ON COLUMN public.trackers.source_key IS
  'Null for generic goals. meal_diary = independent food diary using foods catalog.';
