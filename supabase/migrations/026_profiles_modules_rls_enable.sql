-- ============================================================
-- NEXUS — profiles + modules: garantir RLS ativo (idempotente)
-- Corrige badge "UNRESTRICTED" / advisor rls_disabled_in_public
-- quando o RLS nunca foi aplicado no remoto ou foi desligado.
-- Políticas: ver 001_initial.sql e 011_admin_module_access.sql
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
