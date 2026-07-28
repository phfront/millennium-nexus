-- ============================================================
-- NEXUS FINANCE — Orçamento por baldes (regra 60/30/10)
--
-- 1) `budget_class` classifica cada despesa num balde do orçamento.
--    Substitui o booleano `is_essential`, que só sabia dizer
--    "obrigatória ou não" e não tinha como representar aportes nem
--    impostos.
-- 2) Percentuais-alvo por utilizador (60/30/10 é só o padrão; quem
--    consegue 50/30/20 deve poder apertar).
-- 3) `finance_budget_monthly`: totais por balde e por mês, com a
--    conversão de moeda feita AQUI, como no resto do módulo — assim o
--    detalhe no ecrã não diverge do cartão nem dos snapshots.
--
-- Nota sobre `deduction`: impostos (Nota Fiscal, IR) e custo do
-- negócio (contabilidade) continuam lançados como despesa na planilha,
-- porque é assim que se controla o pagamento deles. No orçamento, porém,
-- não ocupam balde nenhum: abatem da base. A regra 60/30/10 aplica-se
-- sobre renda líquida, e sem isto o imposto era contado duas vezes —
-- inflava o numerador das obrigatórias e o denominador ao mesmo tempo.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Classificação orçamentária das despesas
-- ------------------------------------------------------------

ALTER TABLE public.finance_expense_items
  ADD COLUMN IF NOT EXISTS budget_class TEXT;

ALTER TABLE public.finance_one_time_entries
  ADD COLUMN IF NOT EXISTS budget_class TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_expense_items_budget_class_chk'
  ) THEN
    ALTER TABLE public.finance_expense_items
      ADD CONSTRAINT finance_expense_items_budget_class_chk
        CHECK (budget_class IS NULL OR budget_class IN
          ('essential', 'optional', 'investment', 'deduction'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_one_time_entries_budget_class_chk'
  ) THEN
    ALTER TABLE public.finance_one_time_entries
      ADD CONSTRAINT finance_one_time_entries_budget_class_chk
        CHECK (budget_class IS NULL OR budget_class IN
          ('essential', 'optional', 'investment', 'deduction'));
  END IF;
END $$;

COMMENT ON COLUMN public.finance_expense_items.budget_class IS
  'Balde do orçamento: essential (60%), optional (30%), investment (10%) ou deduction (imposto/custo do negócio — abate da base em vez de ocupar balde). NULL = ainda não classificada.';

COMMENT ON COLUMN public.finance_one_time_entries.budget_class IS
  'Mesma semântica de finance_expense_items.budget_class; só se aplica a flow = expense.';

-- Migra o booleano anterior: quem estava marcado como obrigatório vira
-- `essential`. O resto fica NULL (não classificado) de propósito — o
-- default `false` do is_essential nunca foi uma decisão do utilizador,
-- então tratá-lo como "opcional" seria inventar dados.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'finance_expense_items'
      AND column_name = 'is_essential'
  ) THEN
    UPDATE public.finance_expense_items
      SET budget_class = 'essential'
      WHERE is_essential IS TRUE AND budget_class IS NULL;

    ALTER TABLE public.finance_expense_items DROP COLUMN is_essential;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_finance_expense_items_budget_class
  ON public.finance_expense_items (user_id, budget_class);

-- ------------------------------------------------------------
-- 2) Percentuais-alvo
-- ------------------------------------------------------------

ALTER TABLE public.finance_user_settings
  ADD COLUMN IF NOT EXISTS budget_pct_essential  NUMERIC(5,2) NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS budget_pct_optional   NUMERIC(5,2) NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS budget_pct_investment NUMERIC(5,2) NOT NULL DEFAULT 10,
  -- Receitas pontuais (13.º, bónus, venda avulsa) na base: desligado por
  -- padrão para o tecto de gastos não subir num mês atípico.
  ADD COLUMN IF NOT EXISTS budget_include_one_time_income BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_user_settings_budget_pct_chk'
  ) THEN
    ALTER TABLE public.finance_user_settings
      ADD CONSTRAINT finance_user_settings_budget_pct_chk
        CHECK (
          budget_pct_essential  >= 0 AND budget_pct_essential  <= 100 AND
          budget_pct_optional   >= 0 AND budget_pct_optional   <= 100 AND
          budget_pct_investment >= 0 AND budget_pct_investment <= 100 AND
          budget_pct_essential + budget_pct_optional + budget_pct_investment <= 100
        );
  END IF;
END $$;

COMMENT ON COLUMN public.finance_user_settings.budget_pct_essential IS
  'Percentual-alvo da base para despesas obrigatórias. Padrão 60 (regra 60/30/10); a soma dos três não pode passar de 100.';

-- ------------------------------------------------------------
-- 3) View: totais por balde e por mês
-- ------------------------------------------------------------
--
-- Soma apenas linhas que existem em finance_expense_entries — igual ao
-- que finance_monthly_summary faz. Não replica o fallback de
-- `default_amount` dos itens recorrentes, senão o total do orçamento
-- divergiria do total de despesas mostrado no dashboard.

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
-- Pontuais: receita entra na base (opcional); despesa vai para o balde
-- da sua própria classificação, tal como um item fixo.
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
fixed AS (
  SELECT
    ee.user_id,
    ee.month,
    COALESCE(SUM(ee.amount) FILTER (WHERE ei.budget_class = 'essential'), 0)  AS fx_essential,
    COALESCE(SUM(ee.amount) FILTER (WHERE ei.budget_class = 'optional'), 0)   AS fx_optional,
    COALESCE(SUM(ee.amount) FILTER (WHERE ei.budget_class = 'investment'), 0) AS fx_investment,
    COALESCE(SUM(ee.amount) FILTER (WHERE ei.budget_class = 'deduction'), 0)  AS fx_deduction,
    COALESCE(SUM(ee.amount) FILTER (WHERE ei.budget_class IS NULL), 0)        AS fx_unclassified,
    COUNT(DISTINCT ei.id) FILTER (WHERE ei.budget_class IS NULL AND ee.amount > 0) AS fx_unclassified_count
  FROM public.finance_expense_entries ee
  JOIN public.finance_expense_items ei ON ei.id = ee.item_id
  GROUP BY ee.user_id, ee.month
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
  'Totais por balde do orçamento, por mês. Receitas já convertidas para a moeda de exibição (mesma lógica de finance_monthly_summary). A base de cálculo NÃO vem pronta: é income_recurring [+ income_one_time se include_one_time_income] - deductions, calculada no cliente para o ecrã poder mostrar a escada.';
