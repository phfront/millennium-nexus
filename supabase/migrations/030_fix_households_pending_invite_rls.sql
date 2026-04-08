-- ============================================================
-- Migration 030 — Fix RLS: households readable by pending invitees
-- O join household:households(*) retorna null porque a policy
-- actual só permite ler households se for owner ou membro ACTIVO.
-- Utilizadores com convite PENDING precisam ler o household para
-- mostrar o nome no ecrã de aceitação/recusa.
-- ============================================================

-- Descobre o nome actual da policy para poder fazer drop
DROP POLICY IF EXISTS "households: select member ou owner" ON public.households;
DROP POLICY IF EXISTS "households_select" ON public.households;
DROP POLICY IF EXISTS "households: select" ON public.households;

-- Nova policy — permite ler se for owner, membro activo,
-- OU se tiver um convite pendente (user_id OU email)
CREATE POLICY "households: select member ou owner"
  ON public.households FOR SELECT
  USING (
    owner_id = auth.uid()
    OR public.is_household_member(id)
    OR EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = id
        AND hm.status = 'pending'
        AND (
          hm.user_id = auth.uid()
          OR lower(hm.invited_email) = lower(auth.email())
        )
    )
  );
