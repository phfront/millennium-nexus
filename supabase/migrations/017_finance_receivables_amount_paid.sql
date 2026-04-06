-- Pagamentos parciais em cobranças: quanto já foi abatido do total
ALTER TABLE public.finance_receivables
  ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0;

UPDATE public.finance_receivables
SET amount_paid = amount
WHERE is_paid = true AND amount_paid = 0;
