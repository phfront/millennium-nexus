-- Cores de marca personalizáveis (primária / secundária). NULL = usar tokens padrão do tema.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_primary_hex TEXT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_secondary_hex TEXT NULL;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_brand_primary_hex_format
  CHECK (brand_primary_hex IS NULL OR brand_primary_hex ~* '^#[0-9a-f]{6}$');

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_brand_secondary_hex_format
  CHECK (brand_secondary_hex IS NULL OR brand_secondary_hex ~* '^#[0-9a-f]{6}$');
