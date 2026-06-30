-- ============================================================
-- Migration 027: Tenant demo — Complejo de Canchas
-- ============================================================
-- Crea un tenant tipo 'cancha' para demo comercial.
-- Canchas modeladas como "profesionales" (recurso reservable).
-- Servicios = tipos + duración por categoría.
-- ============================================================

DO $$
DECLARE
  v_org_id UUID;
BEGIN

  -- ── Crear organización ───────────────────────────────────
  INSERT INTO organizations (
    id, name, slug, tenant_type,
    primary_color, address, phone, email,
    active, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    'Praxis Canchas',
    'canchas-demo',
    'cancha',
    '#16a34a',
    'Av. Libertador 1234, Buenos Aires',
    '011-4567-8900',
    'reservas@praxiscanchas.com.ar',
    true, now(), now()
  )
  ON CONFLICT (slug) DO UPDATE SET
    name          = EXCLUDED.name,
    primary_color = EXCLUDED.primary_color,
    updated_at    = now()
  RETURNING id INTO v_org_id;

  -- Si ya existía, obtener el ID existente
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM organizations WHERE slug = 'canchas-demo';
  END IF;

  -- ── Limpiar servicios y profesionales anteriores ─────────
  DELETE FROM services     WHERE organization_id = v_org_id;
  DELETE FROM professionals WHERE organization_id = v_org_id;

  -- ── Servicios (duración por tipo de deporte) ─────────────
  INSERT INTO services (id, organization_id, name, description, duration_minutes, color, category, active) VALUES
    (gen_random_uuid(), v_org_id, 'Fútbol 5 — 1 hora',    'Cancha de fútbol 5, piso sintético', 60,  '#16a34a', 'Fútbol',  true),
    (gen_random_uuid(), v_org_id, 'Fútbol 5 — 90 min',    'Cancha de fútbol 5, piso sintético', 90,  '#15803d', 'Fútbol',  true),
    (gen_random_uuid(), v_org_id, 'Fútbol 5 — 2 horas',   'Cancha de fútbol 5, piso sintético', 120, '#166534', 'Fútbol',  true),
    (gen_random_uuid(), v_org_id, 'Pádel — 1 hora',       'Cancha de pádel techada',             60,  '#0d9488', 'Pádel',   true),
    (gen_random_uuid(), v_org_id, 'Pádel — 90 min',       'Cancha de pádel techada',             90,  '#0f766e', 'Pádel',   true),
    (gen_random_uuid(), v_org_id, 'Tenis — 1 hora',       'Cancha de tenis en polvo de ladrillo',60,  '#d97706', 'Tenis',   true),
    (gen_random_uuid(), v_org_id, 'Tenis — 90 min',       'Cancha de tenis en polvo de ladrillo',90,  '#b45309', 'Tenis',   true);

  -- ── Canchas como "profesionales" (recursos reservables) ──
  -- Fútbol
  INSERT INTO professionals (id, organization_id, full_name, specialty, active, created_at, updated_at) VALUES
    (gen_random_uuid(), v_org_id, 'Cancha Fútbol 1', 'Fútbol 5 — Piso sintético', true, now(), now()),
    (gen_random_uuid(), v_org_id, 'Cancha Fútbol 2', 'Fútbol 5 — Piso sintético', true, now(), now()),
    (gen_random_uuid(), v_org_id, 'Cancha Fútbol 3', 'Fútbol 5 — Piso sintético', true, now(), now());
  -- Pádel
  INSERT INTO professionals (id, organization_id, full_name, specialty, active, created_at, updated_at) VALUES
    (gen_random_uuid(), v_org_id, 'Cancha Pádel 1', 'Pádel — Techada', true, now(), now()),
    (gen_random_uuid(), v_org_id, 'Cancha Pádel 2', 'Pádel — Techada', true, now(), now());
  -- Tenis
  INSERT INTO professionals (id, organization_id, full_name, specialty, active, created_at, updated_at) VALUES
    (gen_random_uuid(), v_org_id, 'Cancha Tenis 1', 'Tenis — Polvo de ladrillo', true, now(), now()),
    (gen_random_uuid(), v_org_id, 'Cancha Tenis 2', 'Tenis — Polvo de ladrillo', true, now(), now());

  -- ── Disponibilidades ─────────────────────────────────────
  -- Lunes a Domingo 08:00 – 23:00 para todas las canchas.
  -- Supabase genera los slots de 1h automáticamente según el servicio seleccionado.
  INSERT INTO schedules (id, professional_id, day_of_week, start_time, end_time, active)
  SELECT
    gen_random_uuid(),
    p.id,
    d.day,
    '08:00'::time,
    '23:00'::time,
    true
  FROM professionals p
  CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS d(day)
  WHERE p.organization_id = v_org_id;

END $$;
