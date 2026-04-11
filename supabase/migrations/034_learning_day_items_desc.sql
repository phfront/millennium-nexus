-- ============================================================
-- NEXUS LEARNING MODULE — Migration 034
-- Adiciona campo de descrição/markdown para as tarefas do dia
-- ============================================================

ALTER TABLE public.learning_day_items 
ADD COLUMN description TEXT;
