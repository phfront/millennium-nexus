-- ============================================================
-- Migration 028 — Fix RLS Policies for Modules & Profiles
-- Garante que os módulos voltem a aparecer após ativar RLS
-- ============================================================

-- 1. Garante permissões básicas de esquema para usuários autenticados
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- 2. Garante que usuários autenticados possam ler as tabelas básicas
GRANT SELECT ON public.modules TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;

-- 3. Recria a política de SELECT para módulos (idempotente)
-- Esta política permite que qualquer usuário logado veja a lista de módulos
DROP POLICY IF EXISTS "modules: select autenticado" ON public.modules;
CREATE POLICY "modules: select autenticado"
  ON public.modules FOR SELECT
  TO authenticated
  USING (true);

-- 4. Garante que a política de profiles também esteja correta
-- Importante para o DashboardContent conseguir ler o nome do usuário
DROP POLICY IF EXISTS "profiles: select próprio ou admin" ON public.profiles;
CREATE POLICY "profiles: select próprio ou admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_current_user_admin());

-- 5. Caso ainda não tenha feito, vamos ativar alguns módulos iniciais 
-- para garantir que algo apareça no catálogo (opcional, mas ajuda no teste)
UPDATE public.modules 
SET is_active = true 
WHERE slug IN ('daily-goals', 'finance', 'lists', 'households');

-- Nota: Se rodaste a migration 027 (Lists + Households), 
-- os módulos de listas e grupos já estarão lá.
