-- ============================================================
-- Migración 036: tenant limpio para Dra. Déborah Aguiar
-- Borra da-derm + aguiar-derm (si existen) y crea dra-aguiar
-- ============================================================

-- ── 1. Borrar tenants anteriores (cascade) ──────────────────
DO $$
DECLARE v_id UUID;
BEGIN
  FOR v_id IN SELECT id FROM organizations WHERE slug IN ('da-derm', 'aguiar-derm') LOOP
    DELETE FROM appointments        WHERE organization_id = v_id;
    DELETE FROM availability_blocks WHERE professional_id IN (SELECT id FROM professionals WHERE organization_id = v_id);
    DELETE FROM schedules           WHERE professional_id IN (SELECT id FROM professionals WHERE organization_id = v_id);
    DELETE FROM professional_services WHERE professional_id IN (SELECT id FROM professionals WHERE organization_id = v_id);
    DELETE FROM professionals       WHERE organization_id = v_id;
    DELETE FROM services            WHERE organization_id = v_id;
    DELETE FROM organizations       WHERE id = v_id;
  END LOOP;
END $$;

-- ── 2. Crear organización ────────────────────────────────────
DO $$
DECLARE
  v_org     UUID;
  v_aguiar  UUID;
  v_herrero UUID;
  d         INT;
BEGIN

INSERT INTO organizations (
  name, slug, tenant_type, primary_color,
  address, phone, email, whatsapp_number, instagram_handle, active
) VALUES (
  'DA Dermatología Estética y LASER',
  'dra-aguiar',
  'estetica',
  '#9E7560',
  'Av. Cabildo 3073, Núñez, CABA 1429',
  '11-0000-0000',
  'turno@daderm.com.ar',
  '5492615781357',
  'dra.debaguiar',
  true
) RETURNING id INTO v_org;

-- ── 3. Profesionales ────────────────────────────────────────
INSERT INTO professionals (organization_id, full_name, specialty, bio, active)
VALUES (v_org, 'Dra. Déborah Aguiar',
  'Dermatología Estética y Láser',
  'Directora Médica. Especialista en láser Candela, toxina botulínica, rellenos y bioestimulación. MN 154557.',
  true)
RETURNING id INTO v_aguiar;

INSERT INTO professionals (organization_id, full_name, specialty, bio, active)
VALUES (v_org, 'Dra. Valentina Herrero',
  'Dermatología Clínica',
  'Dermatóloga clínica del equipo DA. Especialista en dermatología general, acné, psoriasis y control de nevos. MN 171834.',
  true)
RETURNING id INTO v_herrero;

-- ── 4. Servicios ─────────────────────────────────────────────
INSERT INTO services (organization_id, name, duration_minutes, color, description, active) VALUES
  (v_org, 'Consulta dermatológica',       30, '#9E7560', 'Primera consulta o revisión dermatológica general', true),
  (v_org, 'Control de tratamiento',        20, '#B8946A', 'Seguimiento de tratamiento en curso', true),
  (v_org, 'Toxina botulínica (Botox)',     45, '#C4A882', 'Tratamiento de arrugas dinámicas con toxina botulínica', true),
  (v_org, 'Relleno de ácido hialurónico', 45, '#D4B896', 'Restauración de volumen y contorno facial con HA', true),
  (v_org, 'Láser Candela',                60, '#7C6B5A', 'Manchas, vascular y rejuvenecimiento con tecnología Candela', true),
  (v_org, 'Bioestimulación',              60, '#8A7A6A', 'Estimulación del colágeno con Sculptra o Radiesse', true),
  (v_org, 'F-Cells',                      60, '#6B5A4A', 'Terapia regenerativa con factores de crecimiento', true),
  (v_org, 'Rinoplastia médica',           45, '#9E8070', 'Remodelado de nariz sin cirugía con rellenos', true),
  (v_org, 'Peeling químico',              45, '#B09080', 'Renovación celular con ácidos de grado médico', true),
  (v_org, 'Consulta online',              20, '#C4A882', 'Videoconsulta dermatológica por plataforma digital', true);

-- ── 5. Vincular profesionales con servicios ──────────────────
-- Dra. Aguiar: todos los servicios
INSERT INTO professional_services (professional_id, service_id)
SELECT v_aguiar, id FROM services WHERE organization_id = v_org;

-- Dra. Herrero: consulta, control y peeling
INSERT INTO professional_services (professional_id, service_id)
SELECT v_herrero, id FROM services
WHERE organization_id = v_org
  AND name IN ('Consulta dermatológica', 'Control de tratamiento', 'Peeling químico');

-- ── 6. Agenda ────────────────────────────────────────────────
-- Lun-Vie ambas, Sab solo Dra. Aguiar
FOREACH d IN ARRAY ARRAY[1,2,3,4,5] LOOP
  INSERT INTO schedules (professional_id, day_of_week, start_time, end_time, interval_minutes, active) VALUES
    (v_aguiar,  d, '09:00', '18:00', 30, true),
    (v_herrero, d, '09:00', '17:00', 30, true);
END LOOP;

INSERT INTO schedules (professional_id, day_of_week, start_time, end_time, interval_minutes, active)
VALUES (v_aguiar, 6, '09:00', '13:00', 30, true);

RAISE NOTICE 'Tenant dra-aguiar creado — org_id: %', v_org;
END $$;
