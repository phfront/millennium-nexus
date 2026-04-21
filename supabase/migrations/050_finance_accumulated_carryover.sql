-- ============================================================
-- NEXUS FINANCE — Acumulado após "Concluir mês"
-- A sobra do mês concluído explicitamente deixa de integrar a
-- soma de acumulado dos meses seguintes (novo segmento).
-- Arquivos automáticos (mês < mês UTC actual) mantêm carryover.
-- ============================================================

ALTER TABLE public.finance_month_snapshots
  ADD COLUMN IF NOT EXISTS breaks_accumulated_carryover BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.finance_month_snapshots.breaks_accumulated_carryover IS
  'True quando o mês foi fechado via finance_complete_finance_month: a sobra deste mês não soma no acumulado dos meses posteriores.';

-- VIEW: mesmo cálculo de totais/sobra; acumulado por segmento entre meses com breaks_accumulated_carryover.
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
),
base AS (
  SELECT
    m.user_id,
    m.month,
    COALESCE(i.total_income, 0) + COALESCE(ot.ot_inc, 0) AS total_income,
    COALESCE(e.total_expenses, 0) AS total_expenses,
    COALESCE(ot.ot_exp, 0) AS total_one_time,
    COALESCE(i.total_income, 0) + COALESCE(ot.ot_inc, 0)
      - COALESCE(e.total_expenses, 0)
      - COALESCE(ot.ot_exp, 0) AS surplus,
    (
      SELECT COUNT(*)::bigint
      FROM public.finance_month_snapshots b
      WHERE b.user_id = m.user_id
        AND b.breaks_accumulated_carryover
        AND b.month < m.month
    ) AS carry_segment
  FROM months m
  LEFT JOIN income i ON i.user_id = m.user_id AND i.month = m.month
  LEFT JOIN expenses e ON e.user_id = m.user_id AND e.month = m.month
  LEFT JOIN one_time_split ot ON ot.user_id = m.user_id AND ot.month = m.month
)
SELECT
  user_id,
  month,
  total_income,
  total_expenses,
  total_one_time,
  surplus,
  SUM(surplus) OVER (
    PARTITION BY user_id, carry_segment
    ORDER BY month
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS accumulated_surplus
FROM base;

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
    surplus, accumulated_surplus, snapshot_at, breaks_accumulated_carryover
  )
  SELECT s.user_id, s.month,
         s.total_income, s.total_expenses, s.total_one_time,
         s.surplus, s.accumulated_surplus,
         NOW(),
         TRUE
  FROM   public.finance_monthly_summary s
  WHERE  s.user_id = uid AND s.month = m
  ON CONFLICT (user_id, month) DO UPDATE SET
    total_income                   = EXCLUDED.total_income,
    total_expenses                 = EXCLUDED.total_expenses,
    total_one_time                 = EXCLUDED.total_one_time,
    surplus                        = EXCLUDED.surplus,
    accumulated_surplus            = EXCLUDED.accumulated_surplus,
    snapshot_at                    = EXCLUDED.snapshot_at,
    breaks_accumulated_carryover   = TRUE;

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
