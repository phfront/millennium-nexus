ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_module_slug TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_home_module_slug_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_home_module_slug_check
      CHECK (home_module_slug IS NULL OR home_module_slug IN ('finance', 'health', 'habits-goals'));
  END IF;
END $$;
