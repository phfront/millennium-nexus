-- Remove definitivamente os modulos Households, Lists e Learning.
-- Esta migration apaga todos os dados associados a esses modulos.

DELETE FROM public.modules
WHERE slug IN ('households', 'lists', 'learning');

DROP FUNCTION IF EXISTS public.fn_next_incomplete_learning_plan_days(uuid[]);

DROP TABLE IF EXISTS public.learning_plan_notifications;
DROP TABLE IF EXISTS public.learning_day_items;
DROP TABLE IF EXISTS public.learning_plan_days;
DROP TABLE IF EXISTS public.learning_plan_sections;
DROP TABLE IF EXISTS public.learning_plans;

DROP TABLE IF EXISTS public.list_items;
DROP TABLE IF EXISTS public.lists;
DROP TABLE IF EXISTS public.household_members;
DROP TABLE IF EXISTS public.households;

DROP FUNCTION IF EXISTS public.is_household_member(uuid);

DROP TYPE IF EXISTS public.learning_scheduling_type;
DROP TYPE IF EXISTS public.learning_plan_status;
