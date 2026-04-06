-- Valor mensal sugerido por fonte de renda (materializado nas entradas quando em falta)
ALTER TABLE public.finance_income_sources
  ADD COLUMN IF NOT EXISTS default_monthly_amount DECIMAL(12, 2) NOT NULL DEFAULT 0;
