-- ============================================================
-- MIGRACIÓN 005 — Tabla profiles + RBAC
-- ============================================================

-- 1. Tabla profiles
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'admin'
                    CHECK (role IN ('paciente','medico','recepcion','admin','superadmin')),
  full_name       TEXT,
  professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Funciones helper (SECURITY DEFINER evita recursión en RLS)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE
AS $$ SELECT role FROM profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION get_my_professional_id()
RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE
AS $$ SELECT professional_id FROM profiles WHERE id = auth.uid() $$;

-- 3. RLS en profiles
CREATE POLICY "profiles_select_own"  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own"  ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_admin_all"   ON profiles FOR ALL   USING (get_my_role() IN ('admin','superadmin'));

-- 4. Crear profile para usuarios existentes
INSERT INTO profiles (id, role, full_name)
SELECT id, 'admin', email
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 5. Trigger: crear profile automáticamente al registrar usuario
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 6. RLS adicional en tablas para staff autenticado
-- Turnos: admin/recepcion ven todos; médico solo los suyos
CREATE POLICY "appointments_staff_all" ON appointments
  FOR ALL USING (get_my_role() IN ('admin','superadmin','recepcion'));

CREATE POLICY "appointments_medico_own" ON appointments
  FOR SELECT USING (
    get_my_role() = 'medico' AND professional_id = get_my_professional_id()
  );

-- Pacientes
CREATE POLICY "patients_staff_all" ON patients
  FOR ALL USING (get_my_role() IN ('admin','superadmin','recepcion','medico'));

-- Profesionales (escritura solo admin)
CREATE POLICY "professionals_admin_write" ON professionals
  FOR ALL USING (get_my_role() IN ('admin','superadmin'));

-- Servicios (escritura solo admin)
CREATE POLICY "services_admin_write" ON services
  FOR ALL USING (get_my_role() IN ('admin','superadmin'));

-- Schedules/bloques: admin y el propio médico
CREATE POLICY "schedules_staff_write" ON schedules
  FOR ALL USING (
    get_my_role() IN ('admin','superadmin') OR
    (get_my_role() = 'medico' AND professional_id = get_my_professional_id())
  );

CREATE POLICY "availability_blocks_staff_write" ON availability_blocks
  FOR ALL USING (
    get_my_role() IN ('admin','superadmin') OR
    (get_my_role() = 'medico' AND professional_id = get_my_professional_id())
  );
