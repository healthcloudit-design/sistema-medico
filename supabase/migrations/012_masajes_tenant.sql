-- ============================================================
-- 012_masajes_tenant.sql
-- Tenant demo: Spa & Masajes
-- ============================================================

INSERT INTO organizations (id, name, slug, timezone, active, feature_mp, feature_hc, tenant_type)
VALUES ('c6000000-0000-0000-0000-000000000001', 'Zen Spa & Masajes', 'masajes', 'America/Argentina/Buenos_Aires', true, false, false, 'beauty')
ON CONFLICT (id) DO NOTHING;

INSERT INTO professionals (id, organization_id, full_name, specialty, active)
VALUES ('c6000000-0000-0000-0000-000000000011', 'c6000000-0000-0000-0000-000000000001', 'Sofia Blanco', 'Masoterapia', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, organization_id, name, category, duration_minutes, price, color, active)
VALUES
  ('c6000000-0000-0000-0001-000000000001', 'c6000000-0000-0000-0000-000000000001', 'Masaje relajante',      'Masajes', 60, 15000, '#a78bfa', true),
  ('c6000000-0000-0000-0001-000000000002', 'c6000000-0000-0000-0000-000000000001', 'Masaje descontracturante', 'Masajes', 60, 18000, '#8b5cf6', true),
  ('c6000000-0000-0000-0001-000000000003', 'c6000000-0000-0000-0000-000000000001', 'Masaje de piedras calientes', 'Masajes', 75, 22000, '#7c3aed', true),
  ('c6000000-0000-0000-0001-000000000004', 'c6000000-0000-0000-0000-000000000001', 'Reflexologia',          'Reflexologia', 45, 12000, '#6d28d9', true),
  ('c6000000-0000-0000-0001-000000000005', 'c6000000-0000-0000-0000-000000000001', 'Drenaje linfatico',     'Drenaje', 60, 20000, '#5b21b6', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO professional_services (professional_id, service_id) VALUES
  ('c6000000-0000-0000-0000-000000000011', 'c6000000-0000-0000-0001-000000000001'),
  ('c6000000-0000-0000-0000-000000000011', 'c6000000-0000-0000-0001-000000000002'),
  ('c6000000-0000-0000-0000-000000000011', 'c6000000-0000-0000-0001-000000000003'),
  ('c6000000-0000-0000-0000-000000000011', 'c6000000-0000-0000-0001-000000000004'),
  ('c6000000-0000-0000-0000-000000000011', 'c6000000-0000-0000-0001-000000000005')
ON CONFLICT DO NOTHING;

INSERT INTO schedules (professional_id, day_of_week, start_time, end_time, interval_minutes, active)
SELECT 'c6000000-0000-0000-0000-000000000011'::uuid, day, '09:00', '20:00', 60, true
FROM generate_series(1, 6) AS day
ON CONFLICT DO NOTHING;
