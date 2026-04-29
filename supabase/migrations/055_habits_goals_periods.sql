-- ============================================================
-- HÁBITOS E METAS — Períodos (diário / semanal / mensal / custom)
-- + RLS de logs por agregado vs único por período
-- + streak só para period_kind = daily
-- + slug do módulo daily-goals → habits-goals
-- ============================================================

ALTER TABLE public.trackers
  ADD COLUMN IF NOT EXISTS period_kind text NOT NULL DEFAULT 'daily'
    CHECK (period_kind IN ('daily', 'weekly', 'monthly', 'custom')),
  ADD COLUMN IF NOT EXISTS period_aggregation text NOT NULL DEFAULT 'single'
    CHECK (period_aggregation IN ('aggregate', 'single')),
  ADD COLUMN IF NOT EXISTS period_anchor_date date,
  ADD COLUMN IF NOT EXISTS period_length_days integer
    CHECK (period_length_days IS NULL OR (period_length_days >= 2 AND period_length_days <= 365)),
  ADD COLUMN IF NOT EXISTS week_start smallint NOT NULL DEFAULT 1
    CHECK (week_start >= 0 AND week_start <= 6);

COMMENT ON COLUMN public.trackers.period_kind IS
  'daily | weekly | monthly | custom — janela de avaliação da meta.';
COMMENT ON COLUMN public.trackers.period_aggregation IS
  'aggregate: vários logs no período (soma para counter/slider). single: um log por período (created_at = início do período).';
COMMENT ON COLUMN public.trackers.period_anchor_date IS
  'Para custom: data inicial do ciclo. Opcional para weekly.';
COMMENT ON COLUMN public.trackers.period_length_days IS
  'Para custom: duração do ciclo em dias (>=2).';
COMMENT ON COLUMN public.trackers.week_start IS
  '0=Dom … 6=Sáb — início da semana para period_kind weekly.';

-- Início do período que contém p_date (data civil no fuso do utilizador, passada pela app/RLS).
CREATE OR REPLACE FUNCTION public.tracker_period_start(p_tracker uuid, p_date date)
RETURNS date
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pk text;
  pa date;
  plen int;
  ws int;
  dow int;
  off int;
  epoch int;
BEGIN
  SELECT
    COALESCE(period_kind, 'daily'),
    period_anchor_date,
    period_length_days,
    COALESCE(week_start, 1)
  INTO pk, pa, plen, ws
  FROM public.trackers
  WHERE id = p_tracker;

  IF NOT FOUND THEN
    RETURN p_date;
  END IF;

  IF pk = 'daily' THEN
    RETURN p_date;
  END IF;

  IF pk = 'weekly' THEN
    dow := EXTRACT(DOW FROM p_date)::int;
    off := (dow - ws + 7) % 7;
    RETURN p_date - off;
  END IF;

  IF pk = 'monthly' THEN
    RETURN date_trunc('month', p_date)::date;
  END IF;

  -- custom
  IF pa IS NULL OR plen IS NULL OR plen < 1 THEN
    RETURN p_date;
  END IF;
  epoch := FLOOR((p_date - pa) / plen)::int;
  RETURN pa + (epoch * plen);
END;
$$;

REVOKE ALL ON FUNCTION public.tracker_period_start(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tracker_period_start(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tracker_period_start(uuid, date) TO service_role;

-- ---------------------------------------------------------------------------
-- RLS logs: aggregate → só created_at = "hoje" (perfil). single → created_at = início do período corrente.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "logs: insert apenas hoje" ON public.logs;
DROP POLICY IF EXISTS "logs: update apenas hoje" ON public.logs;
DROP POLICY IF EXISTS "logs: delete apenas hoje" ON public.logs;

CREATE POLICY "logs: insert period rules"
  ON public.logs FOR INSERT
  WITH CHECK (
    tracker_id IN (
      SELECT id FROM public.trackers
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
    AND (
      (
        (SELECT period_aggregation FROM public.trackers t WHERE t.id = tracker_id) = 'aggregate'
        AND created_at = (
          NOW() AT TIME ZONE (
            SELECT COALESCE(timezone, 'UTC') FROM public.profiles WHERE id = auth.uid()
          )
        )::date
      )
      OR (
        (SELECT period_aggregation FROM public.trackers t WHERE t.id = tracker_id) = 'single'
        AND created_at = public.tracker_period_start(
          tracker_id,
          (
            NOW() AT TIME ZONE (
              SELECT COALESCE(timezone, 'UTC') FROM public.profiles WHERE id = auth.uid()
            )
          )::date
        )
      )
    )
  );

CREATE POLICY "logs: update period rules"
  ON public.logs FOR UPDATE
  USING (
    tracker_id IN (
      SELECT id FROM public.trackers
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
    AND (
      (
        (SELECT period_aggregation FROM public.trackers t WHERE t.id = tracker_id) = 'aggregate'
        AND created_at = (
          NOW() AT TIME ZONE (
            SELECT COALESCE(timezone, 'UTC') FROM public.profiles WHERE id = auth.uid()
          )
        )::date
      )
      OR (
        (SELECT period_aggregation FROM public.trackers t WHERE t.id = tracker_id) = 'single'
        AND created_at = public.tracker_period_start(
          tracker_id,
          (
            NOW() AT TIME ZONE (
              SELECT COALESCE(timezone, 'UTC') FROM public.profiles WHERE id = auth.uid()
            )
          )::date
        )
      )
    )
  );

CREATE POLICY "logs: delete period rules"
  ON public.logs FOR DELETE
  USING (
    tracker_id IN (SELECT id FROM public.trackers WHERE user_id = auth.uid())
    AND (
      (
        (SELECT period_aggregation FROM public.trackers t WHERE t.id = tracker_id) = 'aggregate'
        AND created_at = (
          NOW() AT TIME ZONE (
            SELECT COALESCE(timezone, 'UTC') FROM public.profiles WHERE id = auth.uid()
          )
        )::date
      )
      OR (
        (SELECT period_aggregation FROM public.trackers t WHERE t.id = tracker_id) = 'single'
        AND created_at = public.tracker_period_start(
          tracker_id,
          (
            NOW() AT TIME ZONE (
              SELECT COALESCE(timezone, 'UTC') FROM public.profiles WHERE id = auth.uid()
            )
          )::date
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Streak: apenas metas diárias
-- ---------------------------------------------------------------------------
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
    AND t.period_kind = 'daily'
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

ALTER VIEW public.current_streaks SET (security_invoker = true);

-- ---------------------------------------------------------------------------
-- Módulo no portal
-- ---------------------------------------------------------------------------
UPDATE public.modules
SET
  slug        = 'habits-goals',
  label       = 'Hábitos e Metas',
  description = 'Hábitos diários, metas semanais e mensais — em um só lugar.'
WHERE slug = 'daily-goals';
