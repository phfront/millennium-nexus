-- ============================================================
-- Migration 031 — Fix circular RLS recursion
-- Migrations 029 e 030 introduziram recursão infinita entre
-- households ↔ household_members via EXISTS com RLS activo.
-- Este migration usa SECURITY DEFINER para evitar o loop.
-- ============================================================

-- 1. Helper: verifica se o utilizador é owner do household
--    (SECURITY DEFINER = bypassa RLS, sem recursão)
CREATE OR REPLACE FUNCTION public.is_household_owner(p_household_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.households
    WHERE id = p_household_id AND owner_id = auth.uid()
  );
$$;

-- 2. Helper: verifica se o utilizador tem convite pendente
--    (SECURITY DEFINER = bypassa RLS, sem recursão)
CREATE OR REPLACE FUNCTION public.has_pending_invite(p_household_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household_id
      AND status = 'pending'
      AND (
        user_id = auth.uid()
        OR lower(invited_email) = lower(auth.email())
      )
  );
$$;

-- 3. Corrige policy de household_members:
--    Remove o EXISTS(households) que causava recursão
--    Substitui por is_household_owner() que usa SECURITY DEFINER
DROP POLICY IF EXISTS "household_members_read" ON public.household_members;
CREATE POLICY "household_members_read" ON public.household_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR lower(invited_email) = lower(auth.email())
    OR public.is_household_member(household_id)   -- SECURITY DEFINER (existia antes)
    OR public.is_household_owner(household_id)    -- SECURITY DEFINER (novo, sem recursão)
  );

-- 4. Corrige policy de households:
--    Remove o EXISTS(household_members) que causava recursão
--    Substitui por has_pending_invite() que usa SECURITY DEFINER
DROP POLICY IF EXISTS "households: select member ou owner" ON public.households;
DROP POLICY IF EXISTS "households_read" ON public.households;
DROP POLICY IF EXISTS "households: select" ON public.households;

CREATE POLICY "households_read" ON public.households
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR public.is_household_member(id)    -- SECURITY DEFINER
    OR public.has_pending_invite(id)     -- SECURITY DEFINER
  );
