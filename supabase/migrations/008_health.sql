-- ============================================================
-- Migration 008 — Nexus Health (idempotente)
-- ============================================================

-- TABELA: health_settings (1:1 com user)
CREATE TABLE IF NOT EXISTS public.health_settings (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  start_weight  DECIMAL(5,2) NOT NULL,
  target_weight DECIMAL(5,2) NOT NULL,
  target_date   DATE NOT NULL,
  height        SMALLINT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: weight_logs
CREATE TABLE IF NOT EXISTS public.weight_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight     DECIMAL(5,2) NOT NULL,
  logged_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, logged_at)
);

-- Índice de performance
CREATE INDEX IF NOT EXISTS idx_weight_logs_user_date ON public.weight_logs (user_id, logged_at DESC);

-- RLS
ALTER TABLE public.health_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_logs     ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'health_settings' AND policyname = 'health_settings_owner'
  ) THEN
    CREATE POLICY "health_settings_owner" ON public.health_settings
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'weight_logs' AND policyname = 'weight_logs_owner_select'
  ) THEN
    CREATE POLICY "weight_logs_owner_select" ON public.weight_logs
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'weight_logs' AND policyname = 'weight_logs_owner_insert'
  ) THEN
    CREATE POLICY "weight_logs_owner_insert" ON public.weight_logs
      FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND logged_at <= CURRENT_DATE
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'weight_logs' AND policyname = 'weight_logs_owner_update'
  ) THEN
    CREATE POLICY "weight_logs_owner_update" ON public.weight_logs
      FOR UPDATE USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'weight_logs' AND policyname = 'weight_logs_owner_delete'
  ) THEN
    CREATE POLICY "weight_logs_owner_delete" ON public.weight_logs
      FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- VIEW: health_summary
CREATE OR REPLACE VIEW public.health_summary AS
SELECT
  s.user_id,
  s.start_weight,
  s.target_weight,
  s.target_date,
  s.height,
  latest.weight                                                               AS current_weight,
  latest.logged_at                                                            AS last_logged_at,
  s.start_weight - latest.weight                                              AS total_lost,
  latest.weight - s.target_weight                                             AS remaining,
  ROUND(
    ((s.start_weight - latest.weight) / NULLIF(s.start_weight - s.target_weight, 0)) * 100,
    1
  )                                                                           AS progress_percent,
  CASE WHEN s.height IS NOT NULL AND s.height > 0
    THEN ROUND(latest.weight / ((s.height::DECIMAL / 100) ^ 2), 1)
    ELSE NULL
  END                                                                         AS current_bmi
FROM public.health_settings s
JOIN LATERAL (
  SELECT weight, logged_at
  FROM public.weight_logs
  WHERE user_id = s.user_id
  ORDER BY logged_at DESC
  LIMIT 1
) latest ON TRUE;

-- Registra o módulo Health no portal
INSERT INTO public.modules (slug, label, description, icon_name, is_active, sort_order)
VALUES (
  'health',
  'Nexus Health',
  'Acompanhe seu peso e composição corporal com projeções inteligentes.',
  'Heart',
  true,
  2
)
ON CONFLICT (slug) DO UPDATE SET
  label       = EXCLUDED.label,
  description = EXCLUDED.description,
  icon_name   = EXCLUDED.icon_name,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order;
