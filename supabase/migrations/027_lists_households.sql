-- ============================================================
-- Migration 027 — Nexus Households + Nexus Lists (idempotente)
-- ============================================================

-- ============================================================
-- PARTE 1: HOUSEHOLDS (módulo de plataforma)
-- ============================================================

-- TABELA: households
CREATE TABLE IF NOT EXISTS public.households (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: household_members
CREATE TABLE IF NOT EXISTS public.household_members (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'member'
                 CHECK (role IN ('owner', 'member')),
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'active')),
  invited_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (household_id, invited_email)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_household_members_household ON public.household_members (household_id);
CREATE INDEX IF NOT EXISTS idx_household_members_user     ON public.household_members (user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_email    ON public.household_members (invited_email);

-- ============================================================
-- PARTE 2: LISTS
-- ============================================================

-- TABELA: lists
CREATE TABLE IF NOT EXISTS public.lists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id  UUID REFERENCES public.households(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  icon          TEXT DEFAULT '📋',
  color         TEXT,
  is_archived   BOOLEAN NOT NULL DEFAULT false,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: list_items
CREATE TABLE IF NOT EXISTS public.list_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id          UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  quantity         NUMERIC(10,3),
  unit             TEXT,
  category         TEXT,
  notes            TEXT,
  estimated_price  NUMERIC(10,2),
  is_checked       BOOLEAN NOT NULL DEFAULT false,
  added_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at       TIMESTAMPTZ,
  sort_order       SMALLINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lists_owner         ON public.lists (owner_id);
CREATE INDEX IF NOT EXISTS idx_lists_household     ON public.lists (household_id);
CREATE INDEX IF NOT EXISTS idx_list_items_list     ON public.list_items (list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_checked  ON public.list_items (list_id, is_checked);

-- ============================================================
-- PARTE 3: RLS
-- ============================================================

ALTER TABLE public.households        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lists             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_items        ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para evitar recursão nas políticas RLS
-- Retorna TRUE se o utilizador autenticado é membro ativo do household
CREATE OR REPLACE FUNCTION public.is_household_member(p_household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members hm
    WHERE hm.household_id = p_household_id
      AND hm.user_id      = auth.uid()
      AND hm.status       = 'active'
  );
$$;

DO $$ BEGIN

  -- ── households ──────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'households' AND policyname = 'households_member_read') THEN
    CREATE POLICY "households_member_read" ON public.households
      FOR SELECT
      USING (
        owner_id = auth.uid()
        OR public.is_household_member(id)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'households' AND policyname = 'households_owner_insert') THEN
    CREATE POLICY "households_owner_insert" ON public.households
      FOR INSERT
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'households' AND policyname = 'households_owner_update') THEN
    CREATE POLICY "households_owner_update" ON public.households
      FOR UPDATE
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'households' AND policyname = 'households_owner_delete') THEN
    CREATE POLICY "households_owner_delete" ON public.households
      FOR DELETE
      USING (owner_id = auth.uid());
  END IF;

  -- ── household_members ────────────────────────────────────────
  -- Pode VER membros se for membro ativo ou owner do household
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'household_members' AND policyname = 'household_members_read') THEN
    CREATE POLICY "household_members_read" ON public.household_members
      FOR SELECT
      USING (
        user_id = auth.uid()
        OR public.is_household_member(household_id)
        OR EXISTS (
          SELECT 1 FROM public.households h
          WHERE h.id = household_id AND h.owner_id = auth.uid()
        )
      );
  END IF;

  -- Inserir convites: apenas o owner do household
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'household_members' AND policyname = 'household_members_owner_insert') THEN
    CREATE POLICY "household_members_owner_insert" ON public.household_members
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.households h
          WHERE h.id = household_id AND h.owner_id = auth.uid()
        )
      );
  END IF;

  -- Atualizar (aceitar/recusar convite): o próprio utilizador convidado ou o owner
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'household_members' AND policyname = 'household_members_update') THEN
    CREATE POLICY "household_members_update" ON public.household_members
      FOR UPDATE
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.households h
          WHERE h.id = household_id AND h.owner_id = auth.uid()
        )
      );
  END IF;

  -- Remover: o próprio utilizador (leave) ou o owner do household
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'household_members' AND policyname = 'household_members_delete') THEN
    CREATE POLICY "household_members_delete" ON public.household_members
      FOR DELETE
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.households h
          WHERE h.id = household_id AND h.owner_id = auth.uid()
        )
      );
  END IF;

  -- ── lists ────────────────────────────────────────────────────
  -- Ver: owner da lista OU membro ativo do household da lista
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lists' AND policyname = 'lists_read') THEN
    CREATE POLICY "lists_read" ON public.lists
      FOR SELECT
      USING (
        owner_id = auth.uid()
        OR (household_id IS NOT NULL AND public.is_household_member(household_id))
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lists' AND policyname = 'lists_insert') THEN
    CREATE POLICY "lists_insert" ON public.lists
      FOR INSERT
      WITH CHECK (
        owner_id = auth.uid()
        AND (
          household_id IS NULL
          OR public.is_household_member(household_id)
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lists' AND policyname = 'lists_update') THEN
    CREATE POLICY "lists_update" ON public.lists
      FOR UPDATE
      USING (
        owner_id = auth.uid()
        OR (household_id IS NOT NULL AND public.is_household_member(household_id))
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lists' AND policyname = 'lists_delete') THEN
    CREATE POLICY "lists_delete" ON public.lists
      FOR DELETE
      USING (owner_id = auth.uid());
  END IF;

  -- ── list_items ───────────────────────────────────────────────
  -- Permissão herdada da lista pai (via subquery que usa is_household_member)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_items' AND policyname = 'list_items_read') THEN
    CREATE POLICY "list_items_read" ON public.list_items
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.lists l
          WHERE l.id = list_id
            AND (
              l.owner_id = auth.uid()
              OR (l.household_id IS NOT NULL AND public.is_household_member(l.household_id))
            )
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_items' AND policyname = 'list_items_insert') THEN
    CREATE POLICY "list_items_insert" ON public.list_items
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.lists l
          WHERE l.id = list_id
            AND (
              l.owner_id = auth.uid()
              OR (l.household_id IS NOT NULL AND public.is_household_member(l.household_id))
            )
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_items' AND policyname = 'list_items_update') THEN
    CREATE POLICY "list_items_update" ON public.list_items
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.lists l
          WHERE l.id = list_id
            AND (
              l.owner_id = auth.uid()
              OR (l.household_id IS NOT NULL AND public.is_household_member(l.household_id))
            )
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'list_items' AND policyname = 'list_items_delete') THEN
    CREATE POLICY "list_items_delete" ON public.list_items
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.lists l
          WHERE l.id = list_id
            AND (
              l.owner_id = auth.uid()
              OR (l.household_id IS NOT NULL AND public.is_household_member(l.household_id))
            )
        )
      );
  END IF;

END $$;

-- ============================================================
-- PARTE 4: Habilitar Realtime para list_items
-- ============================================================
-- Necessário para sincronização em tempo real entre membros do household.
-- Execute no Supabase Dashboard: Database > Replication > Supabase Realtime
-- e adicione a tabela list_items, ou descomente a linha abaixo se o seu
-- projeto suporta o comando ALTER PUBLICATION:
--
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.list_items;

-- ============================================================
-- PARTE 5: Registar módulos no portal
-- ============================================================

INSERT INTO public.modules (slug, label, description, icon_name, is_active, sort_order)
VALUES
  (
    'households',
    'Nexus Households',
    'Gerencie grupos e famílias para colaborar em módulos do Nexus.',
    'Users',
    true,
    10
  ),
  (
    'lists',
    'Nexus Lists',
    'Listas pessoais e colaborativas com suporte a supermercado e muito mais.',
    'ShoppingCart',
    true,
    11
  )
ON CONFLICT (slug) DO UPDATE SET
  label       = EXCLUDED.label,
  description = EXCLUDED.description,
  icon_name   = EXCLUDED.icon_name,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order;
