-- ============================================================
-- NEXUS LEARNING MODULE — Migration
-- ============================================================

-- Enums
CREATE TYPE public.learning_plan_status AS ENUM ('planning', 'in_progress', 'completed', 'paused');
CREATE TYPE public.learning_scheduling_type AS ENUM ('relative', 'calendar');

-- ============================================================
-- TABELA: learning_plans
-- ============================================================
CREATE TABLE public.learning_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  goals           TEXT,
  status          public.learning_plan_status NOT NULL DEFAULT 'planning',
  scheduling_type public.learning_scheduling_type NOT NULL DEFAULT 'relative',
  start_date      DATE,
  target_date     DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_learning_plans_user_id ON public.learning_plans(user_id);

-- ============================================================
-- TABELA: learning_plan_sections (Para agrupamentos ex: Semana 1)
-- ============================================================
CREATE TABLE public.learning_plan_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES public.learning_plans(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_learning_plan_sections_plan_id ON public.learning_plan_sections(plan_id);

-- ============================================================
-- TABELA: learning_plan_days
-- ============================================================
CREATE TABLE public.learning_plan_days (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES public.learning_plans(id) ON DELETE CASCADE,
  section_id      UUID REFERENCES public.learning_plan_sections(id) ON DELETE SET NULL,
  day_number      INTEGER NOT NULL,
  scheduled_date  DATE,
  title           TEXT,
  content_prompt  TEXT,
  user_notes      TEXT,
  is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_learning_plan_days_plan_id ON public.learning_plan_days(plan_id);
CREATE INDEX idx_learning_plan_days_section_id ON public.learning_plan_days(section_id);

-- ============================================================
-- TABELA: learning_day_items (Checklists/Links/Tarefas)
-- ============================================================
CREATE TABLE public.learning_day_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id       UUID NOT NULL REFERENCES public.learning_plan_days(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  url          TEXT,
  item_type    TEXT, -- 'task', 'video', 'article'
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_learning_day_items_day_id ON public.learning_day_items(day_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.learning_plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_plan_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_plan_days     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_day_items     ENABLE ROW LEVEL SECURITY;

-- learning_plans: acesso restrito ao dono
CREATE POLICY "learning_plans: acesso do dono"
  ON public.learning_plans
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- learning_plan_sections: acesso do dono
CREATE POLICY "learning_plan_sections: acesso do dono"
  ON public.learning_plan_sections
  USING (plan_id IN (SELECT id FROM public.learning_plans WHERE user_id = auth.uid()))
  WITH CHECK (plan_id IN (SELECT id FROM public.learning_plans WHERE user_id = auth.uid()));

-- learning_plan_days: acesso do dono
CREATE POLICY "learning_plan_days: acesso do dono"
  ON public.learning_plan_days
  USING (plan_id IN (SELECT id FROM public.learning_plans WHERE user_id = auth.uid()))
  WITH CHECK (plan_id IN (SELECT id FROM public.learning_plans WHERE user_id = auth.uid()));

-- learning_day_items: acesso do dono
CREATE POLICY "learning_day_items: acesso do dono"
  ON public.learning_day_items
  USING (day_id IN (SELECT id FROM public.learning_plan_days WHERE plan_id IN (SELECT id FROM public.learning_plans WHERE user_id = auth.uid())))
  WITH CHECK (day_id IN (SELECT id FROM public.learning_plan_days WHERE plan_id IN (SELECT id FROM public.learning_plans WHERE user_id = auth.uid())));

-- ============================================================
-- REGISTRO DO MÓDULO NA TABELA modules (nexus-portal)
-- ============================================================
INSERT INTO public.modules (slug, label, description, icon_name, is_active, sort_order)
VALUES (
  'learning',
  'Aprendizado',
  'Crie planos de estudos, foque no dia e acompanhe seu progresso.',
  'GraduationCap',
  TRUE,
  12
)
ON CONFLICT (slug) DO UPDATE
  SET label       = EXCLUDED.label,
      description = EXCLUDED.description,
      icon_name   = EXCLUDED.icon_name,
      is_active   = EXCLUDED.is_active;
