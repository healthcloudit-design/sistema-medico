-- ============================================================
-- 010_org_isolation.sql
-- Aislamiento multi-tenant por organization_id en profiles + RLS
-- ============================================================

-- 1. Agregar organization_id a profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- 2. Backfill: medicos ya tienen professional_id → derivar org
UPDATE profiles p
SET organization_id = prof.organization_id
FROM professionals prof
WHERE p.professional_id = prof.id
  AND p.organization_id IS NULL;

-- 3. Helper function
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$;

-- ============================================================
-- 4. Actualizar RLS: appointments
-- superadmin: todo; admin/recepcion: solo su org; medico: solo sus turnos
-- ============================================================
DROP POLICY IF EXISTS "appointments_staff_all" ON appointments;

CREATE POLICY "appointments_staff_all" ON appointments
  FOR ALL USING (
    get_my_role() = 'superadmin'
    OR (
      get_my_role() IN ('admin', 'recepcion')
      AND organization_id = get_my_org_id()
    )
  );

-- medico ya estaba bien filtrado por professional_id, solo asegurar org también
DROP POLICY IF EXISTS "appointments_medico_own" ON appointments;

CREATE POLICY "appointments_medico_own" ON appointments
  FOR SELECT USING (
    get_my_role() = 'medico'
    AND professional_id = get_my_professional_id()
    AND organization_id = get_my_org_id()
  );

-- ============================================================
-- 5. Actualizar RLS: patients
-- ============================================================
DROP POLICY IF EXISTS "patients_staff_all" ON patients;

CREATE POLICY "patients_staff_all" ON patients
  FOR ALL USING (
    get_my_role() = 'superadmin'
    OR (
      get_my_role() IN ('admin', 'recepcion', 'medico')
      AND organization_id = get_my_org_id()
    )
  );

-- ============================================================
-- 6. Actualizar RLS: professionals
-- ============================================================
DROP POLICY IF EXISTS "professionals_admin_write" ON professionals;

-- Lectura: staff ve solo su org (para dropdowns en admin)
CREATE POLICY "professionals_read_own_org" ON professionals
  FOR SELECT USING (
    get_my_role() = 'superadmin'
    OR (
      get_my_role() IN ('admin', 'recepcion', 'medico')
      AND organization_id = get_my_org_id()
    )
  );

-- Escritura: solo admin/superadmin de la misma org
CREATE POLICY "professionals_write_own_org" ON professionals
  FOR ALL USING (
    get_my_role() = 'superadmin'
    OR (
      get_my_role() = 'admin'
      AND organization_id = get_my_org_id()
    )
  );

-- ============================================================
-- 7. Actualizar RLS: services
-- ============================================================
DROP POLICY IF EXISTS "services_admin_write" ON services;

CREATE POLICY "services_read_own_org" ON services
  FOR SELECT USING (
    get_my_role() = 'superadmin'
    OR (
      get_my_role() IN ('admin', 'recepcion', 'medico')
      AND organization_id = get_my_org_id()
    )
  );

CREATE POLICY "services_write_own_org" ON services
  FOR ALL USING (
    get_my_role() = 'superadmin'
    OR (
      get_my_role() = 'admin'
      AND organization_id = get_my_org_id()
    )
  );
