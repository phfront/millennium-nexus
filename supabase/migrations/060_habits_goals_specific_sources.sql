-- Habits & Goals: trackers backed by data from other modules.

ALTER TABLE public.trackers
  ADD COLUMN IF NOT EXISTS source_key text
    CHECK (source_key IS NULL OR source_key IN ('water_consumed', 'calories_burned'));

COMMENT ON COLUMN public.trackers.source_key IS
  'Null for generic goals. Specific goals use specialized UI and keep independent tracker logs.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_trackers_active_specific_source
  ON public.trackers (user_id, source_key)
  WHERE source_key IS NOT NULL AND active = TRUE AND deleted_at IS NULL;
