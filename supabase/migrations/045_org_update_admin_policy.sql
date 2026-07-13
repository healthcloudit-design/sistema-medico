-- ============================================================
-- Migración 045: permitir que rol 'admin' actualice su propia org
-- La policy anterior (032) solo cubría superadmin/globaladmin.
-- Admin debe poder editar nombre, specialty, colores, imágenes, etc.
-- ============================================================

-- Extender la policy existente de UPDATE para incluir 'admin'
-- scoped a su propia organización (via profiles.organization_id)
DROP POLICY IF EXISTS "org_update_superadmin" ON organizations;

-- Superadmin/globaladmin: pueden actualizar CUALQUIER org
CREATE POLICY "org_update_superadmin"
  ON organizations FOR UPDATE
  USING (get_my_role() IN ('superadmin', 'globaladmin'));

-- Admin: solo puede actualizar SU propia organización
CREATE POLICY "org_update_admin_own"
  ON organizations FOR UPDATE
  USING (
    get_my_role() = 'admin'
    AND id = (
      SELECT organization_id
      FROM profiles
      WHERE id = auth.uid()
      LIMIT 1
    )
  );
