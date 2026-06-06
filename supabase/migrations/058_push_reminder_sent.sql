-- Dedupe generico para notificacoes push disparadas por cron.
-- Daily Goals pode ter varios horarios no mesmo dia; por isso a chave inclui
-- o minuto local programado, e nao apenas a data.

CREATE TABLE IF NOT EXISTS public.push_reminder_sent (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module       TEXT NOT NULL,
  dedupe_key   TEXT NOT NULL,
  local_date   DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, module, dedupe_key, local_date)
);

CREATE INDEX IF NOT EXISTS idx_push_reminder_sent_user_date
  ON public.push_reminder_sent (user_id, local_date DESC);

ALTER TABLE public.push_reminder_sent ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'push_reminder_sent'
      AND policyname = 'push_reminder_sent_no_client'
  ) THEN
    CREATE POLICY "push_reminder_sent_no_client"
      ON public.push_reminder_sent
      FOR ALL
      TO authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

COMMENT ON TABLE public.push_reminder_sent IS
  'Dedupe de pushes enviados por Edge Functions; escrita apenas via service role.';

-- Calcula os periodos de varios trackers em uma unica chamada da Edge Function.
CREATE OR REPLACE FUNCTION public.tracker_period_starts(p_items jsonb)
RETURNS TABLE (
  tracker_id uuid,
  period_start date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    item.tracker_id,
    public.tracker_period_start(item.tracker_id, item.local_date)
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb))
    AS item(tracker_id uuid, local_date date);
$$;

REVOKE ALL ON FUNCTION public.tracker_period_starts(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tracker_period_starts(jsonb) TO service_role;

COMMENT ON FUNCTION public.tracker_period_starts(jsonb) IS
  'Calcula em lote o inicio do periodo de trackers usados pelo cron de push.';

CREATE INDEX IF NOT EXISTS idx_tracker_notifications_enabled_tracker
  ON public.tracker_notifications (tracker_id)
  WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_trackers_user_active
  ON public.trackers (user_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_diet_plan_meals_reminder_time
  ON public.diet_plan_meals (plan_id, target_time)
  WHERE meal_reminder_enabled = true AND target_time IS NOT NULL;
