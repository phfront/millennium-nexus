-- ============================================================
-- Permitir DELETE nos logs do "hoje" (mesma regra de fuso que INSERT/UPDATE)
-- ============================================================

CREATE POLICY "logs: delete apenas hoje"
  ON public.logs FOR DELETE
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
