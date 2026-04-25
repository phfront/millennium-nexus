-- ============================================================
-- NEXUS — Re-apply security_invoker on views recreated after 025
-- Migrations 050 (finance_monthly_summary) and 051 (current_streaks)
-- used CREATE OR REPLACE VIEW which reset security_invoker to false.
-- ============================================================

ALTER VIEW public.finance_monthly_summary SET (security_invoker = true);
ALTER VIEW public.current_streaks          SET (security_invoker = true);
