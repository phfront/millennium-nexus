-- ============================================================
-- NEXUS FINANCE — Nota opcional ao marcar despesa como paga
-- ============================================================

ALTER TABLE public.finance_expense_entries
  ADD COLUMN IF NOT EXISTS paid_note TEXT;

ALTER TABLE public.finance_one_time_expenses
  ADD COLUMN IF NOT EXISTS paid_note TEXT;

ALTER TABLE public.finance_month_snapshot_entries
  ADD COLUMN IF NOT EXISTS paid_note TEXT;

-- ============================================================
-- finance_ensure_month_snapshots — incluir paid_note nos lançamentos
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
    item_name, amount, is_paid, due_date, sort_order, paid_note
  )

  SELECT ie.user_id, ie.month, 'income'::text,
         NULL::text, NULL::text,
         src.name, ie.amount, NULL::boolean, NULL::date,
         src.sort_order::INTEGER,
         NULL::text
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

  SELECT ee.user_id, ee.month, 'expense'::text,
         ec.name, ec.color,
         ei.name, ee.amount, ee.is_paid, NULL::date,
         COALESCE(ec.sort_order::INTEGER * 10000, 999990000) + ei.sort_order::INTEGER,
         ee.paid_note
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

  SELECT sub.user_id, sub.month, 'one_time'::text,
         NULL::text, NULL::text,
         sub.name, sub.amount, sub.is_paid, sub.due_date::date,
         (ROW_NUMBER() OVER (
           PARTITION BY sub.user_id, sub.month
           ORDER BY sub.created_at
         ))::INTEGER + 20000000,
         sub.paid_note
  FROM   public.finance_one_time_expenses sub
  WHERE  sub.user_id = uid
    AND  sub.month   < month_start
    AND  NOT EXISTS (
           SELECT 1 FROM public.finance_month_snapshot_entries e
           WHERE  e.user_id = uid AND e.month = sub.month
         );

END;
$$;

-- ============================================================
-- finance_complete_finance_month — incluir paid_note
-- ============================================================
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
    item_name, amount, is_paid, due_date, sort_order, paid_note
  )

  SELECT ie.user_id, ie.month, 'income'::text,
         NULL::text, NULL::text,
         src.name, ie.amount, NULL::boolean, NULL::date,
         src.sort_order::INTEGER,
         NULL::text
  FROM   public.finance_income_entries ie
  JOIN   public.finance_income_sources src ON src.id = ie.source_id
  WHERE  ie.user_id = uid AND ie.month = m AND ie.amount > 0

  UNION ALL

  SELECT ee.user_id, ee.month, 'expense'::text,
         ec.name, ec.color,
         ei.name, ee.amount, ee.is_paid, NULL::date,
         COALESCE(ec.sort_order::INTEGER * 10000, 999990000) + ei.sort_order::INTEGER,
         ee.paid_note
  FROM   public.finance_expense_entries ee
  JOIN   public.finance_expense_items     ei ON ei.id = ee.item_id
  LEFT JOIN public.finance_expense_categories ec ON ec.id = ei.category_id
  WHERE  ee.user_id = uid AND ee.month = m AND ee.amount > 0

  UNION ALL

  SELECT sub.user_id, sub.month, 'one_time'::text,
         NULL::text, NULL::text,
         sub.name, sub.amount, sub.is_paid, sub.due_date::date,
         (ROW_NUMBER() OVER (
           PARTITION BY sub.user_id, sub.month
           ORDER BY sub.created_at
         ))::INTEGER + 20000000,
         sub.paid_note
  FROM   public.finance_one_time_expenses sub
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
    item_name, amount, is_paid, due_date, sort_order, paid_note
  )
  SELECT ie.user_id, ie.month, 'income'::text,
         NULL::text, NULL::text,
         src.name, ie.amount, NULL::boolean, NULL::date,
         src.sort_order::INTEGER,
         NULL::text
  FROM   public.finance_income_entries ie
  JOIN   public.finance_income_sources src ON src.id = ie.source_id
  WHERE  ie.user_id = uid AND ie.month < m AND ie.amount > 0
    AND  NOT EXISTS (
           SELECT 1 FROM public.finance_month_snapshot_entries e
           WHERE  e.user_id = uid AND e.month = ie.month
         )
  UNION ALL
  SELECT ee.user_id, ee.month, 'expense'::text,
         ec.name, ec.color,
         ei.name, ee.amount, ee.is_paid, NULL::date,
         COALESCE(ec.sort_order::INTEGER * 10000, 999990000) + ei.sort_order::INTEGER,
         ee.paid_note
  FROM   public.finance_expense_entries ee
  JOIN   public.finance_expense_items     ei ON ei.id = ee.item_id
  LEFT JOIN public.finance_expense_categories ec ON ec.id = ei.category_id
  WHERE  ee.user_id = uid AND ee.month < m AND ee.amount > 0
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
         sub.paid_note
  FROM   public.finance_one_time_expenses sub
  WHERE  sub.user_id = uid AND sub.month < m
    AND  NOT EXISTS (
           SELECT 1 FROM public.finance_month_snapshot_entries e
           WHERE  e.user_id = uid AND e.month = sub.month
         );

END;
$$;
