-- ============================================================
-- NEXUS FINANCE — Planejamento de gastos (MLL-1)
--
-- Problema: não havia onde pôr "quero comprar um notebook em 10x a
-- partir de novembro" e ver como ficam os próximos meses sem lançar
-- nada de verdade. Lançar na planilha para "ver como fica" suja o
-- realizado; não lançar deixa a conta toda na cabeça.
--
-- Desenho: uma tabela própria, que NUNCA entra em views, orçamento,
-- arquivo ou exportação de realizado. A projeção é calculada no
-- cliente (lib/finance/planning.ts) somando estas compras por cima de
-- finance_monthly_summary. Por isso nenhuma view muda aqui — e a
-- expressão de receita repetida nas quatro views/funções fica quieta.
--
-- Decisão do Pedro (10/10/2026): a tela só planeja. Quando a compra
-- acontece, ele atualiza o cartão em Despesas e tira a compra daqui
-- ("Já comprei" apaga a linha). Não há vínculo com lançamentos.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.finance_planned_purchases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  /*
   * installments: valor TOTAL da compra (a soma das parcelas).
   * monthly / yearly: valor de CADA ocorrência (por mês / por ano).
   */
  amount              NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  pay_mode            TEXT NOT NULL DEFAULT 'installments'
                        CHECK (pay_mode IN ('installments', 'monthly', 'yearly')),
  /* 1 = à vista. Só faz sentido em pay_mode = 'installments'. */
  installments        SMALLINT NOT NULL DEFAULT 1 CHECK (installments BETWEEN 1 AND 72),
  /*
   * Valor de cada parcela quando elas não são iguais (entrada maior,
   * última menor, juros que mudam). NULL = amount dividido igualmente.
   * Quando preenchido, amount é a soma e o tamanho é installments.
   */
  installment_amounts NUMERIC(12,2)[],
  /* Sempre dia 01: é mês, não data. Primeira parcela / ocorrência. */
  start_month         DATE NOT NULL,
  /* Cartão em que deve cair (informativo: a tela não lança nada). */
  card_item_id        UUID REFERENCES public.finance_expense_items(id) ON DELETE SET NULL,
  /* A chave "na conta": desligada, a compra fica na lista mas sai da projeção. */
  is_included         BOOLEAN NOT NULL DEFAULT true,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT finance_planned_purchases_start_month_chk
    CHECK (EXTRACT(DAY FROM start_month) = 1),
  CONSTRAINT finance_planned_purchases_parts_chk
    CHECK (
      installment_amounts IS NULL
      OR (pay_mode = 'installments'
          AND cardinality(installment_amounts) = installments)
    )
);

COMMENT ON TABLE public.finance_planned_purchases IS
  'Compras planejadas (tela Planejamento). Só simulação: não entra em nenhuma view, orçamento ou arquivo.';

CREATE INDEX IF NOT EXISTS idx_finance_planned_purchases_user
  ON public.finance_planned_purchases (user_id, sort_order);

ALTER TABLE public.finance_planned_purchases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'finance_planned_purchases'
      AND policyname = 'finance_planned_purchases_owner'
  ) THEN
    CREATE POLICY finance_planned_purchases_owner
      ON public.finance_planned_purchases
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ------------------------------------------------------------
-- Aviso da tela: "me avise se o acumulado ficar abaixo de X".
-- 0 = avisa só quando o acumulado fica negativo.
-- ------------------------------------------------------------
ALTER TABLE public.finance_user_settings
  ADD COLUMN IF NOT EXISTS planning_alert_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.finance_user_settings.planning_alert_amount IS
  'Planejamento: destaca os meses em que o acumulado projetado fica abaixo deste valor.';
