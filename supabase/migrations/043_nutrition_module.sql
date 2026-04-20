-- ============================================================
-- Migration 043 — Nexus Health: Nutrição & Dieta (idempotente)
-- ============================================================

-- -------------------------------------------------------
-- 1. FOODS — catálogo de alimentos (globais + per-user)
--    user_id IS NULL => global (admin-only edit)
--    user_id = UUID  => privado do utilizador
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.foods (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = global
  name             TEXT NOT NULL,
  kcal_per_100g    DECIMAL(7,2) NOT NULL DEFAULT 0,
  protein_per_100g DECIMAL(7,2) NOT NULL DEFAULT 0,
  carbs_per_100g   DECIMAL(7,2) NOT NULL DEFAULT 0,
  fat_per_100g     DECIMAL(7,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Unique por escopo (global vs per-user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_foods_global_name
  ON public.foods (LOWER(name)) WHERE user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_foods_user_name
  ON public.foods (user_id, LOWER(name)) WHERE user_id IS NOT NULL;

-- -------------------------------------------------------
-- 2. DIET_SETTINGS — configurações do utilizador (1:1)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diet_settings (
  user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_kcal_target    INTEGER NOT NULL DEFAULT 2000,
  weekly_extra_buffer  INTEGER NOT NULL DEFAULT 0,
  daily_water_target_ml INTEGER NOT NULL DEFAULT 2500,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------
-- 3. DIET_PLANS — planos de dieta (apenas 1 ativo por user)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diet_plans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_diet_plans_active
  ON public.diet_plans (user_id) WHERE is_active = true;

-- -------------------------------------------------------
-- 4. DIET_PLAN_MEALS — refeições dentro de um plano
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diet_plan_meals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES public.diet_plans(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  target_time TIME
);

CREATE INDEX IF NOT EXISTS idx_diet_plan_meals_plan
  ON public.diet_plan_meals (plan_id, sort_order);

-- -------------------------------------------------------
-- 5. DIET_PLAN_MEAL_ITEMS — alimentos dentro de uma refeição
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diet_plan_meal_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id     UUID NOT NULL REFERENCES public.diet_plan_meals(id) ON DELETE CASCADE,
  food_id     UUID NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  quantity_g  DECIMAL(7,2) NOT NULL DEFAULT 100,
  sort_order  SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_diet_plan_meal_items_meal
  ON public.diet_plan_meal_items (meal_id, sort_order);

-- -------------------------------------------------------
-- 6. FOOD_SUBSTITUTIONS — substituições permitidas
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.food_substitutions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_item_id      UUID NOT NULL REFERENCES public.diet_plan_meal_items(id) ON DELETE CASCADE,
  substitute_food_id    UUID NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  substitute_quantity_g DECIMAL(7,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_food_substitutions_item
  ON public.food_substitutions (original_item_id);

-- -------------------------------------------------------
-- 7. DIET_LOGS — snapshot diário (histórico imutável)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diet_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_name   TEXT NOT NULL,
  food_name   TEXT NOT NULL,
  quantity_g  DECIMAL(7,2) NOT NULL,
  kcal        DECIMAL(7,2) NOT NULL,
  protein     DECIMAL(7,2) NOT NULL,
  carbs       DECIMAL(7,2) NOT NULL,
  fat         DECIMAL(7,2) NOT NULL,
  is_extra    BOOLEAN NOT NULL DEFAULT false,
  checked_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índices otimizados para queries frequentes
CREATE INDEX IF NOT EXISTS idx_diet_logs_user_date
  ON public.diet_logs (user_id, logged_date DESC);
CREATE INDEX IF NOT EXISTS idx_diet_logs_user_date_extra
  ON public.diet_logs (user_id, logged_date) WHERE is_extra = true;

-- -------------------------------------------------------
-- 8. WATER_LOGS — registros de ingestão de água
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.water_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_ml   INTEGER NOT NULL,
  logged_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_water_logs_user_date
  ON public.water_logs (user_id, logged_date DESC);

-- ============================================================
-- RLS — Row Level Security
-- ============================================================

ALTER TABLE public.foods               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_plan_meals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_plan_meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_substitutions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_logs          ENABLE ROW LEVEL SECURITY;

-- == FOODS: leitura global + privados; escrita global = admin, privados = owner ==

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'foods' AND policyname = 'foods_select') THEN
    CREATE POLICY "foods_select" ON public.foods
      FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'foods' AND policyname = 'foods_insert') THEN
    CREATE POLICY "foods_insert" ON public.foods
      FOR INSERT WITH CHECK (
        -- global: apenas admin
        (user_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
        OR
        -- per-user: owner
        (user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'foods' AND policyname = 'foods_update') THEN
    CREATE POLICY "foods_update" ON public.foods
      FOR UPDATE USING (
        (user_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
        OR (user_id = auth.uid())
      ) WITH CHECK (
        (user_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
        OR (user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'foods' AND policyname = 'foods_delete') THEN
    CREATE POLICY "foods_delete" ON public.foods
      FOR DELETE USING (
        (user_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
        OR (user_id = auth.uid())
      );
  END IF;
END $$;

-- == DIET_SETTINGS: owner only ==
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'diet_settings' AND policyname = 'diet_settings_owner') THEN
    CREATE POLICY "diet_settings_owner" ON public.diet_settings
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- == DIET_PLANS: owner only ==
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'diet_plans' AND policyname = 'diet_plans_owner') THEN
    CREATE POLICY "diet_plans_owner" ON public.diet_plans
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- == DIET_PLAN_MEALS: via plan owner ==
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'diet_plan_meals' AND policyname = 'diet_plan_meals_owner') THEN
    CREATE POLICY "diet_plan_meals_owner" ON public.diet_plan_meals
      USING (
        EXISTS (SELECT 1 FROM public.diet_plans WHERE id = diet_plan_meals.plan_id AND user_id = auth.uid())
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.diet_plans WHERE id = diet_plan_meals.plan_id AND user_id = auth.uid())
      );
  END IF;
END $$;

-- == DIET_PLAN_MEAL_ITEMS: via meal → plan owner ==
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'diet_plan_meal_items' AND policyname = 'diet_plan_meal_items_owner') THEN
    CREATE POLICY "diet_plan_meal_items_owner" ON public.diet_plan_meal_items
      USING (
        EXISTS (
          SELECT 1 FROM public.diet_plan_meals m
          JOIN public.diet_plans p ON p.id = m.plan_id
          WHERE m.id = diet_plan_meal_items.meal_id AND p.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.diet_plan_meals m
          JOIN public.diet_plans p ON p.id = m.plan_id
          WHERE m.id = diet_plan_meal_items.meal_id AND p.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- == FOOD_SUBSTITUTIONS: via original_item → meal → plan owner ==
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'food_substitutions' AND policyname = 'food_substitutions_owner') THEN
    CREATE POLICY "food_substitutions_owner" ON public.food_substitutions
      USING (
        EXISTS (
          SELECT 1 FROM public.diet_plan_meal_items i
          JOIN public.diet_plan_meals m ON m.id = i.meal_id
          JOIN public.diet_plans p ON p.id = m.plan_id
          WHERE i.id = food_substitutions.original_item_id AND p.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.diet_plan_meal_items i
          JOIN public.diet_plan_meals m ON m.id = i.meal_id
          JOIN public.diet_plans p ON p.id = m.plan_id
          WHERE i.id = food_substitutions.original_item_id AND p.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- == DIET_LOGS: owner only ==
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'diet_logs' AND policyname = 'diet_logs_owner_select') THEN
    CREATE POLICY "diet_logs_owner_select" ON public.diet_logs FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'diet_logs' AND policyname = 'diet_logs_owner_insert') THEN
    CREATE POLICY "diet_logs_owner_insert" ON public.diet_logs FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'diet_logs' AND policyname = 'diet_logs_owner_delete') THEN
    CREATE POLICY "diet_logs_owner_delete" ON public.diet_logs FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- == WATER_LOGS: owner only ==
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'water_logs' AND policyname = 'water_logs_owner_select') THEN
    CREATE POLICY "water_logs_owner_select" ON public.water_logs FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'water_logs' AND policyname = 'water_logs_owner_insert') THEN
    CREATE POLICY "water_logs_owner_insert" ON public.water_logs FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'water_logs' AND policyname = 'water_logs_owner_delete') THEN
    CREATE POLICY "water_logs_owner_delete" ON public.water_logs FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;
