-- ============================================================
-- Migration 028: Fix RLS en profiles
-- ============================================================
-- La migración 026 eliminó "profiles_admin_all" y reemplazó
-- solo con políticas para superadmin/globaladmin/comercial.
-- admin, medico, recepcion y paciente quedaron sin acceso
-- a su propio profile → login roto (useProfile retorna null).
-- ============================================================

-- Permitir a cualquier usuario autenticado leer su propio perfil
CREATE POLICY "profiles_self_select" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Permitir a cualquier usuario autenticado actualizar su propio perfil
-- (necesario para que puedan editar nombre, foto, etc.)
CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- admin puede ver/gestionar todos los profiles de su organización
CREATE POLICY "profiles_admin_org" ON profiles
  FOR ALL USING (
    get_my_role() = 'admin'
    AND organization_id = (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
