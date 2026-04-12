-- =============================================
-- Migration: Adicionar configuração de IA ao perfil
-- =============================================

ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_api_key TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT NULL;

COMMENT ON COLUMN profiles.ai_provider IS 'Provedor de IA: openai, gemini';
COMMENT ON COLUMN profiles.ai_api_key IS 'Chave de API para o provedor de IA';
COMMENT ON COLUMN profiles.ai_model IS 'Modelo preferido (ex: gpt-4o-mini, gemini-2.0-flash)';
