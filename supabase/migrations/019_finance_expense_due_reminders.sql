-- ============================================================
-- NEXUS FINANCE — Vencimento de despesas e lembretes por push
-- ============================================================

-- Dia do mês para vencimento (despesas fixas/recorrentes na planilha)
ALTER TABLE public.finance_expense_items
  ADD COLUMN IF NOT EXISTS due_day SMALLINT
    CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31));

-- Data de vencimento opcional (despesas pontuais)
ALTER TABLE public.finance_one_time_expenses
  ADD COLUMN IF NOT EXISTS due_date DATE;

COMMENT ON COLUMN public.finance_expense_items.due_day IS
  'Dia do mês do vencimento (1–31); meses mais curtos usam o último dia. Null = sem lembrete por vencimento.';
COMMENT ON COLUMN public.finance_one_time_expenses.due_date IS
  'Data de vencimento opcional para lembretes. Null = sem lembrete por vencimento.';

-- Preferências de lembrete (array vazio = desativado)
ALTER TABLE public.finance_user_settings
  ADD COLUMN IF NOT EXISTS expense_due_reminder_days_before SMALLINT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.finance_user_settings
  ADD COLUMN IF NOT EXISTS expense_due_reminder_time TEXT NOT NULL DEFAULT '09:00';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_user_settings_expense_reminder_time_fmt'
  ) THEN
    ALTER TABLE public.finance_user_settings
      ADD CONSTRAINT finance_user_settings_expense_reminder_time_fmt
        CHECK (expense_due_reminder_time ~ '^\d{2}:\d{2}$');
  END IF;
END $$;

COMMENT ON COLUMN public.finance_user_settings.expense_due_reminder_days_before IS
  'Dias antes do vencimento para enviar push (ex.: {1,2}). Vazio = sem lembretes de despesas.';
COMMENT ON COLUMN public.finance_user_settings.expense_due_reminder_time IS
  'Hora local (HH:MM) para disparar o push, no fuso do perfil.';

-- Evita reenvio no mesmo dia civil local para a mesma combinação
CREATE TABLE IF NOT EXISTS public.finance_expense_reminder_sent (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dedupe_key   TEXT NOT NULL,
  local_date   DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, dedupe_key, local_date)
);

CREATE INDEX IF NOT EXISTS idx_finance_exp_reminder_sent_user_date
  ON public.finance_expense_reminder_sent (user_id, local_date DESC);

ALTER TABLE public.finance_expense_reminder_sent ENABLE ROW LEVEL SECURITY;

-- Apenas backend (service role) escreve; utilizadores não consultam
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'finance_expense_reminder_sent'
      AND policyname = 'finance_expense_reminder_sent_no_client'
  ) THEN
    CREATE POLICY "finance_expense_reminder_sent_no_client"
      ON public.finance_expense_reminder_sent
      FOR ALL
      TO authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;
