-- ============================================================
-- Migración 031: Tenant demo — Aguiar Dermatología Estética
-- Dra. Déborah Aguiar · Núñez, CABA
-- 2 médicas, servicios estéticos y dermatológicos
-- ============================================================

DO $$
DECLARE
  v_org_id       UUID;
  v_dra_aguiar   UUID;
  v_dra_colab    UUID;
  days            INT[];
  d               INT;
BEGIN

-- ── 1. Organización ──────────────────────────────────────────
INSERT INTO organizations (
  name, slug, tenant_type,
  primary_color, address, phone, email,
  whatsapp_number, active
) VALUES (
  'Aguiar Dermatología Estética',
  'aguiar-derm',
  'medical',
  '#7C5C8A',                              -- mauve elegante
  'Núñez, Ciudad Autónoma de Buenos Aires',
  '11-0000-0000',
  'turno@aguiarderm.com.ar',
  '5491100000000',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name          = EXCLUDED.name,
  primary_color = EXCLUDED.primary_color,
  active        = true
RETURNING id INTO v_org_id;

-- ── 2. Profesionales ─────────────────────────────────────────
INSERT INTO professionals (
  organization_id, full_name, specialty,
  bio, active
) VALUES (
  v_org_id,
  'Dra. Déborah Aguiar',
  'Dermatología Estética y Láser',
  'Especialista en dermatología estética, tratamientos con láser y medicina anti-aging. Más de 15 años de experiencia en Núñez, CABA.',
  true
)
ON CONFLICT DO NOTHING
RETURNING id INTO v_dra_aguiar;

-- Si ya existía, obtener el id
IF v_dra_aguiar IS NULL THEN
  SELECT id INTO v_dra_aguiar FROM professionals
  WHERE organization_id = v_org_id AND full_name = 'Dra. Déborah Aguiar';
END IF;

INSERT INTO professionals (
  organization_id, full_name, specialty,
  bio, active
) VALUES (
  v_org_id,
  'Dra. Colaboradora',
  'Dermatología Clínica',
  'Médica dermatóloga con orientación clínica y tratamientos de patologías de piel.',
  true
)
ON CONFLICT DO NOTHING
RETURNING id INTO v_dra_colab;

IF v_dra_colab IS NULL THEN
  SELECT id INTO v_dra_colab FROM professionals
  WHERE organization_id = v_org_id AND full_name = 'Dra. Colaboradora';
END IF;

-- ── 3. Servicios ──────────────────────────────────────────────
INSERT INTO services (
  organization_id, name, duration_minutes,
  color, description, active
) VALUES
  (v_org_id, 'Consulta dermatológica',       30, '#7C5C8A', 'Primera consulta o revisión general de piel',                            true),
  (v_org_id, 'Consulta de seguimiento',       20, '#9B7FAA', 'Control de tratamiento en curso',                                        true),
  (v_org_id, 'Toxina botulínica (Botox)',     45, '#C9A97E', 'Aplicación de toxina botulínica para arrugas dinámicas',                 true),
  (v_org_id, 'Relleno de ácido hialurónico', 45, '#D4A5B5', 'Restauración de volumen y contorno facial',                              true),
  (v_org_id, 'Láser CO₂ fraccionado',        60, '#5C8A7C', 'Rejuvenecimiento y textura de piel con láser ablativo fraccionado',      true),
  (v_org_id, 'Láser vascular',               30, '#5C8A7C', 'Tratamiento de manchas vasculares, rosácea y arañas vasculares',         true),
  (v_org_id, 'Peeling químico',              45, '#8A7C5C', 'Renovación celular con ácidos de grado médico',                          true),
  (v_org_id, 'Microdermoabrasión',           30, '#8A7C5C', 'Exfoliación mecánica para textura y luminosidad',                        true),
  (v_org_id, 'PRP (Plasma Rico en Plaquetas)', 60, '#A07B8A', 'Bioestimulación capilar y facial con plasma autólogo',                 true),
  (v_org_id, 'Extracción de lesiones',       20, '#7C5C8A', 'Extirpación de lunares, quistes sebáceos y lesiones benignas',           true)
ON CONFLICT DO NOTHING;

-- ── 4. Disponibilidad: Lun–Vie 09:00–18:00, cada 30 min ─────
days := ARRAY[1, 2, 3, 4, 5];  -- Lunes a Viernes

FOREACH d IN ARRAY days LOOP
  INSERT INTO schedules (
    professional_id, day_of_week,
    start_time, end_time, interval_minutes, active
  ) VALUES
    (v_dra_aguiar, d, '09:00', '18:00', 30, true),
    (v_dra_colab,  d, '09:00', '17:00', 30, true)
  ON CONFLICT DO NOTHING;
END LOOP;

-- Dra. Aguiar también atiende sábados 09:00–13:00
INSERT INTO schedules (
  professional_id, day_of_week,
  start_time, end_time, interval_minutes, active
) VALUES (v_dra_aguiar, 6, '09:00', '13:00', 30, true)
ON CONFLICT DO NOTHING;

RAISE NOTICE 'Tenant Aguiar Dermatología Estética creado — org_id: %', v_org_id;

END $$;
