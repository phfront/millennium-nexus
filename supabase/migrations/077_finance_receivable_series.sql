-- ============================================================
-- NEXUS FINANCE — Cobrança recorrente ("assinatura de cobrança")
--
-- Problema: há cobranças que se repetem todo mês sempre iguais (o
-- rateio das assinaturas entre casas, por exemplo). Registá-las à mão
-- mês a mês é trabalho garantido e esquecimento garantido.
--
-- Desenho: separar a REGRA da COBRANÇA. A regra vive aqui
-- (`finance_receivable_series`); as cobranças continuam a ser linhas
-- de `finance_receivables`, uma por mês, geradas a partir da regra.
-- É o mesmo par item/lançamento das despesas, e pela mesma razão:
-- editar o valor da regra não pode reescrever o que já foi cobrado.
--
-- Só se geram meses de `start_month` até o mês corrente — nunca
-- futuro. Uma cobrança que ainda não venceu não é dívida, e somá-la
-- ao pendente seria inventar dinheiro a receber.
--
-- Deliberadamente NÃO toca em receitas: `finance_receivables` nunca
-- entrou em `finance_monthly_summary` nem no orçamento, e a
-- recorrência não muda isso. Quem te deve não é receita tua enquanto
-- não pagar — e quando paga, entra por onde entrar o dinheiro.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.finance_receivable_series (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_name   TEXT NOT NULL,
  description   TEXT NOT NULL,
  amount        NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  /* Dia em que costuma cair; informativo, não gera vencimento. */
  due_day       SMALLINT CHECK (due_day BETWEEN 1 AND 31),
  /* Sempre dia 01: é mês, não data. */
  start_month   DATE NOT NULL,
  /* NULL = sem fim previsto. */
  end_month     DATE,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT finance_receivable_series_month_order_chk
    CHECK (end_month IS NULL OR end_month >= start_month)
);

COMMENT ON TABLE public.finance_receivable_series IS
  'Regra de cobrança recorrente. Não é cobrança: as cobranças são linhas de finance_receivables geradas a partir daqui, uma por mês, até o mês corrente.';

CREATE INDEX IF NOT EXISTS idx_finance_receivable_series_user
  ON public.finance_receivable_series (user_id, is_active);

ALTER TABLE public.finance_receivable_series ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'finance_receivable_series'
      AND policyname = 'finance_receivable_series_owner'
  ) THEN
    CREATE POLICY finance_receivable_series_owner
      ON public.finance_receivable_series
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ------------------------------------------------------------
-- A cobrança gerada sabe de que regra veio
--
-- ON DELETE SET NULL: apagar a regra não apaga o histórico do que já
-- foi cobrado — as linhas ficam, órfãs e editáveis à mão, como
-- qualquer cobrança avulsa.
-- ------------------------------------------------------------
ALTER TABLE public.finance_receivables
  ADD COLUMN IF NOT EXISTS series_id UUID
    REFERENCES public.finance_receivable_series(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.finance_receivables.series_id IS
  'Regra recorrente que gerou esta cobrança; NULL = cobrança avulsa (ou regra apagada depois).';

-- Uma cobrança por regra e mês. É isto que torna a geração idempotente:
-- duas abas abertas, um refresh no meio de outro, e continua a existir
-- uma só linha por mês.
--
-- Índice TOTAL e não parcial de propósito: `ON CONFLICT` não consegue
-- inferir um índice parcial sem repetir o predicado, e o cliente
-- (PostgREST) não tem como o mandar. As cobranças avulsas continuam
-- livres à mesma — `series_id` NULL é distinto de si próprio num índice
-- único, então podem existir quantas se quiser.
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_receivables_series_month
  ON public.finance_receivables (user_id, series_id, reference_month);
