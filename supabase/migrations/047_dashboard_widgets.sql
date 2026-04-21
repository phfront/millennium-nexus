-- ============================================================
-- Dashboard Widgets (Home customizavel)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_dashboard_widgets (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_key TEXT NOT NULL,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, widget_key)
);

CREATE TABLE IF NOT EXISTS public.user_dashboard_widget_layouts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_key TEXT NOT NULL,
  breakpoint TEXT NOT NULL CHECK (breakpoint IN ('lg', 'md', 'sm')),
  x SMALLINT NOT NULL DEFAULT 0 CHECK (x >= 0),
  y SMALLINT NOT NULL DEFAULT 0 CHECK (y >= 0),
  w SMALLINT NOT NULL CHECK (w >= 1 AND w <= 12),
  h SMALLINT NOT NULL CHECK (h >= 1 AND h <= 12),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, widget_key, breakpoint),
  CONSTRAINT user_dashboard_widget_layouts_widget_fk
    FOREIGN KEY (user_id, widget_key)
    REFERENCES public.user_dashboard_widgets(user_id, widget_key)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_dashboard_widgets_user
  ON public.user_dashboard_widgets (user_id);

CREATE INDEX IF NOT EXISTS idx_user_dashboard_widget_layouts_user_breakpoint
  ON public.user_dashboard_widget_layouts (user_id, breakpoint);

ALTER TABLE public.user_dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_dashboard_widget_layouts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'user_dashboard_widgets'
      AND policyname = 'user_dashboard_widgets_owner'
  ) THEN
    CREATE POLICY "user_dashboard_widgets_owner" ON public.user_dashboard_widgets
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'user_dashboard_widget_layouts'
      AND policyname = 'user_dashboard_widget_layouts_owner'
  ) THEN
    CREATE POLICY "user_dashboard_widget_layouts_owner" ON public.user_dashboard_widget_layouts
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
