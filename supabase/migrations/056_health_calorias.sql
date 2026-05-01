-- ============================================================
-- Migration 056 — Health: Calorias (queima livre + meta semanal)
-- ============================================================

-- active_days: bitmask Mon=bit0 … Sun=bit6 (ex.: 31 = Seg–Sex)

CREATE TABLE IF NOT EXISTS public.calorias_settings (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_target_kcal  INTEGER NOT NULL DEFAULT 400 CHECK (daily_target_kcal > 0),
  active_days        SMALLINT NOT NULL DEFAULT 31 CHECK (active_days >= 0 AND active_days <= 127),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.calorias_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_kcal INTEGER NOT NULL CHECK (amount_kcal > 0),
  note        TEXT,
  logged_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calorias_logs_user_date
  ON public.calorias_logs (user_id, logged_date DESC);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.calorias_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calorias_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calorias_settings' AND policyname = 'calorias_settings_owner') THEN
    CREATE POLICY "calorias_settings_owner" ON public.calorias_settings
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calorias_logs' AND policyname = 'calorias_logs_owner_select') THEN
    CREATE POLICY "calorias_logs_owner_select" ON public.calorias_logs FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calorias_logs' AND policyname = 'calorias_logs_owner_insert') THEN
    CREATE POLICY "calorias_logs_owner_insert" ON public.calorias_logs FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calorias_logs' AND policyname = 'calorias_logs_owner_delete') THEN
    CREATE POLICY "calorias_logs_owner_delete" ON public.calorias_logs FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;
