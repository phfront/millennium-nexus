-- ============================================================
-- Dashboard Widgets Fine Grid (half cell size)
-- ============================================================

ALTER TABLE public.user_dashboard_widget_layouts
  ADD COLUMN IF NOT EXISTS unit_scale SMALLINT NOT NULL DEFAULT 1;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_dashboard_widget_layouts_unit_scale_check'
  ) THEN
    ALTER TABLE public.user_dashboard_widget_layouts
      ADD CONSTRAINT user_dashboard_widget_layouts_unit_scale_check
      CHECK (unit_scale IN (1, 2));
  END IF;
END $$;

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Remove checks antigos de w/h <= 12, se existirem.
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'user_dashboard_widget_layouts'
      AND c.contype = 'c'
      AND (
        pg_get_constraintdef(c.oid) ILIKE '%w <= 12%'
        OR pg_get_constraintdef(c.oid) ILIKE '%h <= 12%'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.user_dashboard_widget_layouts DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_dashboard_widget_layouts_w_range'
  ) THEN
    ALTER TABLE public.user_dashboard_widget_layouts
      ADD CONSTRAINT user_dashboard_widget_layouts_w_range CHECK (w >= 1 AND w <= 24);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_dashboard_widget_layouts_h_range'
  ) THEN
    ALTER TABLE public.user_dashboard_widget_layouts
      ADD CONSTRAINT user_dashboard_widget_layouts_h_range CHECK (h >= 1 AND h <= 24);
  END IF;
END $$;

-- Escala layouts antigos (unit_scale=1) para a nova grade fina.
UPDATE public.user_dashboard_widget_layouts
SET
  x = x * 2,
  y = y * 2,
  w = w * 2,
  h = h * 2,
  unit_scale = 2,
  updated_at = NOW()
WHERE unit_scale = 1;

ALTER TABLE public.user_dashboard_widget_layouts
  ALTER COLUMN unit_scale SET DEFAULT 2;
