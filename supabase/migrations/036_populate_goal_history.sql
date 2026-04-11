-- ============================================================
-- NEXUS DAILY GOALS — Popular histórico de metas existentes
-- Cria uma entrada no histórico para trackers existentes com
-- goal_value, garantindo que o histórico funcione corretamente
-- ============================================================

-- Insere o valor atual de todos os trackers no histórico com uma data antiga
-- Isso garante que, mesmo que o tracker seja atualizado, o valor antigo
-- permanece registrado para o histórico
INSERT INTO public.tracker_goal_history (tracker_id, effective_date, goal_value)
SELECT 
  id as tracker_id,
  '2000-01-01'::DATE as effective_date,  -- Data antiga para não interferir
  goal_value
FROM public.trackers
WHERE goal_value IS NOT NULL
ON CONFLICT (tracker_id, effective_date) DO NOTHING;

COMMENT ON TABLE public.tracker_goal_history IS 
'Histórico de valores de meta (goal_value) por data. O valor com a effective_date mais recente (e <= data desejada) é o que vale para essa data.';
