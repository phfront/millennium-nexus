-- ============================================================
-- Dashboard Widget Visibility per Breakpoint
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_dashboard_widget_visibility (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_key TEXT NOT NULL,
  breakpoint TEXT NOT NULL CHECK (breakpoint IN ('lg', 'md', 'sm')),
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, widget_key, breakpoint),
  CONSTRAINT user_dashboard_widget_visibility_widget_fk
    FOREIGN KEY (user_id, widget_key)
    REFERENCES public.user_dashboard_widgets(user_id, widget_key)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_dashboard_widget_visibility_user_bp
  ON public.user_dashboard_widget_visibility (user_id, breakpoint);

ALTER TABLE public.user_dashboard_widget_visibility ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'user_dashboard_widget_visibility'
      AND policyname = 'user_dashboard_widget_visibility_owner'
  ) THEN
    CREATE POLICY "user_dashboard_widget_visibility_owner" ON public.user_dashboard_widget_visibility
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
