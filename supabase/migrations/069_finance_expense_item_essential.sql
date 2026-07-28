-- Item de despesa pode ser marcado como obrigatório (essencial vs. supérfluo)
ALTER TABLE public.finance_expense_items
  ADD COLUMN IF NOT EXISTS is_essential BOOLEAN NOT NULL DEFAULT false;
