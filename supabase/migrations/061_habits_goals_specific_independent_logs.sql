-- Clarify that specific trackers mirror specialized experiences but own their data.

COMMENT ON COLUMN public.trackers.source_key IS
  'Null for generic goals. Specific goals use specialized UI and keep independent tracker logs.';
