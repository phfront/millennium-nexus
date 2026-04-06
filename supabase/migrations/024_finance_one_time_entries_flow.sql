-- ============================================================
-- NEXUS FINANCE — Pontuais: tabela genérica (despesa ou receita)
-- Renomeia finance_one_time_expenses → finance_one_time_entries + coluna flow
-- ============================================================

ALTER TABLE public.finance_one_time_expenses
  ADD COLUMN IF NOT EXISTS flow TEXT DEFAULT 'expense';

UPDATE public.finance_one_time_expenses SET flow = 'expense' WHERE flow IS NULL;

ALTER TABLE public.finance_one_time_expenses
  ALTER COLUMN flow SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.finance_one_time_expenses
    ADD CONSTRAINT finance_one_time_flow_chk CHECK (flow IN ('expense', 'income'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.finance_one_time_expenses RENAME TO finance_one_time_entries;

COMMENT ON TABLE public.finance_one_time_entries IS
  'Lançamentos pontuais não recorrentes: despesa (flow=expense) ou receita (flow=income).';

ALTER TABLE public.finance_month_snapshot_entries
  ADD COLUMN IF NOT EXISTS one_time_flow TEXT;

DO $$ BEGIN
  ALTER TABLE public.finance_month_snapshot_entries
    ADD CONSTRAINT finance_snapshot_one_time_flow_chk
    CHECK (one_time_flow IS NULL OR one_time_flow IN ('expense', 'income'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.finance_month_snapshot_entries.one_time_flow IS
  'Preenchido só quando entry_type = one_time: despesa ou receita pontual.';

-- VIEW: totais — receitas recorrentes + pontuais (receita); despesas fixas; pontuais só despesa em total_one_time
CREATE OR REPLACE VIEW public.finance_monthly_summary AS
WITH months AS (
  SELECT DISTINCT user_id, month FROM public.finance_income_entries
  UNION
  SELECT DISTINCT user_id, month FROM public.finance_expense_entries
  UNION
  SELECT DISTINCT user_id, month FROM public.finance_one_time_entries
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
one_time_split AS (
  SELECT
    user_id,
    month,
    COALESCE(SUM(amount) FILTER (WHERE flow = 'expense'), 0) AS ot_exp,
    COALESCE(SUM(amount) FILTER (WHERE flow = 'income'), 0) AS ot_inc
  FROM public.finance_one_time_entries
  GROUP BY user_id, month
)
SELECT
  m.user_id,
  m.month,
  COALESCE(i.total_income, 0) + COALESCE(ot.ot_inc, 0) AS total_income,
  COALESCE(e.total_expenses, 0) AS total_expenses,
  COALESCE(ot.ot_exp, 0) AS total_one_time,
  COALESCE(i.total_income, 0) + COALESCE(ot.ot_inc, 0)
    - COALESCE(e.total_expenses, 0)
    - COALESCE(ot.ot_exp, 0) AS surplus,
  SUM(
    COALESCE(i.total_income, 0) + COALESCE(ot.ot_inc, 0)
      - COALESCE(e.total_expenses, 0)
      - COALESCE(ot.ot_exp, 0)
  ) OVER (
    PARTITION BY m.user_id
    ORDER BY m.month
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS accumulated_surplus
FROM months m
LEFT JOIN income i ON i.user_id = m.user_id AND i.month = m.month
LEFT JOIN expenses e ON e.user_id = m.user_id AND e.month = m.month
LEFT JOIN one_time_split ot ON ot.user_id = m.user_id AND ot.month = m.month;

-- ============================================================
-- Snapshots automáticos + conclusão de mês (com one_time_flow)
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

  INSERT INTO public.finance_month_snapshots (
    user_id, month, total_income, total_expenses, total_one_time, surplus, accumulated_surplus
  )
  SELECT s.user_id, s.month, s.total_income, s.total_expenses,
         s.total_one_time, s.surplus, s.accumulated_surplus
  FROM   public.finance_monthly_summary s
  WHERE  s.user_id = uid
    AND  s.month < month_start
  ON CONFLICT (user_id, month) DO NOTHING;

  INSERT INTO public.finance_month_snapshot_entries (
    user_id, month, entry_type,
    category_name, category_color,
    item_name, amount, is_paid, due_date, sort_order, paid_note, one_time_flow
  )

  SELECT ie.user_id, ie.month, 'income'::text,
         NULL::text, NULL::text,
         src.name, ie.amount, NULL::boolean, NULL::date,
         src.sort_order::INTEGER,
         NULL::text,
         NULL::text
  FROM   public.finance_income_entries ie
  JOIN   public.finance_income_sources src ON src.id = ie.source_id
  WHERE  ie.user_id   = uid
    AND  ie.month     < month_start
    AND  ie.amount    >= 0
    AND  NOT EXISTS (
           SELECT 1 FROM public.finance_month_snapshot_entries e
           WHERE  e.user_id = uid AND e.month = ie.month
         )

  UNION ALL

  SELECT ee.user_id, ee.month, 'expense'::text,
         ec.name, ec.color,
         ei.name, ee.amount, ee.is_paid, NULL::date,
         COALESCE(ec.sort_order::INTEGER * 10000, 999990000) + ei.sort_order::INTEGER,
         ee.paid_note,
         NULL::text
  FROM   public.finance_expense_entries ee
  JOIN   public.finance_expense_items     ei ON ei.id = ee.item_id
  LEFT JOIN public.finance_expense_categories ec ON ec.id = ei.category_id
  WHERE  ee.user_id = uid
    AND  ee.month   < month_start
    AND  ee.amount  >= 0
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
         ))::INTEGER + 20000000,
         sub.paid_note,
         sub.flow::text
  FROM   public.finance_one_time_entries sub
  WHERE  sub.user_id = uid
    AND  sub.month   < month_start
    AND  NOT EXISTS (
           SELECT 1 FROM public.finance_month_snapshot_entries e
           WHERE  e.user_id = uid AND e.month = sub.month
         );

END;
$$;

CREATE OR REPLACE FUNCTION public.finance_complete_finance_month(p_month date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  m   date := (date_trunc('month', p_month))::date;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  INSERT INTO public.finance_month_snapshots (
    user_id, month, total_income, total_expenses, total_one_time,
    surplus, accumulated_surplus, snapshot_at
  )
  SELECT s.user_id, s.month,
         s.total_income, s.total_expenses, s.total_one_time,
         s.surplus, s.accumulated_surplus,
         NOW()
  FROM   public.finance_monthly_summary s
  WHERE  s.user_id = uid AND s.month = m
  ON CONFLICT (user_id, month) DO UPDATE SET
    total_income        = EXCLUDED.total_income,
    total_expenses      = EXCLUDED.total_expenses,
    total_one_time      = EXCLUDED.total_one_time,
    surplus             = EXCLUDED.surplus,
    accumulated_surplus = EXCLUDED.accumulated_surplus,
    snapshot_at         = EXCLUDED.snapshot_at;

  DELETE FROM public.finance_month_snapshot_entries
  WHERE  user_id = uid AND month = m;

  INSERT INTO public.finance_month_snapshot_entries (
    user_id, month, entry_type,
    category_name, category_color,
    item_name, amount, is_paid, due_date, sort_order, paid_note, one_time_flow
  )

  SELECT ie.user_id, ie.month, 'income'::text,
         NULL::text, NULL::text,
         src.name, ie.amount, NULL::boolean, NULL::date,
         src.sort_order::INTEGER,
         NULL::text,
         NULL::text
  FROM   public.finance_income_entries ie
  JOIN   public.finance_income_sources src ON src.id = ie.source_id
  WHERE  ie.user_id = uid AND ie.month = m AND ie.amount >= 0

  UNION ALL

  SELECT ee.user_id, ee.month, 'expense'::text,
         ec.name, ec.color,
         ei.name, ee.amount, ee.is_paid, NULL::date,
         COALESCE(ec.sort_order::INTEGER * 10000, 999990000) + ei.sort_order::INTEGER,
         ee.paid_note,
         NULL::text
  FROM   public.finance_expense_entries ee
  JOIN   public.finance_expense_items     ei ON ei.id = ee.item_id
  LEFT JOIN public.finance_expense_categories ec ON ec.id = ei.category_id
  WHERE  ee.user_id = uid AND ee.month = m AND ee.amount >= 0

  UNION ALL

  SELECT sub.user_id, sub.month, 'one_time'::text,
         NULL::text, NULL::text,
         sub.name, sub.amount, sub.is_paid, sub.due_date::date,
         (ROW_NUMBER() OVER (
           PARTITION BY sub.user_id, sub.month
           ORDER BY sub.created_at
         ))::INTEGER + 20000000,
         sub.paid_note,
         sub.flow::text
  FROM   public.finance_one_time_entries sub
  WHERE  sub.user_id = uid AND sub.month = m;

  INSERT INTO public.finance_month_snapshots (
    user_id, month, total_income, total_expenses, total_one_time, surplus, accumulated_surplus
  )
  SELECT s.user_id, s.month, s.total_income, s.total_expenses,
         s.total_one_time, s.surplus, s.accumulated_surplus
  FROM   public.finance_monthly_summary s
  WHERE  s.user_id = uid AND s.month < m
  ON CONFLICT (user_id, month) DO NOTHING;

  INSERT INTO public.finance_month_snapshot_entries (
    user_id, month, entry_type,
    category_name, category_color,
    item_name, amount, is_paid, due_date, sort_order, paid_note, one_time_flow
  )
  SELECT ie.user_id, ie.month, 'income'::text,
         NULL::text, NULL::text,
         src.name, ie.amount, NULL::boolean, NULL::date,
         src.sort_order::INTEGER,
         NULL::text,
         NULL::text
  FROM   public.finance_income_entries ie
  JOIN   public.finance_income_sources src ON src.id = ie.source_id
  WHERE  ie.user_id = uid AND ie.month < m AND ie.amount >= 0
    AND  NOT EXISTS (
           SELECT 1 FROM public.finance_month_snapshot_entries e
           WHERE  e.user_id = uid AND e.month = ie.month
         )
  UNION ALL
  SELECT ee.user_id, ee.month, 'expense'::text,
         ec.name, ec.color,
         ei.name, ee.amount, ee.is_paid, NULL::date,
         COALESCE(ec.sort_order::INTEGER * 10000, 999990000) + ei.sort_order::INTEGER,
         ee.paid_note,
         NULL::text
  FROM   public.finance_expense_entries ee
  JOIN   public.finance_expense_items     ei ON ei.id = ee.item_id
  LEFT JOIN public.finance_expense_categories ec ON ec.id = ei.category_id
  WHERE  ee.user_id = uid AND ee.month < m AND ee.amount >= 0
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
         ))::INTEGER + 20000000,
         sub.paid_note,
         sub.flow::text
  FROM   public.finance_one_time_entries sub
  WHERE  sub.user_id = uid AND sub.month < m
    AND  NOT EXISTS (
           SELECT 1 FROM public.finance_month_snapshot_entries e
           WHERE  e.user_id = uid AND e.month = sub.month
         );

END;
$$;
