-- ============================================================
-- GESTIÓN DE TURNOS — Schema inicial
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ORGANIZACIONES
-- ============================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SUCURSALES / LOCACIONES
-- ============================================================
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROFESIONALES
-- ============================================================
CREATE TABLE professionals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  specialty TEXT,
  bio TEXT,
  avatar_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SERVICIOS
-- ============================================================
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  price NUMERIC(10,2),
  color TEXT DEFAULT '#0ea5e9',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Servicios disponibles por profesional
CREATE TABLE professional_services (
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (professional_id, service_id)
);

-- ============================================================
-- DISPONIBILIDAD SEMANAL (horarios recurrentes)
-- ============================================================
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Dom, 1=Lun, ..., 6=Sáb
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BLOQUEOS / EXCEPCIONES DE DISPONIBILIDAD
-- ============================================================
CREATE TABLE availability_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  blocked_date DATE,                -- bloqueo de día completo
  blocked_start TIMESTAMPTZ,        -- bloqueo de rango horario
  blocked_end TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PACIENTES / CLIENTES
-- ============================================================
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  dni TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TURNOS / APPOINTMENTS
-- ============================================================
CREATE TYPE appointment_status AS ENUM (
  'pendiente',
  'confirmado',
  'cancelado',
  'no_asistio',
  'completado'
);

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,

  -- Datos del turno
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status appointment_status NOT NULL DEFAULT 'pendiente',
  notes TEXT,

  -- Datos del paciente al momento de reservar (denormalizados para historial)
  patient_name TEXT NOT NULL,
  patient_phone TEXT,
  patient_email TEXT,

  -- Pagos (para integración futura)
  payment_status TEXT DEFAULT 'pendiente',  -- pendiente | pagado | reembolsado
  payment_amount NUMERIC(10,2),
  payment_date TIMESTAMPTZ,
  payment_provider TEXT,     -- mercadopago | stripe | modo | paypal
  transaction_id TEXT,

  -- Notificaciones (para integración futura)
  reminder_48h_sent BOOLEAN DEFAULT false,
  reminder_24h_sent BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_appointments_professional_starts ON appointments(professional_id, starts_at);
CREATE INDEX idx_appointments_organization_starts ON appointments(organization_id, starts_at);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_professionals_updated_at BEFORE UPDATE ON professionals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Lectura pública para servicios y profesionales activos (para el formulario de reserva)
CREATE POLICY "servicios_publicos" ON services FOR SELECT USING (active = true);
CREATE POLICY "profesionales_publicos" ON professionals FOR SELECT USING (active = true);
CREATE POLICY "horarios_publicos" ON schedules FOR SELECT USING (active = true);
CREATE POLICY "bloqueos_publicos" ON availability_blocks FOR SELECT USING (true);

-- Inserción pública de turnos (reserva sin login)
CREATE POLICY "reserva_publica" ON appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "reserva_publica_pacientes" ON patients FOR INSERT WITH CHECK (true);

-- Lectura pública de turnos para verificar disponibilidad
CREATE POLICY "disponibilidad_publica" ON appointments
  FOR SELECT USING (status NOT IN ('cancelado'));

-- ============================================================
-- DATOS DE EJEMPLO
-- ============================================================
INSERT INTO organizations (id, name, slug, phone, email, address)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Centro Médico Demo',
  'centro-medico-demo',
  '+54 11 1234-5678',
  'info@centromedico.com',
  'Av. Corrientes 1234, Buenos Aires'
);

INSERT INTO locations (id, organization_id, name, address)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Sede Central',
  'Av. Corrientes 1234, Buenos Aires'
);

INSERT INTO services (id, organization_id, name, description, duration_minutes, price, color)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Consulta General', 'Consulta médica general', 30, 5000, '#0ea5e9'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Consulta Especializada', 'Consulta con especialista', 45, 8000, '#8b5cf6'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Control de Rutina', 'Chequeo preventivo anual', 60, 6500, '#10b981');

INSERT INTO professionals (id, organization_id, location_id, full_name, specialty)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Dra. Ana García', 'Medicina General'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Dr. Carlos Martínez', 'Cardiología');

INSERT INTO professional_services VALUES
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001');

-- Horarios: Lunes a Viernes 9-18
INSERT INTO schedules (professional_id, day_of_week, start_time, end_time)
SELECT 'd0000000-0000-0000-0000-000000000001', day, '09:00', '18:00'
FROM generate_series(1,5) AS day;

INSERT INTO schedules (professional_id, day_of_week, start_time, end_time)
SELECT 'd0000000-0000-0000-0000-000000000002', day, '10:00', '17:00'
FROM generate_series(1,5) AS day;
