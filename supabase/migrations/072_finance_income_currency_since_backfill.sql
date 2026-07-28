-- ============================================================
-- NEXUS FINANCE — Fronteira obrigatória para fontes em moeda estrangeira
--
-- A 071 introduziu `currency_since`, mas deixou NULL a significar "a moeda
-- vale para todo o histórico" — que é precisamente o comportamento que
-- reinterpretava lançamentos antigos e fazia os meses passados oscilar com
-- o câmbio. Fontes que já estavam marcadas com moeda ficaram nesse estado.
--
-- Passa a valer: quem tem `currency` tem de ter `currency_since`. As linhas
-- existentes são fixadas no mês corrente, que é quando a moeda foi de facto
-- atribuída — os meses anteriores voltam a ser lidos na moeda padrão.
-- ============================================================

UPDATE public.finance_income_sources
SET    currency_since = (date_trunc('month', timezone('utc', now())))::date
WHERE  currency IS NOT NULL
  AND  currency_since IS NULL;

-- Higiene: sem moeda própria a fronteira não tem significado.
UPDATE public.finance_income_sources
SET    currency_since = NULL
WHERE  currency IS NULL
  AND  currency_since IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_income_sources_currency_since_pairing'
  ) THEN
    ALTER TABLE public.finance_income_sources
      ADD CONSTRAINT finance_income_sources_currency_since_pairing
        CHECK (
          (currency IS NULL AND currency_since IS NULL)
          OR (currency IS NOT NULL AND currency_since IS NOT NULL)
        );
  END IF;
END $$;

COMMENT ON COLUMN public.finance_income_sources.currency_since IS
  'Primeiro mês (dia 01) em que `currency` se aplica; obrigatório quando `currency` está preenchida. Meses anteriores são lidos na moeda padrão do utilizador, sem conversão — é o que impede o histórico de oscilar com o câmbio.';
