-- ============================================================
-- NEXUS DAILY GOALS — Exclusão lógica de metas (trackers)
-- Preserva logs e tracker_goal_history; impede novos registros
-- ============================================================

ALTER TABLE public.trackers
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.trackers.deleted_at IS
  'Preenchido quando a meta é removida pelo utilizador. Logs e histórico de metas mantêm-se.';

CREATE INDEX IF NOT EXISTS idx_trackers_user_active_not_deleted
  ON public.trackers (user_id)
  WHERE deleted_at IS NULL;

-- Logs: não permitir INSERT/UPDATE em metas removidas
DROP POLICY IF EXISTS "logs: insert apenas hoje" ON public.logs;
DROP POLICY IF EXISTS "logs: update apenas hoje" ON public.logs;

CREATE POLICY "logs: insert apenas hoje"
  ON public.logs FOR INSERT
  WITH CHECK (
    tracker_id IN (
      SELECT id FROM public.trackers
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
    AND created_at = (
      NOW() AT TIME ZONE (
        SELECT COALESCE(timezone, 'UTC')
        FROM public.profiles
        WHERE id = auth.uid()
      )
    )::date
  );

CREATE POLICY "logs: update apenas hoje"
  ON public.logs FOR UPDATE
  USING (
    tracker_id IN (
      SELECT id FROM public.trackers
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
    AND created_at = (
      NOW() AT TIME ZONE (
        SELECT COALESCE(timezone, 'UTC')
        FROM public.profiles
        WHERE id = auth.uid()
      )
    )::date
  );

-- Streaks: metas removidas não entram no cálculo atual
CREATE OR REPLACE VIEW public.current_streaks AS
WITH daily_completion AS (
  SELECT
    t.user_id,
    l.created_at                                     AS log_date,
    COUNT(DISTINCT t.id) FILTER (WHERE
      (t.type IN ('counter', 'slider') AND l.value >= public.get_tracker_goal_value(t.id, l.created_at))
      OR (t.type = 'boolean'   AND l.value = 1)
      OR (t.type = 'checklist' AND NOT (l.checked_items @> '[false]'::jsonb))
    )                                                AS completed_count,
    COUNT(DISTINCT t.id)                             AS total_count
  FROM public.trackers t
  LEFT JOIN public.logs l ON l.tracker_id = t.id
  WHERE
    t.active = TRUE
    AND t.deleted_at IS NULL
    AND (t.start_date IS NULL OR l.created_at >= t.start_date)
    AND (t.end_date   IS NULL OR l.created_at <= t.end_date)
    AND (
      t.recurrence_days IS NULL
      OR EXTRACT(DOW FROM l.created_at)::SMALLINT = ANY(t.recurrence_days)
    )
  GROUP BY t.user_id, l.created_at
),
perfect_days AS (
  SELECT user_id, log_date
  FROM daily_completion
  WHERE completed_count = total_count AND total_count > 0
),
streak_calc AS (
  SELECT
    user_id,
    log_date,
    log_date - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY log_date))::INTEGER AS streak_group
  FROM perfect_days
)
SELECT
  user_id,
  COUNT(*) AS current_streak
FROM streak_calc
WHERE streak_group = (
  SELECT MAX(streak_group) FROM streak_calc sc2 WHERE sc2.user_id = streak_calc.user_id
)
GROUP BY user_id;
