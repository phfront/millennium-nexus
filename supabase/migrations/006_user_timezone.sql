-- ============================================================
-- NEXUS PORTAL — Fuso horário do usuário
-- Permite que cada usuário configure seu timezone para que
-- as metas sejam registradas no dia correto (horário local).
-- ============================================================

-- Adiciona coluna timezone na tabela profiles
-- Usa IANA timezone identifiers (ex: 'America/Sao_Paulo', 'Europe/Lisbon')
ALTER TABLE public.profiles
  ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

-- ============================================================
-- Atualiza as políticas RLS de logs para respeitar o fuso
-- horário de cada usuário ao validar o "dia de hoje".
--
-- ANTES: comparava created_at = CURRENT_DATE (servidor em UTC)
-- DEPOIS: compara com (NOW() AT TIME ZONE <timezone do usuário>)::date
-- ============================================================

DROP POLICY IF EXISTS "logs: insert apenas hoje" ON public.logs;
DROP POLICY IF EXISTS "logs: update apenas hoje" ON public.logs;

CREATE POLICY "logs: insert apenas hoje"
  ON public.logs FOR INSERT
  WITH CHECK (
    tracker_id IN (SELECT id FROM public.trackers WHERE user_id = auth.uid())
    AND created_at = (
      NOW() AT TIME ZONE (
        SELECT COALESCE(timezone, 'UTC')
        FROM public.profiles
        WHERE id = auth.uid()
      )
    )::date
  );

CREATE POLICY "logs: update apenas hoje"
  ON public.logs FOR UPDATE
  USING (
    tracker_id IN (SELECT id FROM public.trackers WHERE user_id = auth.uid())
    AND created_at = (
      NOW() AT TIME ZONE (
        SELECT COALESCE(timezone, 'UTC')
        FROM public.profiles
        WHERE id = auth.uid()
      )
    )::date
  );
