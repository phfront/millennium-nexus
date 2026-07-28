-- ============================================================
-- NEXUS FINANCE — A moeda de uma fonte vale a partir de um mês
--
-- Sem isto, marcar uma fonte como GBP reinterpretava TODO o histórico
-- dela como libras e os meses passados passavam a oscilar com o câmbio
-- de hoje. `currency_since` fixa a fronteira: lançamentos anteriores a
-- esse mês continuam a ser lidos na moeda padrão, sem conversão.
-- ============================================================

ALTER TABLE public.finance_income_sources
  ADD COLUMN IF NOT EXISTS currency_since DATE;

COMMENT ON COLUMN public.finance_income_sources.currency_since IS
  'Primeiro mês (dia 01) em que `currency` se aplica. Meses anteriores são lidos na moeda padrão do utilizador. NULL = a moeda vale para todo o histórico da fonte.';

-- Moeda efetiva de um lançamento: depende do mês, por causa de `currency_since`.
CREATE OR REPLACE FUNCTION public.finance_income_entry_currency(
  p_source_currency TEXT,
  p_currency_since  DATE,
  p_month           DATE,
  p_display         TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_source_currency IS NULL THEN p_display
    WHEN p_currency_since IS NOT NULL AND p_month < p_currency_since THEN p_display
    ELSE p_source_currency
  END;
$$;

COMMENT ON FUNCTION public.finance_income_entry_currency(TEXT, DATE, DATE, TEXT) IS
  'Moeda em que um lançamento de receita deve ser lido: a da fonte a partir de `currency_since`, a de exibição antes disso.';

-- ------------------------------------------------------------
-- VIEW: igual à 070, mas a moeda de origem passa a ser por lançamento
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.finance_monthly_summary AS
WITH months AS (
  SELECT DISTINCT user_id, month FROM public.finance_income_entries
  UNION
  SELECT DISTINCT user_id, month FROM public.finance_expense_entries
  UNION
  SELECT DISTINCT user_id, month FROM public.finance_one_time_entries
),
income AS (
  SELECT
    ie.user_id,
    ie.month,
    COALESCE(SUM(
      ie.amount * public.finance_fx_factor(
        public.finance_income_entry_currency(
          src.currency, src.currency_since, ie.month, COALESCE(us.display_currency, 'BRL')
        ),
        COALESCE(us.display_currency, 'BRL')
      )
    ), 0) AS total_income
  FROM public.finance_income_entries ie
  JOIN public.finance_income_sources src ON src.id = ie.source_id
  LEFT JOIN public.finance_user_settings us ON us.user_id = ie.user_id
  GROUP BY ie.user_id, ie.month
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

ALTER VIEW public.finance_monthly_summary SET (security_invoker = true);

-- ------------------------------------------------------------
-- Snapshots: mesma regra ao congelar os lançamentos de receita
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_ensure_month_snapshots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid         uuid := auth.uid();
  month_start date := (date_trunc('month', timezone('utc', now())))::date;
  v_display   text;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  SELECT display_currency INTO v_display
  FROM   public.finance_user_settings WHERE user_id = uid;
  v_display := COALESCE(v_display, 'BRL');

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
         src.name,
         ie.amount * public.finance_fx_factor(
           public.finance_income_entry_currency(src.currency, src.currency_since, ie.month, v_display),
           v_display
         ),
         NULL::boolean, NULL::date,
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
  uid       uuid := auth.uid();
  m         date := (date_trunc('month', p_month))::date;
  v_display text;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  SELECT display_currency INTO v_display
  FROM   public.finance_user_settings WHERE user_id = uid;
  v_display := COALESCE(v_display, 'BRL');

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
         src.name,
         ie.amount * public.finance_fx_factor(
           public.finance_income_entry_currency(src.currency, src.currency_since, ie.month, v_display),
           v_display
         ),
         NULL::boolean, NULL::date,
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
         src.name,
         ie.amount * public.finance_fx_factor(
           public.finance_income_entry_currency(src.currency, src.currency_since, ie.month, v_display),
           v_display
         ),
         NULL::boolean, NULL::date,
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
