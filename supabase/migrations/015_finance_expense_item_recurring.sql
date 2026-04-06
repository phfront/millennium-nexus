-- Item de despesa pode repetir valor em todos os meses da planilha (recorrente)
ALTER TABLE public.finance_expense_items
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false;
