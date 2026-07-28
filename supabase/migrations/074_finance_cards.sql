-- ============================================================
-- NEXUS FINANCE — Cartões como item de despesa (fase 1)
--
-- Problema: o cartão é meio de pagamento, não gasto. Lançar a fatura
-- como item de despesa E lançar o que se comprou com ela conta o
-- mesmo dinheiro duas vezes; lançar só a fatura dá um blob que nenhum
-- percentual do orçamento consegue descrever.
--
-- Desenho: o cartão NÃO ganha entidade própria. A fatura já é uma
-- linha da planilha (`Itau Black`, com valor mês a mês) — marca-se
-- essa linha como cartão e as outras linhas passam a poder dizer que
-- são pagas lá dentro. Assim não há segundo sítio para escrever o
-- mesmo número, e o par estimativa/real (`default_amount` × valor do
-- mês), o dia de vencimento e o visto de pago vêm todos de borla,
-- porque o item já os tem.
--
-- Viragem: uma linha paga dentro de outra deixa de SOMAR e passa a
-- DECOMPOR. O total do mês passa a ser
--
--     soma das linhas que não são pagas dentro de outra
--
-- e a duplicação deixa de ser evitável por disciplina — passa a ser
-- irrepresentável. Uma cláusula WHERE, e mais nada.
--
-- O "restante" (fatura menos o que já foi detalhado) nunca é gravado:
-- é subtração, calculada aqui.
--
-- Compatibilidade: enquanto nenhuma linha apontar para outra, tudo
-- soma exatamente como sempre somou. Aplicar isto não mexe num único
-- total existente, e não há dados para migrar — a linha do cartão
-- fica onde está, com o histórico intacto.
-- ============================================================

-- ------------------------------------------------------------
-- 1) As duas colunas
-- ------------------------------------------------------------
ALTER TABLE public.finance_expense_items
  ADD COLUMN IF NOT EXISTS is_card BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.finance_expense_items
  ADD COLUMN IF NOT EXISTS paid_with_item_id UUID
    REFERENCES public.finance_expense_items(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.finance_expense_items.is_card IS
  'Esta linha é a fatura de um cartão: o seu valor mensal é o total da fatura, e outras linhas podem declarar-se pagas dentro dela.';

COMMENT ON COLUMN public.finance_expense_items.paid_with_item_id IS
  'Item-cartão dentro do qual esta despesa é paga. Se preenchido, os lançamentos deste item NÃO somam ao total do mês: decompõem a fatura. NULL = pago fora de cartão e soma normalmente.';

DO $$ BEGIN
  -- Um item não pode ser pago dentro de si próprio.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_expense_items_paid_with_self_chk'
  ) THEN
    ALTER TABLE public.finance_expense_items
      ADD CONSTRAINT finance_expense_items_paid_with_self_chk
        CHECK (paid_with_item_id IS NULL OR paid_with_item_id <> id);
  END IF;

  -- Um cartão não se paga dentro de outro cartão: a decomposição é de um
  -- nível só, e as vistas abaixo assumem isso.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_expense_items_card_not_nested_chk'
  ) THEN
    ALTER TABLE public.finance_expense_items
      ADD CONSTRAINT finance_expense_items_card_not_nested_chk
        CHECK (NOT (is_card AND paid_with_item_id IS NOT NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_finance_expense_items_paid_with
  ON public.finance_expense_items (user_id, paid_with_item_id);

-- ------------------------------------------------------------
-- 2) A decomposição: fatura × detalhado × restante
--
-- Uma linha por item-cartão e mês em que ele tenha lançamento.
--
-- residual_amount < 0 é estado de erro: você detalhou mais do que a
-- fatura. Fica negativo de propósito — a UI avisa. Truncar em zero
-- partiria a identidade entre este total e o de finance_monthly_summary,
-- e um número errado calado é pior que um número errado visível.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.finance_card_breakdown
WITH (security_invoker = true) AS
WITH itemized AS (
  SELECT ee.user_id, ei.paid_with_item_id AS card_item_id, ee.month,
         COALESCE(SUM(ee.amount), 0) AS itemized_amount,
         COUNT(*)                    AS itemized_count
  FROM   public.finance_expense_entries ee
  JOIN   public.finance_expense_items   ei ON ei.id = ee.item_id
  WHERE  ei.paid_with_item_id IS NOT NULL
  GROUP  BY ee.user_id, ei.paid_with_item_id, ee.month
)
SELECT
  ee.user_id,
  ei.id                                  AS card_item_id,
  ee.month,
  ei.name                                AS card_name,
  ee.amount                              AS invoice_amount,
  COALESCE(i.itemized_amount, 0)         AS itemized_amount,
  COALESCE(i.itemized_count, 0)          AS itemized_count,
  ee.amount - COALESCE(i.itemized_amount, 0) AS residual_amount,
  ee.is_paid
FROM   public.finance_expense_entries ee
JOIN   public.finance_expense_items   ei ON ei.id = ee.item_id
LEFT   JOIN itemized i
       ON i.user_id = ee.user_id AND i.card_item_id = ei.id AND i.month = ee.month
WHERE  ei.is_card;

COMMENT ON VIEW public.finance_card_breakdown IS
  'Fatura x detalhado x restante, por item-cartão e mês. O restante nunca é gravado: é o valor da linha do cartão menos a soma das linhas pagas dentro dela.';

-- ------------------------------------------------------------
-- 3) Resumo mensal — quem é pago dentro de outra linha não soma
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.finance_monthly_summary AS
WITH months AS (
  SELECT DISTINCT user_id, month FROM public.finance_income_entries
  UNION
  SELECT DISTINCT user_id, month FROM public.finance_expense_entries
  UNION
  SELECT DISTINCT user_id, month FROM public.finance_one_time_entries
),
-- Igual à 071: `currency_since` decide em que moeda cada mês é lido, para
-- marcar uma fonte como estrangeira não reinterpretar o histórico dela.
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
-- A viragem toda está nesta cláusula: a linha do cartão soma (é a
-- fatura); as linhas pagas dentro dela não somam (decompõem-na).
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
-- 4) Orçamento — a linha do cartão vale o seu RESTANTE
--
-- As linhas detalhadas contam no balde delas (é para isso que as
-- detalhas). A linha do cartão conta apenas o que sobra dela, no balde
-- que tu lhe deste — o restante herda o balde do cartão, como qualquer
-- outra despesa herda o do seu item.
--
-- Identidade que isto preserva:
--   detalhadas + (fatura - detalhadas) = fatura
-- logo o total por baldes fecha com o de finance_monthly_summary.
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
      ie.amount * public.finance_fx_factor(
        public.finance_income_entry_currency(
          src.currency,
          src.currency_since,
          ie.month,
          COALESCE(us.display_currency, 'BRL')
        ),
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
  COALESCE(i.income_recurring, 0)                                   AS income_recurring,
  COALESCE(o.income_one_time, 0)                                    AS income_one_time,
  COALESCE(f.fx_deduction, 0)     + COALESCE(o.ot_deduction, 0)     AS deductions,
  COALESCE(f.fx_essential, 0)     + COALESCE(o.ot_essential, 0)     AS essential,
  COALESCE(f.fx_optional, 0)      + COALESCE(o.ot_optional, 0)      AS optional,
  COALESCE(f.fx_investment, 0)    + COALESCE(o.ot_investment, 0)    AS investment,
  COALESCE(f.fx_unclassified, 0)  + COALESCE(o.ot_unclassified, 0)  AS unclassified,
  COALESCE(f.fx_unclassified_count, 0)
    + COALESCE(o.ot_unclassified_count, 0)                          AS unclassified_count,
  COALESCE(us.budget_pct_essential, 60)                             AS pct_essential,
  COALESCE(us.budget_pct_optional, 30)                              AS pct_optional,
  COALESCE(us.budget_pct_investment, 10)                            AS pct_investment,
  COALESCE(us.budget_include_one_time_income, false)                AS include_one_time_income
FROM months m
LEFT JOIN income   i  ON i.user_id  = m.user_id AND i.month  = m.month
LEFT JOIN one_time o  ON o.user_id  = m.user_id AND o.month  = m.month
LEFT JOIN fixed    f  ON f.user_id  = m.user_id AND f.month  = m.month
LEFT JOIN public.finance_user_settings us ON us.user_id = m.user_id;

COMMENT ON VIEW public.finance_budget_monthly IS
  'Totais por balde do orçamento, por mês. Receitas já convertidas para a moeda de exibição (mesma lógica de finance_monthly_summary). A linha de um cartão conta apenas o seu restante — o que já foi detalhado conta nos baldes das linhas detalhadas. A base de cálculo NÃO vem pronta: é income_recurring [+ income_one_time se include_one_time_income] - deductions, calculada no cliente para a tela poder mostrar a escada.';

-- ------------------------------------------------------------
-- 5) Arquivo do mês — a linha do cartão congela pelo restante
--
-- As linhas detalhadas são arquivadas uma a uma (é o detalhe que se
-- quer poder consultar daqui a um ano) e a linha do cartão é arquivada
-- pelo que lhe sobra, com o nome a dizê-lo. Assim a soma das linhas
-- arquivadas continua a bater exatamente com o total congelado no
-- cabeçalho, sem precisar de flag nem de mudar quem lê o histórico:
--   detalhado + restante = fatura.
--
-- Esta vista existe para as duas funções de arquivo não repetirem a
-- subtração — e para ela ser corrigida num sítio só.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.finance_expense_archive_rows
WITH (security_invoker = true) AS
WITH children AS (
  SELECT ee.user_id, ei.paid_with_item_id AS card_item_id, ee.month,
         COALESCE(SUM(ee.amount), 0) AS total
  FROM   public.finance_expense_entries ee
  JOIN   public.finance_expense_items   ei ON ei.id = ee.item_id
  WHERE  ei.paid_with_item_id IS NOT NULL
  GROUP  BY ee.user_id, ei.paid_with_item_id, ee.month
)
SELECT
  ee.user_id,
  ee.month,
  ec.name  AS category_name,
  ec.color AS category_color,
  CASE
    WHEN ei.is_card AND COALESCE(c.total, 0) <> 0 THEN ei.name || ' — restante'
    ELSE ei.name
  END AS item_name,
  CASE
    WHEN ei.is_card THEN ee.amount - COALESCE(c.total, 0)
    ELSE ee.amount
  END AS amount,
  ee.is_paid,
  COALESCE(ec.sort_order::INTEGER * 10000, 999990000) + ei.sort_order::INTEGER AS sort_order,
  ee.paid_note,
  ei.is_card
FROM   public.finance_expense_entries ee
JOIN   public.finance_expense_items     ei ON ei.id = ee.item_id
LEFT   JOIN public.finance_expense_categories ec ON ec.id = ei.category_id
LEFT   JOIN children c
       ON c.user_id = ee.user_id AND c.card_item_id = ei.id AND c.month = ee.month;

COMMENT ON VIEW public.finance_expense_archive_rows IS
  'Linhas de despesa como devem ser congeladas no arquivo do mês: a linha de um cartão pelo seu restante, tudo o resto pelo seu valor.';

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
