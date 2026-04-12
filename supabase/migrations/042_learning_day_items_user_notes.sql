-- ============================================================
-- NEXUS LEARNING MODULE — Migration 042
-- Adiciona campo de anotações do usuário por tarefa
-- ============================================================

ALTER TABLE public.learning_day_items
ADD COLUMN user_notes TEXT;
