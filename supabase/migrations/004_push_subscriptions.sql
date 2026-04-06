-- ============================================================
-- NEXUS — Push Subscriptions
-- Executar no projeto Supabase compartilhado (nexus-portal)
-- ============================================================

CREATE TABLE public.push_subscriptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT        NOT NULL UNIQUE,
  p256dh      TEXT        NOT NULL,
  auth        TEXT        NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Usuário gerencia apenas as próprias assinaturas
CREATE POLICY "push_subscriptions: dono tem acesso total"
  ON public.push_subscriptions
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- service_role pode ler todas (necessário para a Edge Function enviar pushes)
CREATE POLICY "push_subscriptions: service_role pode ler"
  ON public.push_subscriptions
  FOR SELECT
  TO service_role
  USING (TRUE);
