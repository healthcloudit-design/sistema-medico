-- ============================================================
-- 011_demo_tenants.sql
-- Tenants demo para especialidades medicas
-- Slugs: /oftalmologia  /kinesiologia  /odontologia
-- ============================================================

-- 1. Organizaciones
INSERT INTO organizations (id, name, slug, phone, email, timezone, active, feature_mp, feature_hc, tenant_type)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Vision Centro', 'oftalmologia', null, null, 'America/Argentina/Buenos_Aires', true, false, true,  'medical'),
  ('c2000000-0000-0000-0000-000000000001', 'Kine & Movimiento', 'kinesiologia', null, null, 'America/Argentina/Buenos_Aires', true, false, false, 'medical'),
  ('c3000000-0000-0000-0000-000000000001', 'Sonrisa Dental', 'odontologia', null, null, 'America/Argentina/Buenos_Aires', true, false, false, 'medical')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. Profesionales (uno por org para la demo)
-- ============================================================
INSERT INTO professionals (id, organization_id, full_name, specialty, active)
VALUES
  ('c1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000001', 'Dr. Andres Molina',   'Oftalmologia',  true),
  ('c2000000-0000-0000-0000-000000000011', 'c2000000-0000-0000-0000-000000000001', 'Lic. Paula Soria',    'Kinesiologia',  true),
  ('c3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'Dr. Martin Ferreyra', 'Odontologia',   true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Servicios — Vision Centro (Oftalmologia)
-- ============================================================
INSERT INTO services (id, organization_id, name, duration_minutes, price, color, active)
VALUES
  ('c1000000-0000-0000-0001-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Control visual',         30,  8000, '#0ea5e9', true),
  ('c1000000-0000-0000-0001-000000000002', 'c1000000-0000-0000-0000-000000000001', 'Fondo de ojo',           45, 12000, '#6366f1', true),
  ('c1000000-0000-0000-0001-000000000003', 'c1000000-0000-0000-0000-000000000001', 'Adaptacion lentes contacto', 30, 10000, '#8b5cf6', true),
  ('c1000000-0000-0000-0001-000000000004', 'c1000000-0000-0000-0000-000000000001', 'Consulta prequirurgica',  60, 20000, '#f59e0b', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Servicios — Kine & Movimiento
INSERT INTO services (id, organization_id, name, duration_minutes, price, color, active)
VALUES
  ('c2000000-0000-0000-0001-000000000001', 'c2000000-0000-0000-0000-000000000001', 'Sesion kinesiologica',    45,  9000, '#10b981', true),
  ('c2000000-0000-0000-0001-000000000002', 'c2000000-0000-0000-0000-000000000001', 'Rehabilitacion postquirurgica', 60, 12000, '#059669', true),
  ('c2000000-0000-0000-0001-000000000003', 'c2000000-0000-0000-0000-000000000001', 'Pilates terapeutico',     50,  8000, '#34d399', true),
  ('c2000000-0000-0000-0001-000000000004', 'c2000000-0000-0000-0000-000000000001', 'Masaje deportivo',        40,  7000, '#6ee7b7', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Servicios — Sonrisa Dental
INSERT INTO services (id, organization_id, name, duration_minutes, price, color, active)
VALUES
  ('c3000000-0000-0000-0001-000000000001', 'c3000000-0000-0000-0000-000000000001', 'Consulta y diagnostico',  30,  7000, '#f43f5e', true),
  ('c3000000-0000-0000-0001-000000000002', 'c3000000-0000-0000-0000-000000000001', 'Limpieza dental',         45, 10000, '#fb7185', true),
  ('c3000000-0000-0000-0001-000000000003', 'c3000000-0000-0000-0000-000000000001', 'Blanqueamiento',          60, 25000, '#fda4af', true),
  ('c3000000-0000-0000-0001-000000000004', 'c3000000-0000-0000-0000-000000000001', 'Extraccion',              30, 12000, '#e11d48', true),
  ('c3000000-0000-0000-0001-000000000005', 'c3000000-0000-0000-0000-000000000001', 'Ortodoncia - control',    20,  8000, '#be123c', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. professional_services
-- ============================================================
INSERT INTO professional_services (professional_id, service_id) VALUES
  ('c1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0001-000000000001'),
  ('c1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0001-000000000002'),
  ('c1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0001-000000000003'),
  ('c1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0001-000000000004'),
  ('c2000000-0000-0000-0000-000000000011', 'c2000000-0000-0000-0001-000000000001'),
  ('c2000000-0000-0000-0000-000000000011', 'c2000000-0000-0000-0001-000000000002'),
  ('c2000000-0000-0000-0000-000000000011', 'c2000000-0000-0000-0001-000000000003'),
  ('c2000000-0000-0000-0000-000000000011', 'c2000000-0000-0000-0001-000000000004'),
  ('c3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0001-000000000001'),
  ('c3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0001-000000000002'),
  ('c3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0001-000000000003'),
  ('c3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0001-000000000004'),
  ('c3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0001-000000000005')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. Schedules — lun a vie 9-18hs, 30 min, para los tres
-- ============================================================
INSERT INTO schedules (professional_id, day_of_week, start_time, end_time, interval_minutes, active)
SELECT
  prof_id,
  day,
  '09:00', '18:00', 30, true
FROM (VALUES
  ('c1000000-0000-0000-0000-000000000011'::uuid),
  ('c2000000-0000-0000-0000-000000000011'::uuid),
  ('c3000000-0000-0000-0000-000000000001'::uuid)
) AS profs(prof_id)
CROSS JOIN generate_series(1, 5) AS day
ON CONFLICT DO NOTHING;

-- ============================================================
-- Tenants adicionales: Médico General y Pediatría
-- ============================================================
INSERT INTO organizations (id, name, slug, timezone, active, feature_mp, feature_hc, tenant_type)
VALUES
  ('c4000000-0000-0000-0000-000000000001', 'Centro Médico General', 'medico-general', 'America/Argentina/Buenos_Aires', true, false, true, 'medical'),
  ('c5000000-0000-0000-0000-000000000001', 'Pediatría Integral',    'pediatria',      'America/Argentina/Buenos_Aires', true, false, true, 'medical')
ON CONFLICT (id) DO NOTHING;

INSERT INTO professionals (id, organization_id, full_name, specialty, active)
VALUES
  ('c4000000-0000-0000-0000-000000000011', 'c4000000-0000-0000-0000-000000000001', 'Dr. Roberto Vidal',   'Clínica Médica', true),
  ('c5000000-0000-0000-0000-000000000011', 'c5000000-0000-0000-0000-000000000001', 'Dra. Cecilia Romero', 'Pediatría',      true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, organization_id, name, duration_minutes, price, color, active)
VALUES
  ('c4000000-0000-0000-0001-000000000001', 'c4000000-0000-0000-0000-000000000001', 'Consulta clínica',        30,  8000, '#0ea5e9', true),
  ('c4000000-0000-0000-0001-000000000002', 'c4000000-0000-0000-0000-000000000001', 'Control de rutina',       20,  6000, '#38bdf8', true),
  ('c4000000-0000-0000-0001-000000000003', 'c4000000-0000-0000-0000-000000000001', 'Certificado médico',      15,  4000, '#7dd3fc', true),
  ('c4000000-0000-0000-0001-000000000004', 'c4000000-0000-0000-0000-000000000001', 'Electrocardiograma',      30, 12000, '#0369a1', true),
  ('c5000000-0000-0000-0001-000000000001', 'c5000000-0000-0000-0000-000000000001', 'Consulta pediátrica',     30,  8000, '#a78bfa', true),
  ('c5000000-0000-0000-0001-000000000002', 'c5000000-0000-0000-0000-000000000001', 'Control de crecimiento',  20,  6000, '#c4b5fd', true),
  ('c5000000-0000-0000-0001-000000000003', 'c5000000-0000-0000-0000-000000000001', 'Vacunación',              15,  5000, '#ddd6fe', true),
  ('c5000000-0000-0000-0001-000000000004', 'c5000000-0000-0000-0000-000000000001', 'Urgencia pediátrica',     30, 10000, '#7c3aed', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO professional_services (professional_id, service_id) VALUES
  ('c4000000-0000-0000-0000-000000000011', 'c4000000-0000-0000-0001-000000000001'),
  ('c4000000-0000-0000-0000-000000000011', 'c4000000-0000-0000-0001-000000000002'),
  ('c4000000-0000-0000-0000-000000000011', 'c4000000-0000-0000-0001-000000000003'),
  ('c4000000-0000-0000-0000-000000000011', 'c4000000-0000-0000-0001-000000000004'),
  ('c5000000-0000-0000-0000-000000000011', 'c5000000-0000-0000-0001-000000000001'),
  ('c5000000-0000-0000-0000-000000000011', 'c5000000-0000-0000-0001-000000000002'),
  ('c5000000-0000-0000-0000-000000000011', 'c5000000-0000-0000-0001-000000000003'),
  ('c5000000-0000-0000-0000-000000000011', 'c5000000-0000-0000-0001-000000000004')
ON CONFLICT DO NOTHING;

INSERT INTO schedules (professional_id, day_of_week, start_time, end_time, interval_minutes, active)
SELECT prof_id, day, '09:00', '18:00', 30, true
FROM (VALUES
  ('c4000000-0000-0000-0000-000000000011'::uuid),
  ('c5000000-0000-0000-0000-000000000011'::uuid)
) AS profs(prof_id)
CROSS JOIN generate_series(1, 5) AS day
ON CONFLICT DO NOTHING;
