-- ============================================================
-- Migración 009: Tenant Libre - Hair and Nails
-- ============================================================
-- NOTA: Correr DESPUÉS de 008_category_tenant_type.sql
-- ============================================================

-- 1. Organización
INSERT INTO organizations (id, name, slug, phone, email, address, timezone, active, tenant_type, feature_mp, feature_hc)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'Libre - Hair and Nails',
  'libre',
  NULL,
  NULL,
  NULL,
  'America/Argentina/Buenos_Aires',
  true,
  'beauty',
  false,
  false
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Profesionales
INSERT INTO professionals (id, organization_id, full_name, specialty, active)
VALUES
  ('b0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000001', 'Lili',        'Peluquería',   true),
  ('b0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000001', 'Brenda',      'Manos',        true),
  ('b0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000001', 'Facu',        'Barbería',     true)
ON CONFLICT (id) DO NOTHING;

-- 3. Servicios — Peluquería (Lili)
INSERT INTO services (id, organization_id, name, category, duration_minutes, price, color, active)
VALUES
  ('b0000000-0000-0000-0001-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Coloración',            'Peluquería', 120, 60000,  '#f472b6', true),
  ('b0000000-0000-0000-0001-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Mechas con papel',      'Peluquería', 180, 140000, '#e879f9', true),
  ('b0000000-0000-0000-0001-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Mechas con gorra',      'Peluquería', 120, 90000,  '#d946ef', true),
  ('b0000000-0000-0000-0001-000000000004', 'b0000000-0000-0000-0000-000000000001', 'Corte',                 'Peluquería',  60, 25000,  '#a855f7', true),
  ('b0000000-0000-0000-0001-000000000005', 'b0000000-0000-0000-0000-000000000001', 'Keratina',              'Peluquería', 180, 55000,  '#c084fc', true),
  ('b0000000-0000-0000-0001-000000000006', 'b0000000-0000-0000-0000-000000000001', 'Botox capilar',         'Peluquería', 120, 30000,  '#e879f9', true),
  ('b0000000-0000-0000-0001-000000000007', 'b0000000-0000-0000-0000-000000000001', 'Alisado sin formol',    'Peluquería', 180, 55000,  '#f0abfc', true),
  ('b0000000-0000-0000-0001-000000000008', 'b0000000-0000-0000-0000-000000000001', 'Alisado con formol',    'Peluquería', 180, 60000,  '#e879f9', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Servicios — Manos (Brenda)
INSERT INTO services (id, organization_id, name, category, duration_minutes, price, color, active)
VALUES
  ('b0000000-0000-0000-0002-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Esmaltado',   'Manos',  45,  8000, '#fb7185', true),
  ('b0000000-0000-0000-0002-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Semi',        'Manos',  60, 12000, '#f43f5e', true),
  ('b0000000-0000-0000-0002-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Capi',        'Manos',  75, 18000, '#e11d48', true),
  ('b0000000-0000-0000-0002-000000000004', 'b0000000-0000-0000-0000-000000000001', 'Soft gel',    'Manos',  90, 25000, '#be123c', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Servicios — Barbería (Facu)
INSERT INTO services (id, organization_id, name, category, duration_minutes, price, color, active)
VALUES
  ('b0000000-0000-0000-0003-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Corte',           'Barbería', 30, 12000, '#64748b', true),
  ('b0000000-0000-0000-0003-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Perfilado cejas', 'Barbería', 20,  5000, '#94a3b8', true),
  ('b0000000-0000-0000-0003-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Barba',           'Barbería', 30,  8000, '#475569', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Asignación de servicios a profesionales
-- Lili → Peluquería
INSERT INTO professional_services (professional_id, service_id) VALUES
  ('b0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0001-000000000001'),
  ('b0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0001-000000000002'),
  ('b0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0001-000000000003'),
  ('b0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0001-000000000004'),
  ('b0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0001-000000000005'),
  ('b0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0001-000000000006'),
  ('b0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0001-000000000007'),
  ('b0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0001-000000000008')
ON CONFLICT DO NOTHING;

-- Brenda → Manos
INSERT INTO professional_services (professional_id, service_id) VALUES
  ('b0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0002-000000000001'),
  ('b0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0002-000000000002'),
  ('b0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0002-000000000003'),
  ('b0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0002-000000000004')
ON CONFLICT DO NOTHING;

-- Facu → Barbería
INSERT INTO professional_services (professional_id, service_id) VALUES
  ('b0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0003-000000000001'),
  ('b0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0003-000000000002'),
  ('b0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0003-000000000003')
ON CONFLICT DO NOTHING;

-- 7. Horarios de atención (lunes a sábado, 9-18hs, intervalos 30 min)
INSERT INTO schedules (professional_id, day_of_week, start_time, end_time, interval_minutes, active)
SELECT prof_id, dow, '09:00', '18:00', 30, true
FROM (VALUES
  ('b0000000-0000-0000-0000-000000000010'::uuid),
  ('b0000000-0000-0000-0000-000000000011'::uuid),
  ('b0000000-0000-0000-0000-000000000012'::uuid)
) AS profs(prof_id)
CROSS JOIN generate_series(1, 6) AS days(dow)
ON CONFLICT DO NOTHING;
