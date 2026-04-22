-- ============================================================
-- 052 — Lembretes push por refeição (horário do plano + timezone)
-- ============================================================

ALTER TABLE public.diet_settings
  ADD COLUMN IF NOT EXISTS meal_reminder_push_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.diet_settings
  ADD COLUMN IF NOT EXISTS meal_reminder_lead_minutes SMALLINT NOT NULL DEFAULT 15;

COMMENT ON COLUMN public.diet_settings.meal_reminder_push_enabled IS
  'Quando true, a edge send-push-notifications pode enviar lembretes por refeição (plano ativo).';
COMMENT ON COLUMN public.diet_settings.meal_reminder_lead_minutes IS
  'Minutos antes do target_time da refeição para disparar o push (5–120; validado na UI).';

ALTER TABLE public.diet_plan_meals
  ADD COLUMN IF NOT EXISTS meal_reminder_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.diet_plan_meals.meal_reminder_enabled IS
  'Incluir esta refeição nos lembretes push (requer target_time e chave mestra em diet_settings).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'diet_settings_meal_reminder_lead_minutes_range'
  ) THEN
    ALTER TABLE public.diet_settings
      ADD CONSTRAINT diet_settings_meal_reminder_lead_minutes_range
      CHECK (meal_reminder_lead_minutes >= 5 AND meal_reminder_lead_minutes <= 120);
  END IF;
END $$;
