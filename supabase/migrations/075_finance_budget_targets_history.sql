-- ============================================================
-- NEXUS FINANCE — Alvos do orçamento com histórico, e base
-- congelada nos meses já arquivados
--
-- Dois problemas, ambos do mesmo tipo: a tela de Orçamento era 100%
-- viva, mesmo para meses fechados.
--
-- 1) Os alvos viviam numa única linha (finance_user_settings). Mudar
--    o alvo hoje reescrevia o plano de todos os meses passados —
--    março passava a ter sido planeado com um número que só existe
--    desde hoje. Passam a ser uma série temporal: cada mês usa o alvo
--    que vigorava nele.
--
-- 2) A base de cálculo era recalculada com a cotação de hoje, mesmo
--    para meses cujo total já estava congelado no arquivo. Resultado:
--    o Histórico e o Orçamento diziam números diferentes sobre o
--    mesmo mês fechado (no caso real, R$ 194,39 de diferença em
--    julho/2026). Quando há snapshot, a base passa a vir dele.
--
-- O que NÃO muda: os valores por balde continuam vivos. Reclassificar
-- um item é quase sempre uma correção — congelar isso fossilizava o
-- erro e impedia o histórico de melhorar quando se aprende algo.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Alvos como série temporal
--
-- Esparso de propósito: uma linha marca «a partir deste mês, é
-- assim», e vale até haver outra à frente. Assim dá para declarar
-- intenção futura («a partir de janeiro quero 25% de investimento»)
-- sem escrever doze linhas.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_budget_targets (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Sempre dia 01. É o primeiro mês em que estes alvos valem.
  effective_from           DATE NOT NULL,
  pct_essential            NUMERIC(5,2) NOT NULL,
  pct_optional             NUMERIC(5,2) NOT NULL,
  pct_investment           NUMERIC(5,2) NOT NULL,
  include_one_time_income  BOOLEAN NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, effective_from)
);

COMMENT ON TABLE public.finance_budget_targets IS
  'Alvos do orçamento ao longo do tempo. O alvo de um mês é a linha com o maior effective_from <= esse mês. Mudar o alvo hoje não reescreve o plano dos meses anteriores.';

CREATE INDEX IF NOT EXISTS idx_finance_budget_targets_user_from
  ON public.finance_budget_targets (user_id, effective_from DESC);

ALTER TABLE public.finance_budget_targets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'finance_budget_targets' AND policyname = 'finance_budget_targets_owner'
  ) THEN
    CREATE POLICY "finance_budget_targets_owner" ON public.finance_budget_targets
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Backfill: o alvo atual de cada utilizador passa a valer desde sempre.
-- É isto que garante que aplicar esta migração não mexe em nenhum mês.
INSERT INTO public.finance_budget_targets (
  user_id, effective_from, pct_essential, pct_optional, pct_investment, include_one_time_income
)
SELECT us.user_id,
       DATE '1900-01-01',
       COALESCE(us.budget_pct_essential, 60),
       COALESCE(us.budget_pct_optional, 30),
       COALESCE(us.budget_pct_investment, 10),
       COALESCE(us.budget_include_one_time_income, false)
FROM   public.finance_user_settings us
ON CONFLICT (user_id, effective_from) DO NOTHING;

COMMENT ON COLUMN public.finance_user_settings.budget_pct_essential IS
  'DEPRECADO como fonte de verdade: o orçamento lê finance_budget_targets. Mantido só como valor de arranque para quem ainda não tem linha de alvos.';

-- ------------------------------------------------------------
-- 2) O arquivo passa a congelar a receita separada
--
-- O snapshot já congelava `total_income`, mas junto: recorrente mais
-- pontual. O orçamento precisa das duas em separado, porque
-- include_one_time_income decide se a segunda entra na base.
--
-- Backfill sem inventar nada: a receita pontual não é convertida por
-- cotação (vem direto de finance_one_time_entries), logo é estável e
-- pode ser lida hoje; a recorrente sai por subtração do total que já
-- estava congelado. O total congelado mantém-se intacto ao cêntimo.
-- ------------------------------------------------------------
ALTER TABLE public.finance_month_snapshots
  ADD COLUMN IF NOT EXISTS income_recurring NUMERIC(12,2);

ALTER TABLE public.finance_month_snapshots
  ADD COLUMN IF NOT EXISTS income_one_time NUMERIC(12,2);

COMMENT ON COLUMN public.finance_month_snapshots.income_recurring IS
  'Receita recorrente congelada, já convertida para a moeda de exibição no momento do arquivo.';

UPDATE public.finance_month_snapshots s
SET    income_one_time  = ot.total,
       income_recurring = s.total_income - ot.total
FROM   (
         SELECT m.user_id, m.month,
                COALESCE((
                  SELECT SUM(o.amount) FROM public.finance_one_time_entries o
                  WHERE  o.user_id = m.user_id AND o.month = m.month AND o.flow = 'income'
                ), 0) AS total
         FROM   public.finance_month_snapshots m
       ) ot
WHERE  ot.user_id = s.user_id AND ot.month = s.month
  AND  s.income_recurring IS NULL;

-- ------------------------------------------------------------
-- 3) O orçamento: alvo do mês, e base congelada quando há arquivo
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
  'Totais por balde do orçamento, por mês. Os alvos são os que vigoravam em cada mês (finance_budget_targets), não os de hoje. A base vem congelada do arquivo quando o mês já foi arquivado (base_is_frozen), para o Orçamento e o Histórico não divergirem. Os valores por balde continuam vivos de propósito: reclassificar um item é uma correção e deve melhorar o passado. A linha de um cartão conta apenas o seu restante.';

-- ------------------------------------------------------------
-- 4) As funções de arquivo passam a congelar a receita separada
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_snapshot_income_split(
  p_user_id uuid,
  p_month   date,
  p_total   numeric
)
RETURNS TABLE (income_recurring numeric, income_one_time numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_total - COALESCE(ot.total, 0), COALESCE(ot.total, 0)
  FROM (
    SELECT COALESCE(SUM(o.amount), 0) AS total
    FROM   public.finance_one_time_entries o
    WHERE  o.user_id = p_user_id AND o.month = p_month AND o.flow = 'income'
  ) ot;
$$;

COMMENT ON FUNCTION public.finance_snapshot_income_split(uuid, date, numeric) IS
  'Separa um total de receita já congelado em recorrente e pontual. A pontual não sofre conversão de moeda, por isso é exata em qualquer momento; a recorrente sai por subtração.';

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
