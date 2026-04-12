-- ============================================================
-- TABELA: learning_plan_notifications
-- Notificações de lembrete para planos de aprendizado.
-- Reutiliza o enum público notification_type (fixed_time, interval, reminder).
-- ============================================================

CREATE TABLE public.learning_plan_notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id           UUID NOT NULL REFERENCES public.learning_plans(id) ON DELETE CASCADE,
  type              public.notification_type NOT NULL DEFAULT 'fixed_time',
  -- fixed_time
  scheduled_times   TEXT[] DEFAULT ARRAY['08:00'],
  -- interval
  frequency_minutes INTEGER,
  window_start      TIME,
  window_end        TIME,
  -- reminder
  target_time       TIME,
  lead_time         INTEGER,
  -- estado
  enabled           BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT one_notification_per_plan UNIQUE (plan_id)
);

CREATE INDEX idx_learning_plan_notifications_plan_id ON public.learning_plan_notifications(plan_id);

-- RLS
ALTER TABLE public.learning_plan_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learning_plan_notifications: acesso do dono"
  ON public.learning_plan_notifications
  USING (plan_id IN (SELECT id FROM public.learning_plans WHERE user_id = auth.uid()))
  WITH CHECK (plan_id IN (SELECT id FROM public.learning_plans WHERE user_id = auth.uid()));
