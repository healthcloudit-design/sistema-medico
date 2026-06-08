-- ============================================================
-- MIGRACIÓN 002 — Columnas faltantes + RPC anti-doble-reserva
-- ============================================================

-- 1. Agregar interval_minutes a schedules
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS interval_minutes INTEGER NOT NULL DEFAULT 30
    CHECK (interval_minutes >= 5);

-- 2. Extender patients con datos de cobertura médica
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS obra_social TEXT,
  ADD COLUMN IF NOT EXISTS nro_socio   TEXT;

-- ============================================================
-- RPC: reservar_turno
-- Reserva atómica con protección contra doble-booking.
-- Estrategia: advisory lock por (professional_id, starts_at) +
-- constraint UNIQUE implícito via verificación FOR UPDATE.
-- ============================================================
CREATE OR REPLACE FUNCTION reservar_turno(
  p_professional_id   UUID,
  p_service_id        UUID,
  p_starts_at         TIMESTAMPTZ,
  p_patient_name      TEXT,
  p_patient_phone     TEXT,
  p_patient_email     TEXT    DEFAULT NULL,
  p_patient_obra_social TEXT  DEFAULT NULL,
  p_patient_nro_socio   TEXT  DEFAULT NULL,
  p_patient_notes     TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service        services%ROWTYPE;
  v_ends_at        TIMESTAMPTZ;
  v_org_id         UUID;
  v_loc_id         UUID;
  v_patient_id     UUID;
  v_appointment_id UUID;
  v_status         appointment_status;
BEGIN

  -- ── 1. Obtener profesional (org + location para FK) ──────────────────
  SELECT organization_id, location_id
    INTO v_org_id, v_loc_id
    FROM professionals
   WHERE id = p_professional_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'professional_not_found');
  END IF;

  -- ── 2. Obtener servicio y calcular ends_at ───────────────────────────
  SELECT * INTO v_service
    FROM services
   WHERE id = p_service_id AND active = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'service_not_found');
  END IF;

  v_ends_at := p_starts_at + (v_service.duration_minutes || ' minutes')::INTERVAL;

  -- ── 3. Advisory lock: serializa reservas del mismo slot ─────────────
  -- hashtext genera un INT4 determinístico; si dos sesiones llaman con
  -- el mismo profesional + horario, una espera a que la otra confirme.
  PERFORM pg_advisory_xact_lock(
    hashtext(p_professional_id::TEXT || p_starts_at::TEXT)
  );

  -- ── 4. Verificar que el slot aún esté libre ──────────────────────────
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

  -- ── 5. Upsert paciente por teléfono ──────────────────────────────────
  SELECT id INTO v_patient_id
    FROM patients
   WHERE organization_id = v_org_id
     AND phone           = p_patient_phone
   LIMIT 1;

  IF FOUND THEN
    UPDATE patients SET
      full_name   = p_patient_name,
      email       = COALESCE(NULLIF(p_patient_email, ''),       email),
      obra_social = COALESCE(NULLIF(p_patient_obra_social, ''), obra_social),
      nro_socio   = COALESCE(NULLIF(p_patient_nro_socio, ''),   nro_socio),
      notes       = COALESCE(NULLIF(p_patient_notes, ''),       notes),
      updated_at  = NOW()
    WHERE id = v_patient_id;
  ELSE
    INSERT INTO patients (
      organization_id, full_name, phone, email,
      obra_social, nro_socio, notes
    ) VALUES (
      v_org_id, p_patient_name, p_patient_phone, NULLIF(p_patient_email, ''),
      NULLIF(p_patient_obra_social, ''), NULLIF(p_patient_nro_socio, ''),
      NULLIF(p_patient_notes, '')
    )
    RETURNING id INTO v_patient_id;
  END IF;

  -- ── 6. Determinar estado del turno ───────────────────────────────────
  -- Si tiene obra social → pendiente de verificación de cobertura
  v_status := CASE
    WHEN p_patient_obra_social IS NOT NULL AND p_patient_obra_social != ''
    THEN 'pendiente'::appointment_status
    ELSE 'confirmado'::appointment_status
  END;

  -- ── 7. Insertar turno ────────────────────────────────────────────────
  INSERT INTO appointments (
    organization_id, location_id,
    professional_id, service_id, patient_id,
    starts_at, ends_at, status,
    patient_name, patient_phone, patient_email
  ) VALUES (
    v_org_id, v_loc_id,
    p_professional_id, p_service_id, v_patient_id,
    p_starts_at, v_ends_at, v_status,
    p_patient_name,
    NULLIF(p_patient_phone, ''),
    NULLIF(p_patient_email, '')
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'id',     v_appointment_id,
    'status', v_status
  );

END;
$$;

-- Permisos: la función corre como definer, el anon key puede invocarla
GRANT EXECUTE ON FUNCTION reservar_turno TO anon, authenticated;

-- ============================================================
-- Índice adicional para la verificación de disponibilidad
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_appointments_professional_starts_status
  ON appointments(professional_id, starts_at)
  WHERE status != 'cancelado';
