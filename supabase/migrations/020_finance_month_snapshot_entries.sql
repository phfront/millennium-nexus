-- ============================================================
-- NEXUS FINANCE — Snapshot entries (lançamentos congelados por mês)
-- ============================================================

-- Tabela: finance_month_snapshot_entries
-- Cada linha representa um lançamento (receita, despesa fixa ou pontual)
-- congelado no momento em que o mês foi arquivado.
-- Os nomes dos itens/categorias ficam gravados aqui para não reflectirem
-- edições posteriores nas tabelas master.
CREATE TABLE IF NOT EXISTS public.finance_month_snapshot_entries (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month           DATE          NOT NULL,
  entry_type      TEXT          NOT NULL CHECK (entry_type IN ('income', 'expense', 'one_time')),
  category_name   TEXT,                           -- null para income/one_time
  category_color  TEXT,                           -- null para income/one_time
  item_name       TEXT          NOT NULL,         -- nome da fonte / item / pontual congelado
  amount          DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_paid         BOOLEAN,                        -- null para income
  due_date        DATE,                           -- só para one_time
  sort_order      INTEGER       NOT NULL DEFAULT 0,
  CONSTRAINT fk_snapshot_entry
    FOREIGN KEY (user_id, month)
    REFERENCES public.finance_month_snapshots(user_id, month)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_finance_month_snapshot_entries_user_month
  ON public.finance_month_snapshot_entries (user_id, month, sort_order);

ALTER TABLE public.finance_month_snapshot_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'finance_month_snapshot_entries'
      AND policyname = 'finance_month_snapshot_entries_select'
  ) THEN
    CREATE POLICY "finance_month_snapshot_entries_select"
      ON public.finance_month_snapshot_entries
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================
-- Função actualizada: arquiva totais E lançamentos para meses passados.
-- Idempotente — execuções repetidas não alteram dados já congelados.
-- ============================================================
CREATE OR REPLACE FUNCTION public.finance_ensure_month_snapshots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid         uuid := auth.uid();
  month_start date := (date_trunc('month', timezone('utc', now())))::date;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  -- 1. Arquivar totais para meses passados (idempotente)
  INSERT INTO public.finance_month_snapshots (
    user_id, month, total_income, total_expenses, total_one_time, surplus, accumulated_surplus
  )
  SELECT s.user_id, s.month, s.total_income, s.total_expenses,
         s.total_one_time, s.surplus, s.accumulated_surplus
  FROM   public.finance_monthly_summary s
  WHERE  s.user_id = uid
    AND  s.month < month_start
  ON CONFLICT (user_id, month) DO NOTHING;

  -- 2. Arquivar lançamentos para os meses sem entradas ainda.
  --    Para cada mês cujo snapshot existe mas ainda não tem linhas na tabela
  --    de entradas, inserimos todas as receitas, despesas e pontuais de uma só vez.
  --    A verificação NOT EXISTS é idempotente: após a primeira inserção o bloco
  --    não volta a ser executado para aquele mês.
  INSERT INTO public.finance_month_snapshot_entries (
    user_id, month, entry_type,
    category_name, category_color,
    item_name, amount, is_paid, due_date, sort_order
  )

  -- Receitas (NULL com tipo explícito para UNION com one_time.due_date DATE)
  SELECT ie.user_id, ie.month, 'income'::text,
         NULL::text, NULL::text,
         src.name, ie.amount, NULL::boolean, NULL::date,
         src.sort_order::INTEGER
  FROM   public.finance_income_entries ie
  JOIN   public.finance_income_sources src ON src.id = ie.source_id
  WHERE  ie.user_id   = uid
    AND  ie.month     < month_start
    AND  ie.amount    > 0
    AND  NOT EXISTS (
           SELECT 1 FROM public.finance_month_snapshot_entries e
           WHERE  e.user_id = uid AND e.month = ie.month
         )

  UNION ALL

  -- Despesas fixas (agrupadas por categoria via sort_order composto)
  SELECT ee.user_id, ee.month, 'expense'::text,
         ec.name, ec.color,
         ei.name, ee.amount, ee.is_paid, NULL::date,
         COALESCE(ec.sort_order::INTEGER * 10000, 999990000) + ei.sort_order::INTEGER
  FROM   public.finance_expense_entries ee
  JOIN   public.finance_expense_items     ei ON ei.id = ee.item_id
  LEFT JOIN public.finance_expense_categories ec ON ec.id = ei.category_id
  WHERE  ee.user_id = uid
    AND  ee.month   < month_start
    AND  ee.amount  > 0
    AND  NOT EXISTS (
           SELECT 1 FROM public.finance_month_snapshot_entries e
           WHERE  e.user_id = uid AND e.month = ee.month
         )

  UNION ALL

  -- Pontuais
  SELECT sub.user_id, sub.month, 'one_time'::text,
         NULL::text, NULL::text,
         sub.name, sub.amount, sub.is_paid, sub.due_date::date,
         (ROW_NUMBER() OVER (
           PARTITION BY sub.user_id, sub.month
           ORDER BY sub.created_at
         ))::INTEGER + 20000000
  FROM   public.finance_one_time_expenses sub
  WHERE  sub.user_id = uid
    AND  sub.month   < month_start
    AND  NOT EXISTS (
           SELECT 1 FROM public.finance_month_snapshot_entries e
           WHERE  e.user_id = uid AND e.month = sub.month
         );

END;
$$;

REVOKE ALL   ON FUNCTION public.finance_ensure_month_snapshots() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_ensure_month_snapshots() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_ensure_month_snapshots() TO service_role;

-- ============================================================
-- Função auxiliar: força snapshot do mês actual (para testes).
-- Sobrescreve totais e re-congela os lançamentos do mês corrente,
-- permitindo iterar sem esperar a virada do mês.
-- ============================================================
CREATE OR REPLACE FUNCTION public.finance_force_snapshot_current_month()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid       uuid := auth.uid();
  cur_month date := (date_trunc('month', timezone('utc', now())))::date;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  -- 1. Upsert totais do mês actual (sobrescreve se já existia)
  INSERT INTO public.finance_month_snapshots (
    user_id, month, total_income, total_expenses, total_one_time,
    surplus, accumulated_surplus, snapshot_at
  )
  SELECT s.user_id, s.month,
         s.total_income, s.total_expenses, s.total_one_time,
         s.surplus, s.accumulated_surplus,
         NOW()
  FROM   public.finance_monthly_summary s
  WHERE  s.user_id = uid AND s.month = cur_month
  ON CONFLICT (user_id, month) DO UPDATE SET
    total_income        = EXCLUDED.total_income,
    total_expenses      = EXCLUDED.total_expenses,
    total_one_time      = EXCLUDED.total_one_time,
    surplus             = EXCLUDED.surplus,
    accumulated_surplus = EXCLUDED.accumulated_surplus,
    snapshot_at         = EXCLUDED.snapshot_at;

  -- 2. Re-congelar lançamentos do mês actual (DELETE + INSERT para dados frescos)
  DELETE FROM public.finance_month_snapshot_entries
  WHERE  user_id = uid AND month = cur_month;

  INSERT INTO public.finance_month_snapshot_entries (
    user_id, month, entry_type,
    category_name, category_color,
    item_name, amount, is_paid, due_date, sort_order
  )

  SELECT ie.user_id, ie.month, 'income'::text,
         NULL::text, NULL::text,
         src.name, ie.amount, NULL::boolean, NULL::date,
         src.sort_order::INTEGER
  FROM   public.finance_income_entries ie
  JOIN   public.finance_income_sources src ON src.id = ie.source_id
  WHERE  ie.user_id = uid AND ie.month = cur_month AND ie.amount > 0

  UNION ALL

  SELECT ee.user_id, ee.month, 'expense'::text,
         ec.name, ec.color,
         ei.name, ee.amount, ee.is_paid, NULL::date,
         COALESCE(ec.sort_order::INTEGER * 10000, 999990000) + ei.sort_order::INTEGER
  FROM   public.finance_expense_entries ee
  JOIN   public.finance_expense_items     ei ON ei.id = ee.item_id
  LEFT JOIN public.finance_expense_categories ec ON ec.id = ei.category_id
  WHERE  ee.user_id = uid AND ee.month = cur_month AND ee.amount > 0

  UNION ALL

  SELECT sub.user_id, sub.month, 'one_time'::text,
         NULL::text, NULL::text,
         sub.name, sub.amount, sub.is_paid, sub.due_date::date,
         (ROW_NUMBER() OVER (
           PARTITION BY sub.user_id, sub.month
           ORDER BY sub.created_at
         ))::INTEGER + 20000000
  FROM   public.finance_one_time_expenses sub
  WHERE  sub.user_id = uid AND sub.month = cur_month;

  -- 3. Garantir também que meses passados estão arquivados (delega ao ensure)
  INSERT INTO public.finance_month_snapshots (
    user_id, month, total_income, total_expenses, total_one_time, surplus, accumulated_surplus
  )
  SELECT s.user_id, s.month, s.total_income, s.total_expenses,
         s.total_one_time, s.surplus, s.accumulated_surplus
  FROM   public.finance_monthly_summary s
  WHERE  s.user_id = uid AND s.month < cur_month
  ON CONFLICT (user_id, month) DO NOTHING;

  INSERT INTO public.finance_month_snapshot_entries (
    user_id, month, entry_type,
    category_name, category_color,
    item_name, amount, is_paid, due_date, sort_order
  )
  SELECT ie.user_id, ie.month, 'income'::text,
         NULL::text, NULL::text,
         src.name, ie.amount, NULL::boolean, NULL::date,
         src.sort_order::INTEGER
  FROM   public.finance_income_entries ie
  JOIN   public.finance_income_sources src ON src.id = ie.source_id
  WHERE  ie.user_id = uid AND ie.month < cur_month AND ie.amount > 0
    AND  NOT EXISTS (
           SELECT 1 FROM public.finance_month_snapshot_entries e
           WHERE  e.user_id = uid AND e.month = ie.month
         )
  UNION ALL
  SELECT ee.user_id, ee.month, 'expense'::text,
         ec.name, ec.color,
         ei.name, ee.amount, ee.is_paid, NULL::date,
         COALESCE(ec.sort_order::INTEGER * 10000, 999990000) + ei.sort_order::INTEGER
  FROM   public.finance_expense_entries ee
  JOIN   public.finance_expense_items     ei ON ei.id = ee.item_id
  LEFT JOIN public.finance_expense_categories ec ON ec.id = ei.category_id
  WHERE  ee.user_id = uid AND ee.month < cur_month AND ee.amount > 0
    AND  NOT EXISTS (
           SELECT 1 FROM public.finance_month_snapshot_entries e
           WHERE  e.user_id = uid AND e.month = ee.month
         )
  UNION ALL
  SELECT sub.user_id, sub.month, 'one_time'::text,
         NULL::text, NULL::text,
         sub.name, sub.amount, sub.is_paid, sub.due_date::date,
         (ROW_NUMBER() OVER (
           PARTITION BY sub.user_id, sub.month
           ORDER BY sub.created_at
         ))::INTEGER + 20000000
  FROM   public.finance_one_time_expenses sub
  WHERE  sub.user_id = uid AND sub.month < cur_month
    AND  NOT EXISTS (
           SELECT 1 FROM public.finance_month_snapshot_entries e
           WHERE  e.user_id = uid AND e.month = sub.month
         );

END;
$$;

REVOKE ALL   ON FUNCTION public.finance_force_snapshot_current_month() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_force_snapshot_current_month() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_force_snapshot_current_month() TO service_role;
