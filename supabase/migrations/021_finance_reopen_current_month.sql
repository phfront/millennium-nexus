-- ============================================================
-- NEXUS FINANCE — Concluir / reabrir mês por data (alinhado ao stepper)
-- ============================================================

-- Conclui (snapshot + linhas) para o 1º dia do mês indicado.
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
    item_name, amount, is_paid, due_date, sort_order
  )

  SELECT ie.user_id, ie.month, 'income'::text,
         NULL::text, NULL::text,
         src.name, ie.amount, NULL::boolean, NULL::date,
         src.sort_order::INTEGER
  FROM   public.finance_income_entries ie
  JOIN   public.finance_income_sources src ON src.id = ie.source_id
  WHERE  ie.user_id = uid AND ie.month = m AND ie.amount > 0

  UNION ALL

  SELECT ee.user_id, ee.month, 'expense'::text,
         ec.name, ec.color,
         ei.name, ee.amount, ee.is_paid, NULL::date,
         COALESCE(ec.sort_order::INTEGER * 10000, 999990000) + ei.sort_order::INTEGER
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
         ))::INTEGER + 20000000
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
    item_name, amount, is_paid, due_date, sort_order
  )
  SELECT ie.user_id, ie.month, 'income'::text,
         NULL::text, NULL::text,
         src.name, ie.amount, NULL::boolean, NULL::date,
         src.sort_order::INTEGER
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
         COALESCE(ec.sort_order::INTEGER * 10000, 999990000) + ei.sort_order::INTEGER
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
         ))::INTEGER + 20000000
  FROM   public.finance_one_time_expenses sub
  WHERE  sub.user_id = uid AND sub.month < m
    AND  NOT EXISTS (
           SELECT 1 FROM public.finance_month_snapshot_entries e
           WHERE  e.user_id = uid AND e.month = sub.month
         );

END;
$$;

REVOKE ALL   ON FUNCTION public.finance_complete_finance_month(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_complete_finance_month(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_complete_finance_month(date) TO service_role;

-- Remove arquivo do mês indicado (CASCADE nas linhas congeladas).
CREATE OR REPLACE FUNCTION public.finance_reopen_month(p_month date)
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

  DELETE FROM public.finance_month_snapshots
  WHERE  user_id = uid AND month = m;
END;
$$;

REVOKE ALL   ON FUNCTION public.finance_reopen_month(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_reopen_month(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_reopen_month(date) TO service_role;

-- Mantém compatibilidade: força snapshot do mês UTC (testes / chamadas antigas).
CREATE OR REPLACE FUNCTION public.finance_force_snapshot_current_month()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.finance_complete_finance_month(
    (date_trunc('month', timezone('utc', now())))::date
  );
END;
$$;

REVOKE ALL   ON FUNCTION public.finance_force_snapshot_current_month() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_force_snapshot_current_month() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_force_snapshot_current_month() TO service_role;

-- Remove função antiga se existir (primeira versão da migration 021).
DROP FUNCTION IF EXISTS public.finance_reopen_current_month();
