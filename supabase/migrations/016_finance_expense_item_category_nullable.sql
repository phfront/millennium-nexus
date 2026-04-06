-- Itens podem ficar sem categoria; ao excluir categoria, SET NULL em vez de CASCADE
ALTER TABLE public.finance_expense_items
  DROP CONSTRAINT IF EXISTS finance_expense_items_category_id_fkey;

ALTER TABLE public.finance_expense_items
  ALTER COLUMN category_id DROP NOT NULL;

ALTER TABLE public.finance_expense_items
  ADD CONSTRAINT finance_expense_items_category_id_fkey
  FOREIGN KEY (category_id)
  REFERENCES public.finance_expense_categories(id)
  ON DELETE SET NULL;
