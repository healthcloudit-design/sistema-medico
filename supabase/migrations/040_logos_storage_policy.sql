-- Migración 040: políticas de Storage para bucket logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('logos', 'logos', true, 2097152, ARRAY['image/png','image/jpeg','image/webp','image/gif','image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "logos_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "logos_auth_insert"  ON storage.objects;
DROP POLICY IF EXISTS "logos_auth_update"  ON storage.objects;
DROP POLICY IF EXISTS "logos_auth_delete"  ON storage.objects;

CREATE POLICY "logos_public_read"  ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "logos_auth_insert"  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');
CREATE POLICY "logos_auth_update"  ON storage.objects FOR UPDATE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');
CREATE POLICY "logos_auth_delete"  ON storage.objects FOR DELETE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');
