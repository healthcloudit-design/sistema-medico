-- ============================================================
-- Migración 044: Storage bucket para assets de organizaciones
-- Bucket: org-assets (público, 5MB, solo imágenes)
-- RLS: SELECT público, INSERT/UPDATE/DELETE para autenticados
-- ============================================================

-- Crear bucket si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-assets',
  'org-assets',
  true,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public             = true,
  file_size_limit    = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- DROP policies existentes para evitar conflictos
DROP POLICY IF EXISTS "org_assets_public_read"    ON storage.objects;
DROP POLICY IF EXISTS "org_assets_auth_insert"    ON storage.objects;
DROP POLICY IF EXISTS "org_assets_auth_update"    ON storage.objects;
DROP POLICY IF EXISTS "org_assets_auth_delete"    ON storage.objects;

-- Lectura pública (landing pages necesitan ver las imágenes sin auth)
CREATE POLICY "org_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'org-assets');

-- Solo usuarios autenticados con rol >= admin pueden subir
CREATE POLICY "org_assets_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'org-assets'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "org_assets_auth_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'org-assets'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "org_assets_auth_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'org-assets'
    AND auth.role() = 'authenticated'
  );
