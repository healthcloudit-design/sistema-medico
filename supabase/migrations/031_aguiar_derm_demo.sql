-- ============================================================
-- Migración 031: Tenant — DA Dermatología Estética y LASER
-- Dra. Déborah Aguiar · Av. Cabildo 3073, Núñez, CABA
-- MN 154557 · @dra.debaguiar
-- ============================================================

SET LOCAL row_security = off;

DO $$
DECLARE
  v_org_id       UUID;
  v_dra_aguiar   UUID;
  v_dra_colab    UUID;
  d               INT;
BEGIN

-- ── 1. Organización ──────────────────────────────────────────
INSERT INTO organizations (
  name, slug, tenant_type,
  primary_color,
  address, phone, email,
  whatsapp_number,
  instagram_handle,
  active
) VALUES (
  'DA Dermatología Estética y LASER',
  'da-derm',
  'estetica',
  '#9E7560',                                    -- nude cálido, estética médica
  'Av. Cabildo 3073, Núñez, CABA 1429',
  '11-0000-0000',
  'turno@daderm.com.ar',
  '5492615781357',                              -- WhatsApp real
  'dra.debaguiar',                              -- Instagram
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name             = EXCLUDED.name,
  primary_color    = EXCLUDED.primary_color,
  address          = EXCLUDED.address,
  whatsapp_number  = EXCLUDED.whatsapp_number,
  instagram_handle = EXCLUDED.instagram_handle,
  active           = true
RETURNING id INTO v_org_id;

-- ── 2. Profesionales ─────────────────────────────────────────
INSERT INTO professionals (
  organization_id, full_name, specialty, bio, active
) VALUES (
  v_org_id,
  'Dra. Déborah Aguiar',
  'Dermatología Estética y Láser',
  'Directora Médica de DA. Especialista en láser Candela, toxina botulínica, rellenos y bioestimulación. MN 154557.',
  true
)
ON CONFLICT DO NOTHING
RETURNING id INTO v_dra_aguiar;

IF v_dra_aguiar IS NULL THEN
  SELECT id INTO v_dra_aguiar FROM professionals
  WHERE organization_id = v_org_id AND full_name = 'Dra. Déborah Aguiar';
END IF;

INSERT INTO professionals (
  organization_id, full_name, specialty, bio, active
) VALUES (
  v_org_id,
  'Dra. Médica Asociada',
  'Dermatología Clínica',
  'Dermatóloga clínica del equipo DA.',
  true
)
ON CONFLICT DO NOTHING
RETURNING id INTO v_dra_colab;

IF v_dra_colab IS NULL THEN
  SELECT id INTO v_dra_colab FROM professionals
  WHERE organization_id = v_org_id AND full_name = 'Dra. Médica Asociada';
END IF;

-- ── 3. Servicios reales del consultorio ──────────────────────
INSERT INTO services (
  organization_id, name, duration_minutes, color, description, active
) VALUES
  (v_org_id, 'Consulta dermatológica',        30, '#9E7560', 'Primera consulta o revisión dermatológica general',                                    true),
  (v_org_id, 'Control de tratamiento',         20, '#B8946A', 'Seguimiento de tratamiento en curso',                                                  true),
  (v_org_id, 'Toxina botulínica (Botox)',      45, '#C4A882', 'Tratamiento de arrugas dinámicas con toxina botulínica',                               true),
  (v_org_id, 'Relleno de ácido hialurónico',  45, '#D4B896', 'Restauración de volumen y contorno facial con HA',                                     true),
  (v_org_id, 'Láser Candela',                 60, '#7C6B5A', 'Tratamiento con tecnología Candela: manchas, vascular, rejuvenecimiento',               true),
  (v_org_id, 'Bioestimulación',               60, '#8A7A6A', 'Estimulación del colágeno con biostimuladores (Sculptra, Radiesse)',                    true),
  (v_org_id, 'F-Cells',                       60, '#6B5A4A', 'Terapia regenerativa con células adiposas y factores de crecimiento',                   true),
  (v_org_id, 'Tratamiento de nariz',          45, '#9E8070', 'Rinoplastia médica no quirúrgica con rellenos',                                         true),
  (v_org_id, 'Peeling químico',               45, '#B09080', 'Renovación celular con ácidos de grado médico',                                         true),
  (v_org_id, 'Consulta online',               20, '#C4A882', 'Videoconsulta dermatológica por plataforma digital',                                    true)
ON CONFLICT DO NOTHING;

-- ── 4. Agenda: Lun–Vie 09:00–18:00, Sab 09:00–13:00 ─────────
FOREACH d IN ARRAY ARRAY[1,2,3,4,5] LOOP
  INSERT INTO schedules (
    professional_id, day_of_week, start_time, end_time, interval_minutes, active
  ) VALUES
    (v_dra_aguiar, d, '09:00', '18:00', 30, true),
    (v_dra_colab,  d, '09:00', '17:00', 30, true)
  ON CONFLICT DO NOTHING;
END LOOP;

-- Dra. Aguiar atiende también sábados
INSERT INTO schedules (
  professional_id, day_of_week, start_time, end_time, interval_minutes, active
) VALUES (v_dra_aguiar, 6, '09:00', '13:00', 30, true)
ON CONFLICT DO NOTHING;

RAISE NOTICE 'Tenant DA Dermatología Estética y LASER creado — id: %', v_org_id;

END $$;
