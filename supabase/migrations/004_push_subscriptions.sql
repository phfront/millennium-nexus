-- ============================================================
-- NEXUS — Push Subscriptions (complementos; tabela em 002)
-- Idempotente: nao recria push_subscriptions
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'push_subscriptions' AND policyname = 'push_subscriptions: dono tem acesso total'
  ) THEN
    CREATE POLICY "push_subscriptions: dono tem acesso total"
      ON public.push_subscriptions
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'push_subscriptions' AND policyname = 'push_subscriptions: service_role pode ler'
  ) THEN
    CREATE POLICY "push_subscriptions: service_role pode ler"
      ON public.push_subscriptions
      FOR SELECT
      TO service_role
      USING (TRUE);
  END IF;
END $$;
