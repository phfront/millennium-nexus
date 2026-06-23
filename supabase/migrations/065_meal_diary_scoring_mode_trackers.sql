-- Aplica scoring_mode planned_items às metas de diário alimentar existentes.

UPDATE public.trackers
SET scoring_mode = 'planned_items'
WHERE source_key = 'meal_diary'
  AND scoring_mode IS DISTINCT FROM 'planned_items';
