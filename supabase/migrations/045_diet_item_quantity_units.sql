-- ============================================================
-- Migration 045 — Adicionar quantity_units aos itens da dieta
-- ============================================================
-- Permite especificar quantas unidades de um alimento consumir
-- (ex: 3x Ovo frito de 50g cada). Default 1 para retrocompat.

ALTER TABLE public.diet_plan_meal_items
  ADD COLUMN IF NOT EXISTS quantity_units SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE public.diet_logs
  ADD COLUMN IF NOT EXISTS quantity_units SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE public.food_substitutions
  ADD COLUMN IF NOT EXISTS substitute_quantity_units SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS serving_unit TEXT NOT NULL DEFAULT 'g';

ALTER TABLE public.diet_logs
  ADD COLUMN IF NOT EXISTS serving_unit TEXT NOT NULL DEFAULT 'g';

ALTER TABLE public.diet_logs
  ADD COLUMN IF NOT EXISTS meal_target_time TIME;
