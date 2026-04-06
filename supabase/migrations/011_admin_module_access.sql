-- ============================================================
-- NEXUS PORTAL — Admin flag, email em profiles, negações por módulo
-- ============================================================

-- Colunas em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Função RLS: admin atual (SECURITY DEFINER para ler is_admin sem recursão)
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()), false);
$$;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO service_role;

-- SELECT em profiles: próprio registo ou admin (lista utilizadores)
DROP POLICY IF EXISTS "profiles: select próprio" ON public.profiles;
CREATE POLICY "profiles: select próprio ou admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_current_user_admin());

-- Trigger: incluir email ao criar perfil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Backfill de email a partir de auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email = '');

-- Tabela: linha = utilizador não tem acesso ao módulo (mesmo com is_active)
CREATE TABLE public.user_module_denials (
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, module_id)
);

CREATE INDEX user_module_denials_user_id_idx ON public.user_module_denials (user_id);

ALTER TABLE public.user_module_denials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_module_denials: select próprio ou admin"
  ON public.user_module_denials FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_current_user_admin());

CREATE POLICY "user_module_denials: insert admin"
  ON public.user_module_denials FOR INSERT
  TO authenticated
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY "user_module_denials: delete admin"
  ON public.user_module_denials FOR DELETE
  TO authenticated
  USING (public.is_current_user_admin());
