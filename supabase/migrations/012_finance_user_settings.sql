-- ============================================================
-- NEXUS FINANCE — Preferências do utilizador (horizonte das planilhas)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.finance_user_settings (
  user_id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  spreadsheet_months_forward   SMALLINT NOT NULL DEFAULT 3
    CHECK (spreadsheet_months_forward >= 0 AND spreadsheet_months_forward <= 36),
  updated_at                   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.finance_user_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'finance_user_settings' AND policyname = 'finance_user_settings_owner'
  ) THEN
    CREATE POLICY "finance_user_settings_owner" ON public.finance_user_settings
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
