-- ============================================================
-- 013_dermatologo_tenant.sql
-- Tenant demo: Centro Dermatológico
-- ============================================================

INSERT INTO organizations (id, name, slug, timezone, active, feature_mp, feature_hc, tenant_type)
VALUES (
  'c7000000-0000-0000-0000-000000000001',
  'DermaCenter - Centro Dermatológico',
  'dermatologo',
  'America/Argentina/Buenos_Aires',
  true, false, true, 'medical'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO professionals (id, organization_id, full_name, specialty, active)
VALUES (
  'c7000000-0000-0000-0000-000000000011',
  'c7000000-0000-0000-0000-000000000001',
  'Dra. Valentina Ríos',
  'Dermatología',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, organization_id, name, category, duration_minutes, price, color, active)
VALUES
  -- Consultas
  ('c7000000-0000-0000-0001-000000000001', 'c7000000-0000-0000-0000-000000000001',
   'Consulta dermatológica',        'Consultas',       30, 25000, '#60a5fa', true),
  ('c7000000-0000-0000-0001-000000000002', 'c7000000-0000-0000-0000-000000000001',
   'Primera consulta',              'Consultas',       45, 30000, '#3b82f6', true),

  -- Diagnóstico
  ('c7000000-0000-0000-0001-000000000003', 'c7000000-0000-0000-0000-000000000001',
   'Mapeo de lunares (dermatoscopia)', 'Diagnóstico',  40, 35000, '#34d399', true),
  ('c7000000-0000-0000-0001-000000000004', 'c7000000-0000-0000-0000-000000000001',
   'Biopsia de piel',               'Diagnóstico',     30, 40000, '#10b981', true),

  -- Procedimientos
  ('c7000000-0000-0000-0001-000000000005', 'c7000000-0000-0000-0000-000000000001',
   'Extirpación de lunar / lesión', 'Procedimientos',  30, 45000, '#f59e0b', true),
  ('c7000000-0000-0000-0001-000000000006', 'c7000000-0000-0000-0000-000000000001',
   'Electrocirugía',                'Procedimientos',  30, 40000, '#f97316', true),
  ('c7000000-0000-0000-0001-000000000007', 'c7000000-0000-0000-0000-000000000001',
   'Infiltración intralesional',    'Procedimientos',  20, 30000, '#fb923c', true),

  -- Tratamientos
  ('c7000000-0000-0000-0001-000000000008', 'c7000000-0000-0000-0000-000000000001',
   'Tratamiento de acné',           'Tratamientos',    30, 22000, '#a78bfa', true),
  ('c7000000-0000-0000-0001-000000000009', 'c7000000-0000-0000-0000-000000000001',
   'Peeling químico',               'Tratamientos',    45, 38000, '#8b5cf6', true),
  ('c7000000-0000-0000-0001-000000000010', 'c7000000-0000-0000-0000-000000000001',
   'Crioterapia (verrugas / queratosis)', 'Tratamientos', 20, 20000, '#c4b5fd', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO professional_services (professional_id, service_id) VALUES
  ('c7000000-0000-0000-0000-000000000011', 'c7000000-0000-0000-0001-000000000001'),
  ('c7000000-0000-0000-0000-000000000011', 'c7000000-0000-0000-0001-000000000002'),
  ('c7000000-0000-0000-0000-000000000011', 'c7000000-0000-0000-0001-000000000003'),
  ('c7000000-0000-0000-0000-000000000011', 'c7000000-0000-0000-0001-000000000004'),
  ('c7000000-0000-0000-0000-000000000011', 'c7000000-0000-0000-0001-000000000005'),
  ('c7000000-0000-0000-0000-000000000011', 'c7000000-0000-0000-0001-000000000006'),
  ('c7000000-0000-0000-0000-000000000011', 'c7000000-0000-0000-0001-000000000007'),
  ('c7000000-0000-0000-0000-000000000011', 'c7000000-0000-0000-0001-000000000008'),
  ('c7000000-0000-0000-0000-000000000011', 'c7000000-0000-0000-0001-000000000009'),
  ('c7000000-0000-0000-0000-000000000011', 'c7000000-0000-0000-0001-000000000010')
ON CONFLICT DO NOTHING;

-- Lunes a viernes 8-18hs, turnos de 30 min
INSERT INTO schedules (professional_id, day_of_week, start_time, end_time, interval_minutes, active)
SELECT 'c7000000-0000-0000-0000-000000000011'::uuid, day, '08:00', '18:00', 30, true
FROM generate_series(1, 5) AS day
ON CONFLICT DO NOTHING;
