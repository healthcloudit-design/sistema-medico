-- ============================================================
-- Migration 026: Roles globaladmin + comercial + RPC crear_tenant
-- ============================================================

-- 1. Ampliar CHECK constraint de profiles.role
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('paciente','medico','recepcion','admin','superadmin','globaladmin','comercial'));

-- 2. Columna assigned_orgs para comercial (solo ve los tenants que le asignás)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  assigned_orgs UUID[] NOT NULL DEFAULT '{}';

-- 3. organization_id en profiles (para globaladmin y comercial)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- 4. Helper functions actualizadas
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS
$$ SELECT role FROM profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS
$$ SELECT role = 'superadmin' FROM profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION is_global_or_super()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS
$$ SELECT role IN ('superadmin','globaladmin') FROM profiles WHERE id = auth.uid() $$;

-- 5. Actualizar política de profiles
--    superadmin: ve todo
--    globaladmin: ve todo EXCEPTO otros superadmin/globaladmin
--    comercial: solo ve profiles de sus orgs asignadas
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;

CREATE POLICY "profiles_superadmin_all" ON profiles
  FOR ALL USING (get_my_role() = 'superadmin');

CREATE POLICY "profiles_globaladmin_manage" ON profiles
  FOR ALL USING (
    get_my_role() = 'globaladmin'
    AND role NOT IN ('superadmin', 'globaladmin')
  );

CREATE POLICY "profiles_comercial_select" ON profiles
  FOR SELECT USING (
    get_my_role() = 'comercial'
    AND (
      id = auth.uid()
      OR organization_id = ANY(
        SELECT unnest(assigned_orgs) FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- 6. RPC: crear_tenant — alta completa en una sola transacción
CREATE OR REPLACE FUNCTION crear_tenant(
  p_name         TEXT,
  p_slug         TEXT,
  p_tenant_type  TEXT,
  p_whatsapp     TEXT DEFAULT NULL,
  p_primary_color TEXT DEFAULT '#0ea5e9',
  p_logo_url     TEXT DEFAULT NULL,
  p_address      TEXT DEFAULT NULL,
  p_phone        TEXT DEFAULT NULL,
  p_email        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
  v_caller_role TEXT;
BEGIN
  -- Solo superadmin y globaladmin pueden crear tenants
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role NOT IN ('superadmin', 'globaladmin') THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Verificar slug único
  IF EXISTS (SELECT 1 FROM organizations WHERE slug = p_slug) THEN
    RETURN jsonb_build_object('error', 'slug_taken');
  END IF;

  -- Crear organización
  INSERT INTO organizations (
    id, name, slug, tenant_type, whatsapp_number,
    primary_color, logo_url, address, phone, email,
    timezone, active, feature_mp, feature_hc
  ) VALUES (
    gen_random_uuid(), p_name, p_slug, p_tenant_type, p_whatsapp,
    p_primary_color, p_logo_url, p_address, p_phone, p_email,
    'America/Argentina/Buenos_Aires', true, false, false
  ) RETURNING id INTO v_org_id;

  -- Servicios base por tipo de negocio
  IF p_tenant_type = 'medical' THEN
    INSERT INTO services (id, organization_id, name, duration_minutes, color, category, active) VALUES
      (gen_random_uuid(), v_org_id, 'Consulta general',        30, '#0ea5e9', 'Consultas', true),
      (gen_random_uuid(), v_org_id, 'Consulta de seguimiento', 20, '#38bdf8', 'Consultas', true),
      (gen_random_uuid(), v_org_id, 'Revisión de resultados',  20, '#7dd3fc', 'Consultas', true),
      (gen_random_uuid(), v_org_id, 'Urgencia',                30, '#f97316', 'Urgencias', true);

  ELSIF p_tenant_type IN ('beauty', 'estetica') THEN
    INSERT INTO services (id, organization_id, name, duration_minutes, color, category, active) VALUES
      (gen_random_uuid(), v_org_id, 'Corte de cabello dama',    60,  '#a855f7', 'Peluquería', true),
      (gen_random_uuid(), v_org_id, 'Corte de cabello caballero',30, '#9333ea', 'Peluquería', true),
      (gen_random_uuid(), v_org_id, 'Brushing / Secado',        45,  '#a78bfa', 'Peluquería', true),
      (gen_random_uuid(), v_org_id, 'Coloración completa',      120, '#7c3aed', 'Peluquería', true),
      (gen_random_uuid(), v_org_id, 'Manicuria simple',         30,  '#ec4899', 'Manicuría',  true),
      (gen_random_uuid(), v_org_id, 'Manicuria semipermanente', 45,  '#db2777', 'Manicuría',  true);

  ELSIF p_tenant_type = 'cancha' THEN
    INSERT INTO services (id, organization_id, name, duration_minutes, color, category, active) VALUES
      (gen_random_uuid(), v_org_id, 'Fútbol 1 hora',   60,  '#16a34a', 'Fútbol', true),
      (gen_random_uuid(), v_org_id, 'Fútbol 90 min',   90,  '#15803d', 'Fútbol', true),
      (gen_random_uuid(), v_org_id, 'Fútbol 2 horas', 120,  '#166534', 'Fútbol', true),
      (gen_random_uuid(), v_org_id, 'Pádel 1 hora',    60,  '#0d9488', 'Pádel',  true),
      (gen_random_uuid(), v_org_id, 'Pádel 90 min',    90,  '#0f766e', 'Pádel',  true),
      (gen_random_uuid(), v_org_id, 'Tenis 1 hora',    60,  '#d97706', 'Tenis',  true),
      (gen_random_uuid(), v_org_id, 'Tenis 90 min',    90,  '#b45309', 'Tenis',  true);

  ELSIF p_tenant_type IN ('petshop', 'veterinary') THEN
    INSERT INTO services (id, organization_id, name, duration_minutes, color, category, active) VALUES
      (gen_random_uuid(), v_org_id, 'Consulta veterinaria', 30, '#f59e0b', 'Consultas', true),
      (gen_random_uuid(), v_org_id, 'Baño y peluquería',    60, '#d97706', 'Estética',  true),
      (gen_random_uuid(), v_org_id, 'Vacunación',           15, '#b45309', 'Salud',     true);

  ELSE -- general
    INSERT INTO services (id, organization_id, name, duration_minutes, color, category, active) VALUES
      (gen_random_uuid(), v_org_id, 'Servicio 1', 30, '#6366f1', 'General', true),
      (gen_random_uuid(), v_org_id, 'Servicio 2', 60, '#8b5cf6', 'General', true);
  END IF;

  RETURN jsonb_build_object('id', v_org_id, 'slug', p_slug);
END;
$$;

GRANT EXECUTE ON FUNCTION crear_tenant TO authenticated;
