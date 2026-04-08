-- ============================================================
-- NEXUS — Views em public: security_invoker (PG15+)
-- Corrige aviso Supabase "rls_disabled_in_public" / tabela "pública":
-- sem isto, as views correm como definer e ignoram RLS das tabelas base.
-- Com security_invoker, o PostgREST/cliente aplica RLS como nas tabelas.
-- Requer PostgreSQL >= 15 (Supabase Cloud OK).
-- ============================================================

ALTER VIEW public.current_streaks SET (security_invoker = true);
ALTER VIEW public.daily_scores SET (security_invoker = true);
ALTER VIEW public.total_scores SET (security_invoker = true);
ALTER VIEW public.health_summary SET (security_invoker = true);
ALTER VIEW public.finance_monthly_summary SET (security_invoker = true);
