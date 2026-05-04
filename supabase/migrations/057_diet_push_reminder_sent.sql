-- ============================================================
-- NEXUS NUTRITION — Dedupe diário para pushes da edge function
-- send-push-notifications (água, refeições, checklist noite).
-- O cron de 5 min usa janela catch-up: sem esta tabela o mesmo
-- minuto local volta a coincidir em cada tick durante ~30 min.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.diet_push_reminder_sent (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dedupe_key   TEXT NOT NULL,
  local_date   DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, dedupe_key, local_date)
);

CREATE INDEX IF NOT EXISTS idx_diet_push_reminder_sent_user_date
  ON public.diet_push_reminder_sent (user_id, local_date DESC);

ALTER TABLE public.diet_push_reminder_sent ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'diet_push_reminder_sent'
      AND policyname = 'diet_push_reminder_sent_no_client'
  ) THEN
    CREATE POLICY "diet_push_reminder_sent_no_client"
      ON public.diet_push_reminder_sent
      FOR ALL
      TO authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

COMMENT ON TABLE public.diet_push_reminder_sent IS
  'Escrita apenas pelo service role (edge send-push-notifications); evita reenvios duplicados no mesmo dia civil local.';
