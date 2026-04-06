-- ============================================================
-- Migration 010 — Nexus Finance (idempotente)
-- ============================================================

-- TABELA: finance_income_sources
CREATE TABLE IF NOT EXISTS public.finance_income_sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: finance_income_entries
CREATE TABLE IF NOT EXISTS public.finance_income_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id   UUID NOT NULL REFERENCES public.finance_income_sources(id) ON DELETE CASCADE,
  month       DATE NOT NULL,
  amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, source_id, month)
);

-- TABELA: finance_expense_categories
CREATE TABLE IF NOT EXISTS public.finance_expense_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT,
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: finance_expense_items
CREATE TABLE IF NOT EXISTS public.finance_expense_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id     UUID NOT NULL REFERENCES public.finance_expense_categories(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  default_amount  DECIMAL(12,2),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: finance_expense_entries
CREATE TABLE IF NOT EXISTS public.finance_expense_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id     UUID NOT NULL REFERENCES public.finance_expense_items(id) ON DELETE CASCADE,
  month       DATE NOT NULL,
  amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_paid     BOOLEAN NOT NULL DEFAULT false,
  paid_at     DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, item_id, month)
);

-- TABELA: finance_one_time_expenses
CREATE TABLE IF NOT EXISTS public.finance_one_time_expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  month       DATE NOT NULL,
  amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_paid     BOOLEAN NOT NULL DEFAULT false,
  paid_at     DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: finance_subscriptions
CREATE TABLE IF NOT EXISTS public.finance_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly'
                CHECK (billing_cycle IN ('monthly', 'yearly')),
  renewal_day   SMALLINT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: finance_receivables
CREATE TABLE IF NOT EXISTS public.finance_receivables (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_name      TEXT NOT NULL,
  description      TEXT NOT NULL,
  amount           DECIMAL(10,2) NOT NULL,
  reference_month  DATE,
  is_paid          BOOLEAN NOT NULL DEFAULT false,
  paid_at          DATE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_finance_income_entries_user_month  ON public.finance_income_entries    (user_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_finance_expense_entries_user_month ON public.finance_expense_entries   (user_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_finance_one_time_user_month        ON public.finance_one_time_expenses (user_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_finance_receivables_user_person    ON public.finance_receivables       (user_id, person_name);

-- RLS
ALTER TABLE public.finance_income_sources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_income_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_expense_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_expense_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_expense_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_one_time_expenses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_receivables         ENABLE ROW LEVEL SECURITY;

-- Macro para criar políticas idempotentes
DO $$ BEGIN
  -- finance_income_sources
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'finance_income_sources' AND policyname = 'finance_income_sources_owner') THEN
    CREATE POLICY "finance_income_sources_owner" ON public.finance_income_sources
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  -- finance_income_entries
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'finance_income_entries' AND policyname = 'finance_income_entries_owner') THEN
    CREATE POLICY "finance_income_entries_owner" ON public.finance_income_entries
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  -- finance_expense_categories
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'finance_expense_categories' AND policyname = 'finance_expense_categories_owner') THEN
    CREATE POLICY "finance_expense_categories_owner" ON public.finance_expense_categories
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  -- finance_expense_items
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'finance_expense_items' AND policyname = 'finance_expense_items_owner') THEN
    CREATE POLICY "finance_expense_items_owner" ON public.finance_expense_items
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  -- finance_expense_entries
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'finance_expense_entries' AND policyname = 'finance_expense_entries_owner') THEN
    CREATE POLICY "finance_expense_entries_owner" ON public.finance_expense_entries
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  -- finance_one_time_expenses
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'finance_one_time_expenses' AND policyname = 'finance_one_time_expenses_owner') THEN
    CREATE POLICY "finance_one_time_expenses_owner" ON public.finance_one_time_expenses
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  -- finance_subscriptions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'finance_subscriptions' AND policyname = 'finance_subscriptions_owner') THEN
    CREATE POLICY "finance_subscriptions_owner" ON public.finance_subscriptions
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  -- finance_receivables
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'finance_receivables' AND policyname = 'finance_receivables_owner') THEN
    CREATE POLICY "finance_receivables_owner" ON public.finance_receivables
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- VIEW: finance_monthly_summary
CREATE OR REPLACE VIEW public.finance_monthly_summary AS
WITH months AS (
  SELECT DISTINCT user_id, month FROM public.finance_income_entries
  UNION
  SELECT DISTINCT user_id, month FROM public.finance_expense_entries
  UNION
  SELECT DISTINCT user_id, month FROM public.finance_one_time_expenses
),
income AS (
  SELECT user_id, month, COALESCE(SUM(amount), 0) AS total_income
  FROM public.finance_income_entries
  GROUP BY user_id, month
),
expenses AS (
  SELECT user_id, month, COALESCE(SUM(amount), 0) AS total_expenses
  FROM public.finance_expense_entries
  GROUP BY user_id, month
),
one_time AS (
  SELECT user_id, month, COALESCE(SUM(amount), 0) AS total_one_time
  FROM public.finance_one_time_expenses
  GROUP BY user_id, month
)
SELECT
  m.user_id,
  m.month,
  COALESCE(i.total_income, 0)                                    AS total_income,
  COALESCE(e.total_expenses, 0)                                  AS total_expenses,
  COALESCE(o.total_one_time, 0)                                  AS total_one_time,
  COALESCE(i.total_income, 0)
    - COALESCE(e.total_expenses, 0)
    - COALESCE(o.total_one_time, 0)                              AS surplus,
  SUM(
    COALESCE(i.total_income, 0)
      - COALESCE(e.total_expenses, 0)
      - COALESCE(o.total_one_time, 0)
  ) OVER (
    PARTITION BY m.user_id
    ORDER BY m.month
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  )                                                              AS accumulated_surplus
FROM months m
LEFT JOIN income  i ON i.user_id = m.user_id AND i.month = m.month
LEFT JOIN expenses e ON e.user_id = m.user_id AND e.month = m.month
LEFT JOIN one_time o ON o.user_id = m.user_id AND o.month = m.month;

-- Registra o módulo Finance no portal
INSERT INTO public.modules (slug, label, description, icon_name, is_active, sort_order)
VALUES (
  'finance',
  'Nexus Finance',
  'Controle suas receitas, despesas, assinaturas e cobranças em um só lugar.',
  'Wallet',
  true,
  3
)
ON CONFLICT (slug) DO UPDATE SET
  label       = EXCLUDED.label,
  description = EXCLUDED.description,
  icon_name   = EXCLUDED.icon_name,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order;
