-- ============================================================
-- NEXUS DAILY GOALS — Agendamento de Trackers
-- Adiciona suporte a recorrência semanal e intervalo de datas
-- ============================================================

-- Novos campos na tabela trackers:
--   recurrence_days  SMALLINT[]  NULL = toda semana (todo dia)
--                                [0..6] = dias da semana (0=Dom, 1=Seg, …, 6=Sáb)
--   start_date       DATE        NULL = sem data de início
--   end_date         DATE        NULL = sem data de fim

ALTER TABLE public.trackers
  ADD COLUMN recurrence_days SMALLINT[],
  ADD COLUMN start_date      DATE,
  ADD COLUMN end_date        DATE;

-- ============================================================
-- VIEW: current_streaks — atualizada para respeitar agendamento
-- Um dia "perfeito" agora leva em conta apenas trackers que:
--   1. estão ativos
--   2. têm esse dia dentro do intervalo start_date..end_date (se definido)
--   3. têm esse dia da semana em recurrence_days (se definido)
-- ============================================================
CREATE OR REPLACE VIEW public.current_streaks AS
WITH daily_completion AS (
  SELECT
    t.user_id,
    l.created_at                                     AS log_date,
    COUNT(DISTINCT t.id) FILTER (WHERE
      (t.type IN ('counter', 'slider') AND l.value >= t.goal_value)
      OR (t.type = 'boolean'   AND l.value = 1)
      OR (t.type = 'checklist' AND NOT (l.checked_items @> '[false]'::jsonb))
    )                                                AS completed_count,
    COUNT(DISTINCT t.id)                             AS total_count
  FROM public.trackers t
  LEFT JOIN public.logs l ON l.tracker_id = t.id
  WHERE
    t.active = TRUE
    -- respeitar start_date
    AND (t.start_date IS NULL OR l.created_at >= t.start_date)
    -- respeitar end_date
    AND (t.end_date   IS NULL OR l.created_at <= t.end_date)
    -- respeitar recurrence_days
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
