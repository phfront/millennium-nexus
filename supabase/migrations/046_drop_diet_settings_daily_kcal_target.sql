-- Remove meta calórica manual: o total planejado passa a derivar do plano de dieta (itens).
ALTER TABLE public.diet_settings
  DROP COLUMN IF EXISTS daily_kcal_target;
