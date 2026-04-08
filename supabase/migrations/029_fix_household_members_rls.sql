-- ============================================================
-- Migration 029 — Fix RLS: household_members pending invites
-- Garante que utilizadores vejam convites onde são o convidado,
-- mesmo quando user_id ainda é NULL (utilizador não encontrado
-- na criação do convite). Usa auth.email() do JWT — sem lookup.
-- ============================================================

DROP POLICY IF EXISTS "household_members_read" ON public.household_members;

CREATE POLICY "household_members_read" ON public.household_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR lower(invited_email) = lower(auth.email())
    OR public.is_household_member(household_id)
    OR EXISTS (
      SELECT 1 FROM public.households h
      WHERE h.id = household_id AND h.owner_id = auth.uid()
    )
  );
