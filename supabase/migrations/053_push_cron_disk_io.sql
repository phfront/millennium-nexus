-- ============================================================
-- Disk I/O: próximo dia incompleto por plano (cron push) + índices
-- ============================================================

-- Próximo dia não concluído por plan_id (uma linha por plano).
CREATE OR REPLACE FUNCTION public.fn_next_incomplete_learning_plan_days(p_plan_ids uuid[])
RETURNS TABLE (
  plan_id uuid,
  day_id uuid,
  day_number integer,
  title text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT ON (d.plan_id)
    d.plan_id,
    d.id,
    d.day_number,
    d.title
  FROM public.learning_plan_days d
  WHERE d.plan_id = ANY(p_plan_ids)
    AND d.is_completed = false
  ORDER BY d.plan_id, d.day_number ASC;
$$;

REVOKE ALL ON FUNCTION public.fn_next_incomplete_learning_plan_days(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_next_incomplete_learning_plan_days(uuid[]) TO service_role;

COMMENT ON FUNCTION public.fn_next_incomplete_learning_plan_days(uuid[]) IS
  'Usado pela Edge send-push-notifications: evita ler todos os dias incompletos por plano.';

CREATE INDEX IF NOT EXISTS idx_learning_plan_days_next_incomplete
  ON public.learning_plan_days (plan_id, day_number)
  WHERE is_completed = false;

CREATE INDEX IF NOT EXISTS idx_finance_expense_entries_item_unpaid
  ON public.finance_expense_entries (item_id)
  WHERE is_paid = false AND amount > 0;

CREATE INDEX IF NOT EXISTS idx_finance_expense_items_user_active_due
  ON public.finance_expense_items (user_id)
  WHERE is_active = true AND due_day IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_one_time_entries_due_expense_unpaid
  ON public.finance_one_time_entries (user_id)
  WHERE is_paid = false
    AND flow = 'expense'
    AND due_date IS NOT NULL
    AND amount > 0;

CREATE INDEX IF NOT EXISTS idx_diet_logs_user_date_not_extra
  ON public.diet_logs (user_id, logged_date)
  WHERE is_extra = false;
