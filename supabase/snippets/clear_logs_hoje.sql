-- Limpar registos de logs do dia atual
-- ============================================================
-- Opção A — Pela app (sessão do utilizador), após aplicar a migration 007:
--    Podes usar o cliente Supabase: .from('logs').delete().eq('created_at', 'YYYY-MM-DD')
--    com a data de hoje no teu fuso (igual ao perfil).
--
-- Opção B — SQL Editor no Dashboard Supabase, como postgres (ignora RLS):
--    Ajusta o timezone se não for o teu fuso local.
-- ============================================================

-- Hoje no fuso IANA (ex.: Brasil)
DELETE FROM public.logs
WHERE created_at = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;

-- Alternativa: data fixa (substitui pelo dia que queres limpar)
-- DELETE FROM public.logs WHERE created_at = '2026-04-02';

-- Apenas os teus trackers (substitui o UUID do auth.users)
-- DELETE FROM public.logs AS l
-- USING public.trackers AS t
-- WHERE l.tracker_id = t.id
--   AND t.user_id = '00000000-0000-0000-0000-000000000000'
--   AND l.created_at = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
