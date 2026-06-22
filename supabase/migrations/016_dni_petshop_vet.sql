-- ============================================================
-- Migración 016: DNI único + tenant types petshop/veterinary + demo data
-- ============================================================

-- 1. Agregar petshop y veterinary al CHECK de organizations
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_tenant_type_check;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_tenant_type_check
  CHECK (tenant_type IN ('medical', 'beauty', 'general', 'petshop', 'veterinary'));

-- 2. UNIQUE(dni, organization_id) — NULLs se tratan como distintos en Postgres
--    así que dos pacientes sin DNI en la misma org no entran en conflicto
CREATE UNIQUE INDEX IF NOT EXISTS patients_dni_org_unique
  ON patients (organization_id, dni)
  WHERE dni IS NOT NULL;

-- 3. Actualizar RPC reservar_turno para aceptar DNI y buscar por él
CREATE OR REPLACE FUNCTION reservar_turno(
  p_professional_id     UUID,
  p_service_id          UUID,
  p_starts_at           TIMESTAMPTZ,
  p_patient_name        TEXT,
  p_patient_phone       TEXT,
  p_patient_email       TEXT    DEFAULT NULL,
  p_patient_dni         TEXT    DEFAULT NULL,
  p_patient_obra_social TEXT    DEFAULT NULL,
  p_patient_nro_socio   TEXT    DEFAULT NULL,
  p_patient_notes       TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service            services%ROWTYPE;
  v_ends_at            TIMESTAMPTZ;
  v_org_id             UUID;
  v_loc_id             UUID;
  v_patient_id         UUID;
  v_appointment_id     UUID;
  v_status             appointment_status;
  v_cancellation_token UUID;
BEGIN

  SELECT organization_id, location_id
    INTO v_org_id, v_loc_id
    FROM professionals
   WHERE id = p_professional_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'professional_not_found');
  END IF;

  SELECT * INTO v_service
    FROM services
   WHERE id = p_service_id AND active = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'service_not_found');
  END IF;

  v_ends_at := p_starts_at + (v_service.duration_minutes || ' minutes')::INTERVAL;

  -- Anti doble-reserva
  PERFORM pg_advisory_xact_lock(
    hashtext(p_professional_id::TEXT || p_starts_at::TEXT)
  );

  IF EXISTS (
    SELECT 1
      FROM appointments
     WHERE professional_id = p_professional_id
       AND starts_at        = p_starts_at
       AND status NOT IN ('cancelado')
     FOR UPDATE
  ) THEN
    RETURN jsonb_build_object('error', 'slot_taken');
  END IF;

  -- Buscar paciente: primero por DNI (más confiable), luego por teléfono
  IF p_patient_dni IS NOT NULL AND p_patient_dni != '' THEN
    SELECT id INTO v_patient_id
      FROM patients
     WHERE organization_id = v_org_id
       AND dni              = p_patient_dni
     LIMIT 1;
  END IF;

  IF v_patient_id IS NULL THEN
    SELECT id INTO v_patient_id
      FROM patients
     WHERE organization_id = v_org_id
       AND phone            = p_patient_phone
     LIMIT 1;
  END IF;

  IF v_patient_id IS NOT NULL THEN
    UPDATE patients SET
      full_name   = p_patient_name,
      phone       = COALESCE(NULLIF(p_patient_phone, ''),       phone),
      dni         = COALESCE(NULLIF(p_patient_dni, ''),         dni),
      email       = COALESCE(NULLIF(p_patient_email, ''),       email),
      obra_social = COALESCE(NULLIF(p_patient_obra_social, ''), obra_social),
      nro_socio   = COALESCE(NULLIF(p_patient_nro_socio, ''),   nro_socio),
      notes       = COALESCE(NULLIF(p_patient_notes, ''),       notes),
      updated_at  = NOW()
    WHERE id = v_patient_id;
  ELSE
    INSERT INTO patients (
      organization_id, full_name, phone, email, dni,
      obra_social, nro_socio, notes
    ) VALUES (
      v_org_id, p_patient_name, p_patient_phone, NULLIF(p_patient_email, ''),
      NULLIF(p_patient_dni, ''),
      NULLIF(p_patient_obra_social, ''), NULLIF(p_patient_nro_socio, ''),
      NULLIF(p_patient_notes, '')
    )
    RETURNING id INTO v_patient_id;
  END IF;

  v_status := CASE
    WHEN p_patient_obra_social IS NOT NULL AND p_patient_obra_social != ''
    THEN 'pendiente'::appointment_status
    ELSE 'confirmado'::appointment_status
  END;

  v_cancellation_token := gen_random_uuid();

  INSERT INTO appointments (
    organization_id, location_id,
    professional_id, service_id, patient_id,
    starts_at, ends_at, status,
    patient_name, patient_phone, patient_email,
    cancellation_token
  ) VALUES (
    v_org_id, v_loc_id,
    p_professional_id, p_service_id, v_patient_id,
    p_starts_at, v_ends_at, v_status,
    p_patient_name,
    NULLIF(p_patient_phone, ''),
    NULLIF(p_patient_email, ''),
    v_cancellation_token
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'id',                 v_appointment_id,
    'status',             v_status,
    'cancellation_token', v_cancellation_token
  );

END;
$$;

GRANT EXECUTE ON FUNCTION reservar_turno TO anon, authenticated;

-- ============================================================
-- 4. Demo tenant: Petshop
-- ============================================================
INSERT INTO organizations (id, name, slug, timezone, active, feature_mp, feature_hc, tenant_type)
VALUES (
  'c6000000-0000-0000-0000-000000000001',
  'Pelukitas Pet Shop',
  'pelukitas',
  'America/Argentina/Buenos_Aires',
  true, false, false, 'petshop'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO professionals (id, organization_id, full_name, specialty, active)
VALUES (
  'c6000000-0000-0000-0000-000000000011',
  'c6000000-0000-0000-0000-000000000001',
  'Lucia Pereyra',
  'Groomers',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, organization_id, name, duration_minutes, price, color, active, category)
VALUES
  ('c6000000-0000-0000-0001-000000000001', 'c6000000-0000-0000-0000-000000000001', 'Bano y secado - Pequeno',  60,  8000, '#f0abfc', true, NULL),
  ('c6000000-0000-0000-0001-000000000002', 'c6000000-0000-0000-0000-000000000001', 'Bano y secado - Mediano',  90, 12000, '#e879f9', true, NULL),
  ('c6000000-0000-0000-0001-000000000003', 'c6000000-0000-0000-0000-000000000001', 'Bano y secado - Grande',  120, 16000, '#d946ef', true, NULL),
  ('c6000000-0000-0000-0001-000000000004', 'c6000000-0000-0000-0000-000000000001', 'Corte de pelo',            60, 10000, '#c026d3', true, NULL),
  ('c6000000-0000-0000-0001-000000000005', 'c6000000-0000-0000-0000-000000000001', 'Corte de uas',             20,  3000, '#a21caf', true, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO professional_services (professional_id, service_id) VALUES
  ('c6000000-0000-0000-0000-000000000011', 'c6000000-0000-0000-0001-000000000001'),
  ('c6000000-0000-0000-0000-000000000011', 'c6000000-0000-0000-0001-000000000002'),
  ('c6000000-0000-0000-0000-000000000011', 'c6000000-0000-0000-0001-000000000003'),
  ('c6000000-0000-0000-0000-000000000011', 'c6000000-0000-0000-0001-000000000004'),
  ('c6000000-0000-0000-0000-000000000011', 'c6000000-0000-0000-0001-000000000005')
ON CONFLICT DO NOTHING;

INSERT INTO schedules (professional_id, day_of_week, start_time, end_time, interval_minutes, active)
SELECT 'c6000000-0000-0000-0000-000000000011'::uuid, day, '09:00', '18:00', 60, true
FROM generate_series(1, 6) AS day
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. Demo tenant: Veterinaria
-- ============================================================
INSERT INTO organizations (id, name, slug, timezone, active, feature_mp, feature_hc, tenant_type)
VALUES (
  'c7000000-0000-0000-0000-000000000001',
  'Veterinaria San Roque',
  'san-roque-vet',
  'America/Argentina/Buenos_Aires',
  true, false, true, 'veterinary'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO professionals (id, organization_id, full_name, specialty, active)
VALUES (
  'c7000000-0000-0000-0000-000000000011',
  'c7000000-0000-0000-0000-000000000001',
  'Dr. Marcos Gutierrez',
  'Veterinaria General',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, organization_id, name, duration_minutes, price, color, active, category)
VALUES
  ('c7000000-0000-0000-0001-000000000001', 'c7000000-0000-0000-0000-000000000001', 'Consulta general',     30,  8000, '#34d399', true, NULL),
  ('c7000000-0000-0000-0001-000000000002', 'c7000000-0000-0000-0000-000000000001', 'Vacunacion',           20,  6000, '#10b981', true, NULL),
  ('c7000000-0000-0000-0001-000000000003', 'c7000000-0000-0000-0000-000000000001', 'Desparasitacion',      20,  5000, '#059669', true, NULL),
  ('c7000000-0000-0000-0001-000000000004', 'c7000000-0000-0000-0000-000000000001', 'Control post-operatorio', 30, 7000, '#047857', true, NULL),
  ('c7000000-0000-0000-0001-000000000005', 'c7000000-0000-0000-0000-000000000001', 'Urgencia',             45, 15000, '#065f46', true, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO professional_services (professional_id, service_id) VALUES
  ('c7000000-0000-0000-0000-000000000011', 'c7000000-0000-0000-0001-000000000001'),
  ('c7000000-0000-0000-0000-000000000011', 'c7000000-0000-0000-0001-000000000002'),
  ('c7000000-0000-0000-0000-000000000011', 'c7000000-0000-0000-0001-000000000003'),
  ('c7000000-0000-0000-0000-000000000011', 'c7000000-0000-0000-0001-000000000004'),
  ('c7000000-0000-0000-0000-000000000011', 'c7000000-0000-0000-0001-000000000005')
ON CONFLICT DO NOTHING;

INSERT INTO schedules (professional_id, day_of_week, start_time, end_time, interval_minutes, active)
SELECT 'c7000000-0000-0000-0000-000000000011'::uuid, day, '09:00', '19:00', 30, true
FROM generate_series(1, 6) AS day
ON CONFLICT DO NOTHING;
