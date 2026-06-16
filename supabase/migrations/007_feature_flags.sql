-- ============================================================
-- Migración 007: Feature flags por organización
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS feature_mp BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_hc BOOLEAN NOT NULL DEFAULT false;

-- Comentarios descriptivos
COMMENT ON COLUMN organizations.feature_mp IS 'Módulo MercadoPago habilitado para esta organización';
COMMENT ON COLUMN organizations.feature_hc IS 'Módulo Historia Clínica habilitado para esta organización';

-- ============================================================
-- RLS en organizations (superadmin puede ver y editar todas)
-- ============================================================
-- Lectura: staff de la org + superadmin
CREATE POLICY "org_select_own"
  ON organizations FOR SELECT
  USING (
    get_my_role() IN ('admin', 'superadmin', 'recepcion', 'medico')
  );

-- Escritura: solo superadmin puede actualizar (feature flags, etc.)
CREATE POLICY "org_update_superadmin"
  ON organizations FOR UPDATE
  USING (get_my_role() = 'superadmin');

-- Lectura pública del slug (para la booking page)
CREATE POLICY "org_select_public_slug"
  ON organizations FOR SELECT
  USING (active = true);
