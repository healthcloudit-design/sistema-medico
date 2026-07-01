-- ============================================================
-- Migración 032: políticas INSERT/DELETE faltantes en
--   organizations, professionals, services, schedules,
--   availability_blocks
-- Causa raíz: RLS estaba habilitado pero sin policy de INSERT
-- → SQL Editor (rol no-superuser) bloqueaba todas las inserciones
-- ============================================================

-- ── organizations ────────────────────────────────────────────
-- Solo superadmin y globaladmin pueden crear/eliminar centros
CREATE POLICY "org_insert_superadmin"
  ON organizations FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin', 'globaladmin'));

CREATE POLICY "org_delete_superadmin"
  ON organizations FOR DELETE
  USING (get_my_role() IN ('superadmin', 'globaladmin'));

-- globaladmin también puede actualizar (faltaba)
DROP POLICY IF EXISTS "org_update_superadmin" ON organizations;
CREATE POLICY "org_update_superadmin"
  ON organizations FOR UPDATE
  USING (get_my_role() IN ('superadmin', 'globaladmin'));

-- ── professionals ────────────────────────────────────────────
-- Admin de la org y superadmin pueden gestionar profesionales
CREATE POLICY IF NOT EXISTS "prof_insert_admin"
  ON professionals FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin', 'globaladmin', 'admin'));

CREATE POLICY IF NOT EXISTS "prof_update_admin"
  ON professionals FOR UPDATE
  USING (get_my_role() IN ('superadmin', 'globaladmin', 'admin'));

CREATE POLICY IF NOT EXISTS "prof_delete_admin"
  ON professionals FOR DELETE
  USING (get_my_role() IN ('superadmin', 'globaladmin', 'admin'));

-- ── services ─────────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "svc_insert_admin"
  ON services FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin', 'globaladmin', 'admin'));

CREATE POLICY IF NOT EXISTS "svc_update_admin"
  ON services FOR UPDATE
  USING (get_my_role() IN ('superadmin', 'globaladmin', 'admin'));

CREATE POLICY IF NOT EXISTS "svc_delete_admin"
  ON services FOR DELETE
  USING (get_my_role() IN ('superadmin', 'globaladmin', 'admin'));

-- ── schedules ────────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "sched_insert_admin"
  ON schedules FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin', 'globaladmin', 'admin'));

CREATE POLICY IF NOT EXISTS "sched_update_admin"
  ON schedules FOR UPDATE
  USING (get_my_role() IN ('superadmin', 'globaladmin', 'admin'));

CREATE POLICY IF NOT EXISTS "sched_delete_admin"
  ON schedules FOR DELETE
  USING (get_my_role() IN ('superadmin', 'globaladmin', 'admin'));

-- ── availability_blocks ──────────────────────────────────────
CREATE POLICY IF NOT EXISTS "blocks_insert_staff"
  ON availability_blocks FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin', 'globaladmin', 'admin', 'recepcion', 'medico'));

CREATE POLICY IF NOT EXISTS "blocks_delete_staff"
  ON availability_blocks FOR DELETE
  USING (get_my_role() IN ('superadmin', 'globaladmin', 'admin', 'recepcion', 'medico'));
