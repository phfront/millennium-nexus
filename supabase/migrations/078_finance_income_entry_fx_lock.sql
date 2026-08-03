-- ============================================================
-- NEXUS FINANCE — Cotação travada no lançamento de receita
--
-- A 071 resolveu METADE do problema do câmbio: `currency_since`
-- decide EM QUE MOEDA cada mês é lido. Continuava sem resposta a
-- outra metade: A QUE COTAÇÃO. Um salário de £2.830 lançado em
-- julho era convertido pela cotação de hoje — todos os dias, para
-- sempre. O mês passado mudava de valor sozinho.
--
-- O snapshot congelava, mas tarde e pelo número errado: só para
-- meses já fechados, e pela cotação do instante em que o arquivo
-- rodou — não a do dia em que o dinheiro caiu na conta.
--
-- Desenho: quando o dinheiro entra, a cotação daquele lançamento
-- deixa de ser uma estimativa e passa a ser um facto. `fx_rate`
-- guarda esse facto. Enquanto está NULL, o valor é uma previsão e
-- flutua com o mercado (que é o certo para meses futuros); assim
-- que é preenchida, aquele mês nunca mais muda.
--
-- `fx_quote_currency` existe porque a cotação travada é de um PAR.
-- Travar "1 GBP = R$ 6,7491" e depois mudar a moeda de exibição
-- para USD não pode fazer o 6,7491 valer como dólares. Guardando o
-- lado de destino, esse caso encadeia: trava o par GBP→BRL e
-- converte BRL→USD pela cotação viva.
--
-- Nota sobre a origem do número: a cotação normalmente é derivada
-- do valor que realmente caiu na conta (recebido ÷ valor bruto), e
-- por isso já inclui spread, IOF e tarifa do banco. É o câmbio
-- efetivo, não o de mercado — e é esse que interessa ao histórico.
-- ============================================================

-- ------------------------------------------------------------
-- 1) As colunas
-- ------------------------------------------------------------
ALTER TABLE public.finance_income_entries
  ADD COLUMN IF NOT EXISTS fx_rate           NUMERIC(20, 10),
  ADD COLUMN IF NOT EXISTS fx_quote_currency TEXT,
  ADD COLUMN IF NOT EXISTS fx_locked_at      TIMESTAMPTZ;

COMMENT ON COLUMN public.finance_income_entries.fx_rate IS
  'Cotação travada: quantas unidades de `fx_quote_currency` vale 1 unidade da moeda deste lançamento. NULL = ainda não recebido/travado, converte pela cotação viva. Normalmente derivada do valor que caiu na conta, por isso é o câmbio efetivo (com spread e tarifas), não o de mercado.';

COMMENT ON COLUMN public.finance_income_entries.fx_quote_currency IS
  'Moeda em que `fx_rate` foi cotada (o lado de destino do par). Se a moeda de exibição mudar depois, a conversão encadeia: travado até aqui, cotação viva daqui em diante.';

COMMENT ON COLUMN public.finance_income_entries.fx_locked_at IS
  'Quando a cotação foi travada. Serve de marcador de "esta receita já entrou" — é a única coisa que distingue um mês recebido de um mês previsto.';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_income_entries_fx_rate_pos'
  ) THEN
    ALTER TABLE public.finance_income_entries
      ADD CONSTRAINT finance_income_entries_fx_rate_pos
        CHECK (fx_rate IS NULL OR fx_rate > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_income_entries_fx_quote_fmt'
  ) THEN
    ALTER TABLE public.finance_income_entries
      ADD CONSTRAINT finance_income_entries_fx_quote_fmt
        CHECK (fx_quote_currency IS NULL OR fx_quote_currency ~ '^[A-Z]{3}$');
  END IF;

  -- Uma cotação sem o par a que pertence não é uma cotação.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_income_entries_fx_pairing'
  ) THEN
    ALTER TABLE public.finance_income_entries
      ADD CONSTRAINT finance_income_entries_fx_pairing
        CHECK (
          (fx_rate IS NULL     AND fx_quote_currency IS NULL     AND fx_locked_at IS NULL)
          OR (fx_rate IS NOT NULL AND fx_quote_currency IS NOT NULL AND fx_locked_at IS NOT NULL)
        );
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2) O multiplicador de um lançamento: travado se houver, vivo se não
--
-- Passa a ser o único lugar que decide como converter uma receita.
-- Os quatro objetos abaixo chamam isto em vez de repetirem a dupla
-- finance_income_entry_currency + finance_fx_factor.
--
-- STABLE (não IMMUTABLE): consulta finance_exchange_rates quando não
-- há cotação travada.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_income_entry_factor(
  p_fx_rate         NUMERIC,
  p_fx_quote        TEXT,
  p_source_currency TEXT,
  p_currency_since  DATE,
  p_month           DATE,
  p_display         TEXT
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH e AS (
    SELECT public.finance_income_entry_currency(
             p_source_currency, p_currency_since, p_month, p_display
           ) AS entry_currency
  )
  SELECT CASE
    -- Mês lido na própria moeda de exibição: não há par, não há o que travar.
    -- (Inclui os meses anteriores a `currency_since` numa fonte estrangeira.)
    WHEN e.entry_currency = p_display THEN 1::numeric
    WHEN p_fx_rate IS NULL            THEN public.finance_fx_factor(e.entry_currency, p_display)
    WHEN p_fx_quote = p_display       THEN p_fx_rate
    -- Cotação travada noutro destino: encadeia o travado com o vivo.
    ELSE p_fx_rate * public.finance_fx_factor(p_fx_quote, p_display)
  END
  FROM e;
$$;

COMMENT ON FUNCTION public.finance_income_entry_factor(NUMERIC, TEXT, TEXT, DATE, DATE, TEXT) IS
  'Multiplicador para levar um lançamento de receita à moeda de exibição. Usa a cotação travada no lançamento quando existe; caso contrário, a cotação viva. É o que impede um mês já recebido de continuar a oscilar.';

-- ------------------------------------------------------------
-- 3) Resumo mensal (idêntico à 074; só o CTE `income` muda)
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
      ie.amount * public.finance_income_entry_factor(
        ie.fx_rate, ie.fx_quote_currency,
        src.currency, src.currency_since, ie.month,
        COALESCE(us.display_currency, 'BRL')
      )
    ), 0) AS total_income
  FROM public.finance_income_entries ie
  JOIN public.finance_income_sources src ON src.id = ie.source_id
  LEFT JOIN public.finance_user_settings us ON us.user_id = ie.user_id
  GROUP BY ie.user_id, ie.month
),
-- A linha do cartão soma (é a fatura); as linhas pagas dentro dela não.
expenses AS (
  SELECT ee.user_id, ee.month, COALESCE(SUM(ee.amount), 0) AS total_expenses
  FROM   public.finance_expense_entries ee
  JOIN   public.finance_expense_items   ei ON ei.id = ee.item_id
  WHERE  ei.paid_with_item_id IS NULL
  GROUP  BY ee.user_id, ee.month
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

-- CREATE OR REPLACE VIEW repõe security_invoker = false (ver 054).
ALTER VIEW public.finance_monthly_summary SET (security_invoker = true);

-- ------------------------------------------------------------
-- 4) Orçamento (idêntico à 075; só o CTE `income` muda)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.finance_budget_monthly
WITH (security_invoker = true) AS
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
      ie.amount * public.finance_income_entry_factor(
        ie.fx_rate, ie.fx_quote_currency,
        src.currency, src.currency_since, ie.month,
        COALESCE(us.display_currency, 'BRL')
      )
    ), 0) AS income_recurring
  FROM public.finance_income_entries ie
  JOIN public.finance_income_sources src ON src.id = ie.source_id
  LEFT JOIN public.finance_user_settings us ON us.user_id = ie.user_id
  GROUP BY ie.user_id, ie.month
),
one_time AS (
  SELECT
    user_id,
    month,
    COALESCE(SUM(amount) FILTER (WHERE flow = 'income'), 0) AS income_one_time,
    COALESCE(SUM(amount) FILTER (WHERE flow = 'expense' AND budget_class = 'essential'), 0)  AS ot_essential,
    COALESCE(SUM(amount) FILTER (WHERE flow = 'expense' AND budget_class = 'optional'), 0)   AS ot_optional,
    COALESCE(SUM(amount) FILTER (WHERE flow = 'expense' AND budget_class = 'investment'), 0) AS ot_investment,
    COALESCE(SUM(amount) FILTER (WHERE flow = 'expense' AND budget_class = 'deduction'), 0)  AS ot_deduction,
    COALESCE(SUM(amount) FILTER (WHERE flow = 'expense' AND budget_class IS NULL), 0)        AS ot_unclassified,
    COUNT(*) FILTER (WHERE flow = 'expense' AND budget_class IS NULL)                        AS ot_unclassified_count
  FROM public.finance_one_time_entries
  GROUP BY user_id, month
),
children AS (
  SELECT ee.user_id, ei.paid_with_item_id AS card_item_id, ee.month,
         COALESCE(SUM(ee.amount), 0) AS total
  FROM   public.finance_expense_entries ee
  JOIN   public.finance_expense_items   ei ON ei.id = ee.item_id
  WHERE  ei.paid_with_item_id IS NOT NULL
  GROUP  BY ee.user_id, ei.paid_with_item_id, ee.month
),
-- Valor que cada lançamento vale para o orçamento: o cartão vale o que
-- lhe sobra depois do que já foi detalhado; tudo o resto vale o seu valor.
eff AS (
  SELECT
    ee.user_id,
    ee.month,
    ei.id            AS item_id,
    ei.budget_class,
    CASE WHEN ei.is_card THEN ee.amount - COALESCE(c.total, 0) ELSE ee.amount END AS amount
  FROM   public.finance_expense_entries ee
  JOIN   public.finance_expense_items   ei ON ei.id = ee.item_id
  LEFT   JOIN children c
         ON c.user_id = ee.user_id AND c.card_item_id = ei.id AND c.month = ee.month
),
fixed AS (
  SELECT
    user_id,
    month,
    COALESCE(SUM(amount) FILTER (WHERE budget_class = 'essential'), 0)  AS fx_essential,
    COALESCE(SUM(amount) FILTER (WHERE budget_class = 'optional'), 0)   AS fx_optional,
    COALESCE(SUM(amount) FILTER (WHERE budget_class = 'investment'), 0) AS fx_investment,
    COALESCE(SUM(amount) FILTER (WHERE budget_class = 'deduction'), 0)  AS fx_deduction,
    COALESCE(SUM(amount) FILTER (WHERE budget_class IS NULL), 0)        AS fx_unclassified,
    COUNT(DISTINCT item_id) FILTER (WHERE budget_class IS NULL AND amount > 0) AS fx_unclassified_count
  FROM eff
  GROUP BY user_id, month
)
SELECT
  m.user_id,
  m.month,
  -- Base: se o mês está arquivado, vale o que ficou congelado — é o
  -- mesmo número que o Histórico mostra. Só meses vivos recalculam.
  COALESCE(snap.income_recurring, i.income_recurring, 0)                AS income_recurring,
  COALESCE(snap.income_one_time,  o.income_one_time,  0)                AS income_one_time,
  COALESCE(f.fx_deduction, 0)     + COALESCE(o.ot_deduction, 0)         AS deductions,
  COALESCE(f.fx_essential, 0)     + COALESCE(o.ot_essential, 0)         AS essential,
  COALESCE(f.fx_optional, 0)      + COALESCE(o.ot_optional, 0)          AS optional,
  COALESCE(f.fx_investment, 0)    + COALESCE(o.ot_investment, 0)        AS investment,
  COALESCE(f.fx_unclassified, 0)  + COALESCE(o.ot_unclassified, 0)      AS unclassified,
  COALESCE(f.fx_unclassified_count, 0)
    + COALESCE(o.ot_unclassified_count, 0)                              AS unclassified_count,
  -- Alvo em vigor NESTE mês, não o de hoje.
  COALESCE(tg.pct_essential,  us.budget_pct_essential,  60)             AS pct_essential,
  COALESCE(tg.pct_optional,   us.budget_pct_optional,   30)             AS pct_optional,
  COALESCE(tg.pct_investment, us.budget_pct_investment, 10)             AS pct_investment,
  COALESCE(tg.include_one_time_income, us.budget_include_one_time_income, false)
                                                                        AS include_one_time_income,
  (snap.user_id IS NOT NULL)                                            AS base_is_frozen
FROM months m
LEFT JOIN income   i  ON i.user_id  = m.user_id AND i.month  = m.month
LEFT JOIN one_time o  ON o.user_id  = m.user_id AND o.month  = m.month
LEFT JOIN fixed    f  ON f.user_id  = m.user_id AND f.month  = m.month
LEFT JOIN public.finance_month_snapshots snap
       ON snap.user_id = m.user_id AND snap.month = m.month
LEFT JOIN public.finance_user_settings us ON us.user_id = m.user_id
LEFT JOIN LATERAL (
  SELECT t.pct_essential, t.pct_optional, t.pct_investment, t.include_one_time_income
  FROM   public.finance_budget_targets t
  WHERE  t.user_id = m.user_id
    AND  t.effective_from <= m.month
  ORDER  BY t.effective_from DESC
  LIMIT  1
) tg ON TRUE;

COMMENT ON VIEW public.finance_budget_monthly IS
  'Totais por balde do orçamento, por mês. Os alvos são os que vigoravam em cada mês (finance_budget_targets), não os de hoje. A receita usa a cotação travada no lançamento quando existe. A base vem congelada do arquivo quando o mês já foi arquivado (base_is_frozen). Os valores por balde continuam vivos de propósito: reclassificar um item é uma correção e deve melhorar o passado. A linha de um cartão conta apenas o seu restante.';

-- ------------------------------------------------------------
-- 5) Arquivo (idêntico à 075; só a expressão da receita muda)
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
    user_id, month, total_income, total_expenses, total_one_time,
    surplus, accumulated_surplus, income_recurring, income_one_time
  )
  SELECT s.user_id, s.month, s.total_income, s.total_expenses,
         s.total_one_time, s.surplus, s.accumulated_surplus,
         sp.income_recurring, sp.income_one_time
  FROM   public.finance_monthly_summary s
  CROSS  JOIN LATERAL public.finance_snapshot_income_split(s.user_id, s.month, s.total_income) sp
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
         ie.amount * public.finance_income_entry_factor(
           ie.fx_rate, ie.fx_quote_currency,
           src.currency, src.currency_since, ie.month, v_display
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

  SELECT r.user_id, r.month, 'expense'::text,
         r.category_name, r.category_color,
         r.item_name, r.amount, r.is_paid, NULL::date,
         r.sort_order,
         r.paid_note,
         NULL::text
  FROM   public.finance_expense_archive_rows r
  WHERE  r.user_id = uid
    AND  r.month   < month_start
    AND  (r.amount >= 0 OR r.is_card)
    AND  NOT EXISTS (
           SELECT 1 FROM public.finance_month_snapshot_entries e
           WHERE  e.user_id = uid AND e.month = r.month
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
    surplus, accumulated_surplus, snapshot_at, breaks_accumulated_carryover,
    income_recurring, income_one_time
  )
  SELECT s.user_id, s.month,
         s.total_income, s.total_expenses, s.total_one_time,
         s.surplus, s.accumulated_surplus,
         NOW(),
         TRUE,
         sp.income_recurring, sp.income_one_time
  FROM   public.finance_monthly_summary s
  CROSS  JOIN LATERAL public.finance_snapshot_income_split(s.user_id, s.month, s.total_income) sp
  WHERE  s.user_id = uid AND s.month = m
  ON CONFLICT (user_id, month) DO UPDATE SET
    total_income                   = EXCLUDED.total_income,
    total_expenses                 = EXCLUDED.total_expenses,
    total_one_time                 = EXCLUDED.total_one_time,
    surplus                        = EXCLUDED.surplus,
    accumulated_surplus            = EXCLUDED.accumulated_surplus,
    snapshot_at                    = EXCLUDED.snapshot_at,
    breaks_accumulated_carryover   = TRUE,
    income_recurring               = EXCLUDED.income_recurring,
    income_one_time                = EXCLUDED.income_one_time;

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
         ie.amount * public.finance_income_entry_factor(
           ie.fx_rate, ie.fx_quote_currency,
           src.currency, src.currency_since, ie.month, v_display
         ),
         NULL::boolean, NULL::date,
         src.sort_order::INTEGER,
         NULL::text,
         NULL::text
  FROM   public.finance_income_entries ie
  JOIN   public.finance_income_sources src ON src.id = ie.source_id
  WHERE  ie.user_id = uid AND ie.month = m AND ie.amount >= 0

  UNION ALL

  SELECT r.user_id, r.month, 'expense'::text,
         r.category_name, r.category_color,
         r.item_name, r.amount, r.is_paid, NULL::date,
         r.sort_order,
         r.paid_note,
         NULL::text
  FROM   public.finance_expense_archive_rows r
  WHERE  r.user_id = uid AND r.month = m AND (r.amount >= 0 OR r.is_card)

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
    user_id, month, total_income, total_expenses, total_one_time,
    surplus, accumulated_surplus, income_recurring, income_one_time
  )
  SELECT s.user_id, s.month, s.total_income, s.total_expenses,
         s.total_one_time, s.surplus, s.accumulated_surplus,
         sp.income_recurring, sp.income_one_time
  FROM   public.finance_monthly_summary s
  CROSS  JOIN LATERAL public.finance_snapshot_income_split(s.user_id, s.month, s.total_income) sp
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
         ie.amount * public.finance_income_entry_factor(
           ie.fx_rate, ie.fx_quote_currency,
           src.currency, src.currency_since, ie.month, v_display
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

  SELECT r.user_id, r.month, 'expense'::text,
         r.category_name, r.category_color,
         r.item_name, r.amount, r.is_paid, NULL::date,
         r.sort_order,
         r.paid_note,
         NULL::text
  FROM   public.finance_expense_archive_rows r
  WHERE  r.user_id = uid AND r.month < m AND (r.amount >= 0 OR r.is_card)
    AND  NOT EXISTS (
           SELECT 1 FROM public.finance_month_snapshot_entries e
           WHERE  e.user_id = uid AND e.month = r.month
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
