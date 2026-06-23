-- Limpa dados locais antes de importar dump da cloud.
-- Migrations inserem seeds (ex.: foods, modules); o dump traz os mesmos registros.
SET client_min_messages TO warning;
-- RESTART IDENTITY so funciona em tabelas owned by postgres (public).

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format(
      'TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE',
      r.tablename
    );
  END LOOP;
END $$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'auth'
      AND tablename <> 'schema_migrations'
  ) LOOP
    EXECUTE format(
      'TRUNCATE TABLE auth.%I CASCADE',
      r.tablename
    );
  END LOOP;
END $$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'storage'
      AND tablename IN ('buckets', 'objects', 's3_multipart_uploads', 's3_multipart_uploads_parts')
  ) LOOP
    EXECUTE format(
      'TRUNCATE TABLE storage.%I CASCADE',
      r.tablename
    );
  END LOOP;
END $$;
