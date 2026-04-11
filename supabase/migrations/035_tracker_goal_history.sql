-- ============================================================
-- NEXUS DAILY GOALS — Histórico de Metas (Goal History)
-- Permite alterar o goal_value a partir de uma data específica
-- sem afetar o histórico anterior
-- ============================================================

-- Tabela de histórico de metas
CREATE TABLE IF NOT EXISTS public.tracker_goal_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id      UUID NOT NULL REFERENCES public.trackers(id) ON DELETE CASCADE,
  effective_date  DATE NOT NULL,  -- Data em que esta meta entra em vigor
  goal_value      NUMERIC NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tracker_goal_history_tracker_id ON public.tracker_goal_history(tracker_id);
CREATE INDEX IF NOT EXISTS idx_tracker_goal_history_effective_date ON public.tracker_goal_history(effective_date);

-- Constraint: uma meta por tracker por data (evita duplicatas)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracker_goal_history_unique_date 
  ON public.tracker_goal_history(tracker_id, effective_date);

-- Row Level Security
ALTER TABLE public.tracker_goal_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tracker_goal_history: acesso do dono via tracker" ON public.tracker_goal_history;
CREATE POLICY "tracker_goal_history: acesso do dono via tracker"
  ON public.tracker_goal_history
  USING (tracker_id IN (SELECT id FROM public.trackers WHERE user_id = auth.uid()))
  WITH CHECK (tracker_id IN (SELECT id FROM public.trackers WHERE user_id = auth.uid()));

-- ============================================================
-- FUNÇÃO: Obter goal_value válido para uma data específica
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_tracker_goal_value(
  p_tracker_id UUID,
  p_date DATE
) RETURNS NUMERIC AS $$
DECLARE
  v_history_value NUMERIC;
  v_current_value NUMERIC;
BEGIN
  -- Busca o valor mais recente no histórico até a data especificada
  SELECT goal_value INTO v_history_value
  FROM public.tracker_goal_history
  WHERE tracker_id = p_tracker_id
    AND effective_date <= p_date
  ORDER BY effective_date DESC
  LIMIT 1;
  
  -- Se não encontrou no histórico, usa o valor atual do tracker
  IF v_history_value IS NULL THEN
    SELECT goal_value INTO v_current_value
    FROM public.trackers
    WHERE id = p_tracker_id;
    
    RETURN v_current_value;
  END IF;
  
  RETURN v_history_value;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- FUNÇÃO/TRIGGER: Salvar goal_value anterior no histórico
-- ============================================================
CREATE OR REPLACE FUNCTION public.save_goal_value_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Só salva no histórico se o goal_value mudou
  IF OLD.goal_value IS DISTINCT FROM NEW.goal_value THEN
    -- Salva o VALOR ANTIGO no histórico com a data de hoje
    -- Isso significa: o valor antigo valia até ontem
    -- O novo valor (NEW.goal_value) passa a valer a partir de hoje
    INSERT INTO public.tracker_goal_history (tracker_id, effective_date, goal_value)
    VALUES (OLD.id, CURRENT_DATE, OLD.goal_value)
    ON CONFLICT (tracker_id, effective_date) 
    DO UPDATE SET goal_value = OLD.goal_value,
                  created_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cria o trigger na tabela trackers
DROP TRIGGER IF EXISTS trg_save_goal_history ON public.trackers;
CREATE TRIGGER trg_save_goal_history
  BEFORE UPDATE ON public.trackers
  FOR EACH ROW
  EXECUTE FUNCTION public.save_goal_value_history();

-- ============================================================
-- VIEW ATUALIZADA: current_streaks — usa goal_value histórico
-- ============================================================
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

-- ============================================================
-- FUNÇÃO AUXILIAR: Copiar goal_value atual para histórico
-- (executar uma vez para popular o histórico com dados existentes)
-- ============================================================
COMMENT ON FUNCTION public.get_tracker_goal_value IS 
'Retorna o goal_value de um tracker válido para uma data específica, considerando o histórico de alterações.';
