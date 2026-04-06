-- ============================================================
-- NEXUS DAILY GOALS — Migration
-- Executar no projeto Supabase compartilhado (nexus-portal)
-- ============================================================

-- Enums
CREATE TYPE public.tracker_type      AS ENUM ('counter', 'slider', 'checklist', 'boolean');
CREATE TYPE public.notification_type AS ENUM ('interval', 'fixed_time', 'reminder');
CREATE TYPE public.scoring_mode      AS ENUM ('completion', 'per_unit');

-- ============================================================
-- TABELA: trackers
-- ============================================================
CREATE TABLE public.trackers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  type            public.tracker_type NOT NULL,
  goal_value      NUMERIC,
  unit            TEXT,
  -- Array de { label: string, points: number }
  checklist_items JSONB,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  -- Pontuação (opt-in)
  scoring_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  scoring_mode    public.scoring_mode,
  points_value    NUMERIC NOT NULL DEFAULT 0,
  points_on_miss  NUMERIC,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trackers_user_id ON public.trackers(user_id);

-- ============================================================
-- TABELA: tracker_notifications
-- ============================================================
CREATE TABLE public.tracker_notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id        UUID NOT NULL REFERENCES public.trackers(id) ON DELETE CASCADE,
  type              public.notification_type NOT NULL,
  -- interval
  frequency_minutes INTEGER,
  window_start      TIME,
  window_end        TIME,
  -- fixed_time: array de 'HH:MM'
  scheduled_times   JSONB,
  -- reminder
  target_time       TIME,
  lead_time         INTEGER,
  enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tracker_notifications_tracker_id ON public.tracker_notifications(tracker_id);

-- ============================================================
-- TABELA: logs
-- Um registro por tracker por dia (constraint UNIQUE garante isso)
-- ============================================================
CREATE TABLE public.logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id    UUID NOT NULL REFERENCES public.trackers(id) ON DELETE CASCADE,
  value         NUMERIC,
  checked_items JSONB,
  note          TEXT,
  points_earned NUMERIC NOT NULL DEFAULT 0,
  created_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (tracker_id, created_at)
);

CREATE INDEX idx_logs_tracker_id     ON public.logs(tracker_id);
CREATE INDEX idx_logs_created_at     ON public.logs(created_at);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.trackers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracker_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs                  ENABLE ROW LEVEL SECURITY;

-- trackers: dono tem acesso total
CREATE POLICY "trackers: acesso do dono"
  ON public.trackers
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- tracker_notifications: acesso via tracker do dono
CREATE POLICY "tracker_notifications: acesso do dono"
  ON public.tracker_notifications
  USING (tracker_id IN (SELECT id FROM public.trackers WHERE user_id = auth.uid()))
  WITH CHECK (tracker_id IN (SELECT id FROM public.trackers WHERE user_id = auth.uid()));

-- logs: SELECT irrestrito para o dono; INSERT/UPDATE apenas para hoje
CREATE POLICY "logs: select do dono"
  ON public.logs FOR SELECT
  USING (tracker_id IN (SELECT id FROM public.trackers WHERE user_id = auth.uid()));

CREATE POLICY "logs: insert apenas hoje"
  ON public.logs FOR INSERT
  WITH CHECK (
    tracker_id IN (SELECT id FROM public.trackers WHERE user_id = auth.uid())
    AND created_at = CURRENT_DATE
  );

CREATE POLICY "logs: update apenas hoje"
  ON public.logs FOR UPDATE
  USING (
    tracker_id IN (SELECT id FROM public.trackers WHERE user_id = auth.uid())
    AND created_at = CURRENT_DATE
  );

-- ============================================================
-- VIEWS DE GAMIFICAÇÃO
-- ============================================================

-- Streak atual: dias consecutivos com 100% das metas ativas concluídas
CREATE OR REPLACE VIEW public.current_streaks AS
WITH daily_completion AS (
  SELECT
    t.user_id,
    l.created_at                                    AS log_date,
    COUNT(DISTINCT t.id) FILTER (WHERE
      (t.type IN ('counter', 'slider') AND l.value >= t.goal_value)
      OR (t.type = 'boolean'    AND l.value = 1)
      OR (t.type = 'checklist'  AND NOT (l.checked_items @> '[false]'::jsonb))
    )                                               AS completed_count,
    COUNT(DISTINCT t.id)                            AS total_count
  FROM public.trackers t
  LEFT JOIN public.logs l ON l.tracker_id = t.id
  WHERE t.active = TRUE
  GROUP BY t.user_id, l.created_at
),
perfect_days AS (
  SELECT user_id, log_date
  FROM daily_completion
  WHERE completed_count = total_count AND total_count > 0
),
streak_calc AS (
  SELECT
    user_id,
    log_date,
    log_date - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY log_date))::INTEGER AS streak_group
  FROM perfect_days
)
SELECT
  user_id,
  COUNT(*) AS current_streak
FROM streak_calc
WHERE streak_group = (
  SELECT MAX(streak_group) FROM streak_calc sc2 WHERE sc2.user_id = streak_calc.user_id
)
GROUP BY user_id;

-- Pontuação por dia por usuário
CREATE OR REPLACE VIEW public.daily_scores AS
SELECT
  t.user_id,
  l.created_at        AS score_date,
  SUM(l.points_earned) AS daily_score
FROM public.logs l
JOIN public.trackers t ON t.id = l.tracker_id
GROUP BY t.user_id, l.created_at;

-- Pontuação total acumulada por usuário
CREATE OR REPLACE VIEW public.total_scores AS
SELECT
  user_id,
  SUM(daily_score) AS total_score
FROM public.daily_scores
GROUP BY user_id;

-- ============================================================
-- REGISTRO DO MÓDULO NA TABELA modules (nexus-portal)
-- ============================================================
INSERT INTO public.modules (slug, label, description, icon_name, is_active, sort_order)
VALUES (
  'daily-goals',
  'Daily Goals',
  'Controle suas metas diárias — água, treino, estudos e muito mais.',
  'Target',
  TRUE,
  10
)
ON CONFLICT (slug) DO UPDATE
  SET label       = EXCLUDED.label,
      description = EXCLUDED.description,
      icon_name   = EXCLUDED.icon_name,
      is_active   = EXCLUDED.is_active;
