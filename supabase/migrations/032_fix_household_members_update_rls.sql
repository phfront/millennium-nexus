-- ============================================================
-- Migration 032 — Fix UPDATE e DELETE RLS policies para convites
-- Permite que utilizadores aceitem/rejeitem convites mesmo
-- quando o user_id ainda é nulo, fazendo verificação pelo email
-- ============================================================

-- Corrige a policy de UPDATE:
DROP POLICY IF EXISTS "household_members_update" ON public.household_members;
CREATE POLICY "household_members_update" ON public.household_members
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR lower(invited_email) = lower(auth.email())
    OR EXISTS (
      SELECT 1 FROM public.households h
      WHERE h.id = household_id AND h.owner_id = auth.uid()
    )
  );

-- Corrige a policy de DELETE:
DROP POLICY IF EXISTS "household_members_delete" ON public.household_members;
CREATE POLICY "household_members_delete" ON public.household_members
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR lower(invited_email) = lower(auth.email())
    OR EXISTS (
      SELECT 1 FROM public.households h
      WHERE h.id = household_id AND h.owner_id = auth.uid()
    )
  );
