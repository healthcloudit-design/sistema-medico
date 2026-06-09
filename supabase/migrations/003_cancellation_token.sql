-- ============================================================
-- MIGRACIÓN 003 — Token de cancelación + recordatorios
-- ============================================================

-- 1. Agregar cancellation_token a appointments
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS cancellation_token UUID UNIQUE DEFAULT gen_random_uuid();

-- Generar tokens para turnos existentes que no tengan
UPDATE appointments
  SET cancellation_token = gen_random_uuid()
  WHERE cancellation_token IS NULL;

-- 2. Índice para buscar por token (cancelación pública)
CREATE INDEX IF NOT EXISTS idx_appointments_cancellation_token
  ON appointments(cancellation_token);

-- 3. Política RLS: cualquiera puede leer un turno por su token
CREATE POLICY "cancelacion_publica_select" ON appointments
  FOR SELECT USING (cancellation_token IS NOT NULL);

-- 4. Política RLS: cancelación pública por token
CREATE POLICY "cancelacion_publica_update" ON appointments
  FOR UPDATE USING (cancellation_token IS NOT NULL)
  WITH CHECK (status = 'cancelado');

-- 5. Actualizar RPC reservar_turno para devolver cancellation_token
CREATE OR REPLACE FUNCTION reservar_turno(
  p_professional_id     UUID,
  p_service_id          UUID,
  p_starts_at           TIMESTAMPTZ,
  p_patient_name        TEXT,
  p_patient_phone       TEXT,
  p_patient_email       TEXT    DEFAULT NULL,
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
