-- Migración 039: corregir reservar_turno para detectar solapamiento por duración
-- Antes: solo chequeaba starts_at exacto
-- Ahora: verifica que [p_starts_at, p_starts_at+duration) no se superponga con ningún turno existente

CREATE OR REPLACE FUNCTION reservar_turno(
  p_professional_id UUID,
  p_service_id      UUID,
  p_starts_at       TIMESTAMPTZ,
  p_patient_name    TEXT,
  p_patient_phone   TEXT,
  p_patient_email   TEXT    DEFAULT NULL,
  p_patient_notes   TEXT    DEFAULT NULL,
  p_patient_obra_social TEXT DEFAULT NULL,
  p_patient_nro_socio   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id        UUID;
  v_loc_id        UUID;
  v_service       RECORD;
  v_ends_at       TIMESTAMPTZ;
  v_patient_id    UUID;
  v_appointment_id UUID;
  v_status        appointment_status;
BEGIN
  -- ── 1. Obtener organización y location del profesional ───────────────
  SELECT p.organization_id, p.location_id
    INTO v_org_id, v_loc_id
    FROM professionals p
   WHERE p.id = p_professional_id AND p.active = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'professional_not_found');
  END IF;

  -- ── 2. Obtener servicio ──────────────────────────────────────────────
  SELECT * INTO v_service
    FROM services
   WHERE id = p_service_id AND active = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'service_not_found');
  END IF;

  v_ends_at := p_starts_at + (v_service.duration_minutes || ' minutes')::INTERVAL;

  -- ── 3. Advisory lock: serializa reservas del mismo profesional+slot ──
  PERFORM pg_advisory_xact_lock(
    hashtext(p_professional_id::TEXT || p_starts_at::TEXT)
  );

  -- ── 4. Verificar solapamiento: ningún turno existente puede superponerse
  --       con el rango [p_starts_at, v_ends_at)
  IF EXISTS (
    SELECT 1
      FROM appointments
     WHERE professional_id = p_professional_id
       AND status NOT IN ('cancelado')
       AND starts_at < v_ends_at      -- el existente empieza antes de que termine el nuevo
       AND ends_at   > p_starts_at    -- el existente termina después de que empiece el nuevo
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

GRANT EXECUTE ON FUNCTION reservar_turno TO anon, authenticated;
