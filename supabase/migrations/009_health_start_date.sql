-- ============================================================
-- Migration 009 — Adiciona start_date à health_settings
-- ============================================================

ALTER TABLE public.health_settings
  ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;

-- Recria a view para expor start_date (DROP necessário por mudança de colunas)
DROP VIEW IF EXISTS public.health_summary;
CREATE VIEW public.health_summary AS
SELECT
  s.user_id,
  s.start_weight,
  s.start_date,
  s.target_weight,
  s.target_date,
  s.height,
  latest.weight                                                               AS current_weight,
  latest.logged_at                                                            AS last_logged_at,
  s.start_weight - latest.weight                                              AS total_lost,
  latest.weight - s.target_weight                                             AS remaining,
  ROUND(
    ((s.start_weight - latest.weight) / NULLIF(s.start_weight - s.target_weight, 0)) * 100,
    1
  )                                                                           AS progress_percent,
  CASE WHEN s.height IS NOT NULL AND s.height > 0
    THEN ROUND(latest.weight / ((s.height::DECIMAL / 100) ^ 2), 1)
    ELSE NULL
  END                                                                         AS current_bmi
FROM public.health_settings s
JOIN LATERAL (
  SELECT weight, logged_at
  FROM public.weight_logs
  WHERE user_id = s.user_id
  ORDER BY logged_at DESC
  LIMIT 1
) latest ON TRUE;
