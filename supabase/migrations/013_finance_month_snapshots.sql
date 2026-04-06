-- ============================================================
-- NEXUS FINANCE — Snapshots mensais (histórico imutável após o mês)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.finance_month_snapshots (
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month                 DATE NOT NULL,
  total_income          DECIMAL(14, 2) NOT NULL DEFAULT 0,
  total_expenses        DECIMAL(14, 2) NOT NULL DEFAULT 0,
  total_one_time        DECIMAL(14, 2) NOT NULL DEFAULT 0,
  surplus               DECIMAL(14, 2) NOT NULL DEFAULT 0,
  accumulated_surplus   DECIMAL(14, 2) NOT NULL DEFAULT 0,
  snapshot_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, month)
);

CREATE INDEX IF NOT EXISTS idx_finance_month_snapshots_user_month_desc
  ON public.finance_month_snapshots (user_id, month DESC);

ALTER TABLE public.finance_month_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE INSERT ON public.finance_month_snapshots FROM PUBLIC;
REVOKE INSERT ON public.finance_month_snapshots FROM authenticated;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'finance_month_snapshots' AND policyname = 'finance_month_snapshots_select'
  ) THEN
    CREATE POLICY "finance_month_snapshots_select" ON public.finance_month_snapshots
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Preenche snapshots para todos os meses já encerrados (mês < 1º do mês atual UTC)
-- que ainda não tenham registo. Valores congelados a partir da view agregada no momento da chamada.
CREATE OR REPLACE FUNCTION public.finance_ensure_month_snapshots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  month_start date := (date_trunc('month', timezone('utc', now())))::date;
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.finance_month_snapshots (
    user_id,
    month,
    total_income,
    total_expenses,
    total_one_time,
    surplus,
    accumulated_surplus
  )
  SELECT
    s.user_id,
    s.month,
    s.total_income,
    s.total_expenses,
    s.total_one_time,
    s.surplus,
    s.accumulated_surplus
  FROM public.finance_monthly_summary s
  WHERE s.user_id = uid
    AND s.month < month_start
  ON CONFLICT (user_id, month) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_ensure_month_snapshots() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_ensure_month_snapshots() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_ensure_month_snapshots() TO service_role;
