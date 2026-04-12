-- ============================================================
-- USER ACTIVE MODULES — Migration
-- Tabela para rastrear módulos que o usuário iniciou/ativou
-- ============================================================

-- Tabela: módulos ativos por usuário
CREATE TABLE public.user_active_modules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id   UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  UNIQUE(user_id, module_id)
);

CREATE INDEX idx_user_active_modules_user_id ON public.user_active_modules(user_id);
CREATE INDEX idx_user_active_modules_module_id ON public.user_active_modules(module_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.user_active_modules ENABLE ROW LEVEL SECURITY;

-- Política: usuário pode ver seus próprios módulos ativos
CREATE POLICY "user_active_modules: select próprio"
  ON public.user_active_modules
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Política: usuário pode inserir seus próprios módulos ativos
CREATE POLICY "user_active_modules: insert próprio"
  ON public.user_active_modules
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Política: usuário pode deletar seus próprios módulos ativos
CREATE POLICY "user_active_modules: delete próprio"
  ON public.user_active_modules
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Política: usuário pode atualizar seus próprios módulos ativos (last_accessed_at)
CREATE POLICY "user_active_modules: update próprio"
  ON public.user_active_modules
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- FUNÇÃO: Atualizar last_accessed_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_last_accessed_module()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_accessed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar last_accessed_at em UPDATE
CREATE TRIGGER trigger_update_module_access
  BEFORE UPDATE ON public.user_active_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_last_accessed_module();
