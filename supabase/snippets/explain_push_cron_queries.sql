-- Diagnóstico opcional no SQL Editor (após substituir UUIDs de exemplo).
-- Correlacionar com Reports → Database → Disk IO no dashboard Supabase.

EXPLAIN (ANALYZE, BUFFERS)
SELECT DISTINCT ON (d.plan_id)
  d.plan_id, d.id, d.day_number, d.title
FROM public.learning_plan_days d
WHERE d.plan_id = ARRAY['00000000-0000-0000-0000-000000000001'::uuid]
  AND d.is_completed = false
ORDER BY d.plan_id, d.day_number ASC;

EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.diet_settings
WHERE user_id IN ('00000000-0000-0000-0000-000000000001'::uuid);

EXPLAIN (ANALYZE, BUFFERS)
SELECT month, amount, is_paid, item_id
FROM public.finance_expense_entries
WHERE item_id IN ('00000000-0000-0000-0000-000000000002'::uuid)
  AND is_paid = false
  AND amount > 0;
