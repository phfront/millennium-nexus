-- ============================================================
-- NEXUS PORTAL — Migration inicial
-- ============================================================

-- ── Tabela: profiles ────────────────────────────────────────
CREATE TABLE public.profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name        TEXT,
  avatar_url       TEXT,
  theme_preference TEXT DEFAULT 'dark' CHECK (theme_preference IN ('dark', 'light')),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabela: modules ─────────────────────────────────────────
CREATE TABLE public.modules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  label       TEXT NOT NULL,
  description TEXT,
  icon_name   TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT FALSE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security ──────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules  ENABLE ROW LEVEL SECURITY;

-- profiles: usuário só acessa o próprio registro
CREATE POLICY "profiles: insert próprio"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: select próprio"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: update próprio"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- modules: qualquer usuário autenticado pode listar
CREATE POLICY "modules: select autenticado"
  ON public.modules FOR SELECT
  TO authenticated
  USING (true);

-- ── Trigger: cria profile automaticamente ───────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Storage: bucket avatars ─────────────────────────────────
-- Execute no Supabase Dashboard > Storage ou via API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Política de storage para avatars
-- CREATE POLICY "avatars: upload próprio"
--   ON storage.objects FOR INSERT
--   TO authenticated
--   WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "avatars: update próprio"
--   ON storage.objects FOR UPDATE
--   TO authenticated
--   USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "avatars: leitura pública"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'avatars');

-- ── Dados iniciais de exemplo ───────────────────────────────
INSERT INTO public.modules (slug, label, description, icon_name, is_active, sort_order) VALUES
  ('flow',        'Flow',         'Gestão de tarefas e projetos',       'Kanban',      false, 10),
  ('cash',        'Cash',         'Controle financeiro pessoal',        'Wallet',      false, 20),
  ('vault',       'Vault',        'Cofre de senhas e segredos',         'Lock',        false, 30),
  ('daily-goals', 'Daily Goals',  'Metas e hábitos diários',            'Target',      false, 40);
