-- ============================================================
-- NEXUS LEARNING MODULE — Adicionar module_day para calendário
-- ============================================================

-- Adicionar coluna module_day para controlar o dia dentro do módulo
ALTER TABLE public.learning_plan_days 
  ADD COLUMN module_day INTEGER;

-- Comentário explicativo
COMMENT ON COLUMN public.learning_plan_days.module_day IS 
  'Dia dentro do módulo/seção (para planos tipo calendário). Ex: Dia 3 da Semana 1';

-- Índice para ordenação eficiente por módulo
CREATE INDEX idx_learning_plan_days_module_day ON public.learning_plan_days(section_id, module_day);
