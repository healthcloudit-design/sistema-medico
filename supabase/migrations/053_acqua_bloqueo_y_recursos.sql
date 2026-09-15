-- 053_acqua_bloqueo_y_recursos.sql
-- Acqua (y modelo general): separar el tiempo que BLOQUEA el calendario del que
-- se MUESTRA en la web, y agrupar servicios por "recurso" (persona) para el cupo
-- de solapamiento. Cambio ADITIVO y OPT-IN:
--   * block_duration_minutes NULL  -> se usa la lógica actual GREATEST(dur, display)
--   * resource_group        NULL  -> se usa el cupo clásico por profesional
-- Por lo tanto NO afecta a otros tenants (San Fernando / Tigre / médicos).

-- ─────────────────────────────────────────────────────────────
-- 1) Columnas nuevas
-- ─────────────────────────────────────────────────────────────
alter table public.services add column if not exists block_duration_minutes integer;
alter table public.services add column if not exists resource_group text;

comment on column public.services.block_duration_minutes is
  'Minutos que el servicio BLOQUEA en el calendario/cupo (define ends_at). NULL => GREATEST(duration_minutes, display_duration_minutes).';
comment on column public.services.resource_group is
  'Grupo de recurso (persona) para el cupo de solapamiento dentro de un profesional. Servicios del mismo grupo comparten cupo (services.capacity). NULL => lógica clásica por profesional.';

-- ─────────────────────────────────────────────────────────────
-- 2) Datos de Alejandra Acqua (org 302fd304-98cb-4611-b510-63c8a95047b0)
--    display_duration_minutes = lo que se MUESTRA en la web
--    block_duration_minutes   = lo que BLOQUEA el calendario
--    capacity                 = cupo del grupo de recurso
--    Grupo "ale"   (cupo 1): corte y variantes, reflejos, decoloración, alisado
--    Grupo "color" (cupo 2): color
-- ─────────────────────────────────────────────────────────────
do $mig$
declare v_org uuid := '302fd304-98cb-4611-b510-63c8a95047b0';
begin
  -- Grupo ale (cupo 1) — cortes: bloquean 30, muestran lo que ya muestran
  update public.services
     set resource_group='ale', capacity=1, block_duration_minutes=30
   where organization_id=v_org
     and name in ('Corte','Corte con lavado','Corte con lavado largo','Corte niño / hombre');

  -- Grupo ale — reflejos: mostrar 240, bloquear 90
  update public.services
     set resource_group='ale', capacity=1, block_duration_minutes=90, display_duration_minutes=240
   where organization_id=v_org
     and name in ('Reflejos con gorra','Reflejos con banda');

  -- Grupo ale — decoloración: mostrar 120, bloquear 90
  update public.services
     set resource_group='ale', capacity=1, block_duration_minutes=90, display_duration_minutes=120
   where organization_id=v_org and name='Decoloración';

  -- Grupo ale — alisado: mostrar 240, bloquear 90
  update public.services
     set resource_group='ale', capacity=1, block_duration_minutes=90, display_duration_minutes=240
   where organization_id=v_org and name='Alisados';

  -- Grupo color (cupo 2): mostrar 120, bloquear 60
  update public.services
     set resource_group='color', capacity=2, block_duration_minutes=60, display_duration_minutes=120
   where organization_id=v_org and name='Color';
end $mig$;

-- ─────────────────────────────────────────────────────────────
-- 3) reservar_turno: ends_at por block_duration_minutes + cupo por recurso
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reservar_turno(p_professional_id uuid, p_service_id uuid, p_starts_at timestamp with time zone, p_patient_name text, p_patient_phone text, p_patient_email text DEFAULT NULL::text, p_patient_dni text DEFAULT NULL::text, p_patient_obra_social text DEFAULT NULL::text, p_patient_nro_socio text DEFAULT NULL::text, p_patient_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_service                services%ROWTYPE;
  v_ends_at                TIMESTAMPTZ;
  v_block_minutes          integer;
  v_org_id                 UUID;
  v_loc_id                 UUID;
  v_patient_id             UUID;
  v_appointment_id         UUID;
  v_status                 appointment_status;
  v_cancellation_token     UUID;
  v_would_exceed           boolean;
  v_waitlist_count         integer;
  v_prof_capacity          integer;
  v_prof_would_exceed      boolean;
  v_attention_would_exceed boolean;
  v_group_would_exceed     boolean;
BEGIN

  SELECT organization_id, location_id, concurrent_capacity
    INTO v_org_id, v_loc_id, v_prof_capacity
    FROM professionals
   WHERE id = p_professional_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'professional_not_found');
  END IF;

  v_prof_capacity := COALESCE(v_prof_capacity, 1);

  SELECT * INTO v_service
    FROM services
   WHERE id = p_service_id AND active = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'service_not_found');
  END IF;

  -- Ventana REAL de bloqueo (cupo/agenda).
  v_block_minutes := COALESCE(
    v_service.block_duration_minutes,
    GREATEST(v_service.duration_minutes, COALESCE(v_service.display_duration_minutes, v_service.duration_minutes))
  );
  v_ends_at := p_starts_at + (v_block_minutes || ' minutes')::INTERVAL;

  -- Bloqueos de disponibilidad (día completo o franja) cargados por el profesional/admin.
  IF EXISTS (
    SELECT 1
      FROM availability_blocks b
     WHERE b.professional_id = p_professional_id
       AND (
         (b.blocked_date IS NOT NULL
          AND b.blocked_date = (p_starts_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)
         OR
         (b.blocked_start IS NOT NULL AND b.blocked_end IS NOT NULL
          AND b.blocked_start < b.blocked_end
          AND b.blocked_start < v_ends_at AND b.blocked_end > p_starts_at)
       )
  ) THEN
    RETURN jsonb_build_object('error', 'professional_unavailable');
  END IF;

  -- Reglas de bloqueo cruzado entre servicios (service_block_rules).
  IF EXISTS (
    SELECT 1
      FROM appointments a
      JOIN service_block_rules r
        ON r.organization_id    = v_org_id
       AND r.trigger_service_id = a.service_id
       AND r.blocked_service_id = p_service_id
     WHERE a.professional_id = p_professional_id
       AND a.status NOT IN ('cancelado')
       AND a.starts_at < v_ends_at
       AND (a.starts_at + (r.block_minutes || ' minutes')::interval) > p_starts_at
  ) THEN
    RETURN jsonb_build_object('error', 'service_conflict');
  END IF;

  IF v_service.resource_group IS NOT NULL THEN
    -- ── Cupo por RECURSO (grupo de persona) ──
    -- Choca solo con servicios del MISMO grupo bajo el MISMO profesional.
    -- Grupos distintos nunca chocan. El cupo del grupo = v_service.capacity.
    PERFORM pg_advisory_xact_lock(
      hashtext(p_professional_id::TEXT || v_service.resource_group || 'grp')
    );

    SELECT EXISTS (
      SELECT 1
        FROM (
          SELECT p_starts_at AS t
          UNION
          SELECT GREATEST(a.starts_at, p_starts_at) AS t
            FROM appointments a
            JOIN services s ON s.id = a.service_id
           WHERE a.professional_id = p_professional_id
             AND a.status NOT IN ('cancelado', 'lista_espera')
             AND s.resource_group = v_service.resource_group
             AND a.starts_at < v_ends_at
             AND a.ends_at   > p_starts_at
        ) pts
       WHERE (
         SELECT count(*)
           FROM appointments a2
           JOIN services s2 ON s2.id = a2.service_id
          WHERE a2.professional_id = p_professional_id
            AND a2.status NOT IN ('cancelado', 'lista_espera')
            AND s2.resource_group = v_service.resource_group
            AND a2.starts_at <= pts.t
            AND a2.ends_at   >  pts.t
       ) + 1 > v_service.capacity
    ) INTO v_group_would_exceed;

    IF v_group_would_exceed THEN
      RETURN jsonb_build_object('error', 'slot_taken');
    END IF;

  ELSE
    -- ── Lógica clásica por profesional (sin cambios) ──
    IF v_prof_capacity > 1 THEN
      PERFORM pg_advisory_xact_lock(
        hashtext(p_professional_id::TEXT || 'prof_capacity')
      );

      SELECT EXISTS (
        SELECT 1
          FROM (
            SELECT p_starts_at AS t
            UNION
            SELECT GREATEST(a.starts_at, p_starts_at) AS t
              FROM appointments a
             WHERE a.professional_id = p_professional_id
               AND a.status NOT IN ('cancelado', 'lista_espera')
               AND a.starts_at < v_ends_at
               AND a.ends_at   > p_starts_at
          ) pts
         WHERE (
           SELECT count(*)
             FROM appointments a2
            WHERE a2.professional_id = p_professional_id
              AND a2.status NOT IN ('cancelado', 'lista_espera')
              AND a2.starts_at <= pts.t
              AND a2.ends_at   >  pts.t
         ) + 1 > v_prof_capacity
      ) INTO v_prof_would_exceed;

      IF v_prof_would_exceed THEN
        RETURN jsonb_build_object('error', 'slot_taken');
      END IF;

      IF v_service.requiere_atencion_completa THEN
        SELECT EXISTS (
          SELECT 1
            FROM (
              SELECT p_starts_at AS t
              UNION
              SELECT GREATEST(a.starts_at, p_starts_at) AS t
                FROM appointments a
                JOIN services s2 ON s2.id = a.service_id
               WHERE a.professional_id = p_professional_id
                 AND a.status NOT IN ('cancelado', 'lista_espera')
                 AND s2.requiere_atencion_completa = TRUE
                 AND a.starts_at < v_ends_at
                 AND a.ends_at   > p_starts_at
            ) pts
           WHERE (
             SELECT count(*)
               FROM appointments a2
               JOIN services s3 ON s3.id = a2.service_id
              WHERE a2.professional_id = p_professional_id
                AND a2.status NOT IN ('cancelado', 'lista_espera')
                AND s3.requiere_atencion_completa = TRUE
                AND a2.starts_at <= pts.t
                AND a2.ends_at   >  pts.t
           ) + 1 > 1
        ) INTO v_attention_would_exceed;

        IF v_attention_would_exceed THEN
          RETURN jsonb_build_object('error', 'slot_taken');
        END IF;
      END IF;
    END IF;

    IF v_service.capacity <= 1 THEN
      IF v_prof_capacity <= 1 THEN
        PERFORM pg_advisory_xact_lock(
          hashtext(p_professional_id::TEXT || 'slot')
        );

        IF EXISTS (
          SELECT 1
            FROM appointments
           WHERE professional_id = p_professional_id
             AND status NOT IN ('cancelado')
             AND starts_at < v_ends_at
             AND ends_at   > p_starts_at
           FOR UPDATE
        ) THEN
          RETURN jsonb_build_object('error', 'slot_taken');
        END IF;
      END IF;

    ELSE
      PERFORM pg_advisory_xact_lock(
        hashtext(p_professional_id::TEXT || p_service_id::TEXT || 'capacity')
      );

      SELECT EXISTS (
        SELECT 1
          FROM (
            SELECT p_starts_at AS t
            UNION
            SELECT GREATEST(a.starts_at, p_starts_at) AS t
              FROM appointments a
             WHERE a.professional_id = p_professional_id
               AND a.service_id      = p_service_id
               AND a.status NOT IN ('cancelado', 'lista_espera')
               AND a.starts_at < v_ends_at
               AND a.ends_at   > p_starts_at
          ) pts
         WHERE (
           SELECT count(*)
             FROM appointments a2
            WHERE a2.professional_id = p_professional_id
              AND a2.service_id      = p_service_id
              AND a2.status NOT IN ('cancelado', 'lista_espera')
              AND a2.starts_at <= pts.t
              AND a2.ends_at   >  pts.t
         ) + 1 > v_service.capacity
      ) INTO v_would_exceed;

      IF v_would_exceed THEN
        SELECT count(*) INTO v_waitlist_count
          FROM appointments
         WHERE professional_id = p_professional_id
           AND service_id       = p_service_id
           AND status            = 'lista_espera'
           AND starts_at         < v_ends_at
           AND ends_at           > p_starts_at;

        IF v_waitlist_count >= v_service.waitlist_limit THEN
          RETURN jsonb_build_object('error', 'cupo_completo');
        END IF;
      END IF;
    END IF;
  END IF;

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

  -- Lista de espera solo aplica al camino clásico por capacidad de servicio.
  IF v_service.resource_group IS NULL AND v_service.capacity > 1 AND v_would_exceed THEN
    v_status := 'lista_espera'::appointment_status;
  ELSE
    v_status := CASE
      WHEN p_patient_obra_social IS NOT NULL AND p_patient_obra_social != ''
      THEN 'pendiente'::appointment_status
      ELSE 'confirmado'::appointment_status
    END;
  END IF;

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
$function$;

-- ─────────────────────────────────────────────────────────────
-- 4) reprogramar_turno: mismo criterio (block_duration_minutes + cupo por recurso)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reprogramar_turno(p_appointment_id uuid, p_starts_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_appt    appointments%ROWTYPE;
  v_service services%ROWTYPE;
  v_ends_at timestamptz;
  v_block_minutes integer;
  v_role    text := get_my_role();
  v_would_exceed boolean;
  v_prof_capacity            integer;
  v_prof_would_exceed        boolean;
  v_attention_would_exceed   boolean;
  v_group_would_exceed       boolean;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin','superadmin','globaladmin','recepcion','medico') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'appointment_not_found');
  END IF;

  IF v_role = 'medico' AND v_appt.professional_id IS DISTINCT FROM get_my_professional_id() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  IF v_role IN ('admin','recepcion') AND v_appt.organization_id IS DISTINCT FROM get_my_org_id() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT * INTO v_service FROM services WHERE id = v_appt.service_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'service_not_found');
  END IF;

  SELECT concurrent_capacity INTO v_prof_capacity FROM professionals WHERE id = v_appt.professional_id;
  v_prof_capacity := COALESCE(v_prof_capacity, 1);

  v_block_minutes := COALESCE(
    v_service.block_duration_minutes,
    GREATEST(v_service.duration_minutes, COALESCE(v_service.display_duration_minutes, v_service.duration_minutes))
  );
  v_ends_at := p_starts_at + (v_block_minutes || ' minutes')::interval;

  IF EXISTS (
    SELECT 1
      FROM availability_blocks b
     WHERE b.professional_id = v_appt.professional_id
       AND (
         (b.blocked_date IS NOT NULL
          AND b.blocked_date = (p_starts_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)
         OR
         (b.blocked_start IS NOT NULL AND b.blocked_end IS NOT NULL
          AND b.blocked_start < b.blocked_end
          AND b.blocked_start < v_ends_at AND b.blocked_end > p_starts_at)
       )
  ) THEN
    RETURN jsonb_build_object('error', 'professional_unavailable');
  END IF;

  IF EXISTS (
    SELECT 1
      FROM appointments a
      JOIN service_block_rules r
        ON r.organization_id    = v_appt.organization_id
       AND r.trigger_service_id = a.service_id
       AND r.blocked_service_id = v_appt.service_id
     WHERE a.professional_id = v_appt.professional_id
       AND a.id             <> p_appointment_id
       AND a.status NOT IN ('cancelado')
       AND a.starts_at < v_ends_at
       AND (a.starts_at + (r.block_minutes || ' minutes')::interval) > p_starts_at
  ) THEN
    RETURN jsonb_build_object('error', 'service_conflict');
  END IF;

  IF v_service.resource_group IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext(v_appt.professional_id::TEXT || v_service.resource_group || 'grp')
    );

    SELECT EXISTS (
      SELECT 1
        FROM (
          SELECT p_starts_at AS t
          UNION
          SELECT GREATEST(a.starts_at, p_starts_at) AS t
            FROM appointments a
            JOIN services s ON s.id = a.service_id
           WHERE a.professional_id = v_appt.professional_id
             AND a.id             <> p_appointment_id
             AND a.status NOT IN ('cancelado', 'lista_espera')
             AND s.resource_group = v_service.resource_group
             AND a.starts_at < v_ends_at
             AND a.ends_at   > p_starts_at
        ) pts
       WHERE (
         SELECT count(*)
           FROM appointments a2
           JOIN services s2 ON s2.id = a2.service_id
          WHERE a2.professional_id = v_appt.professional_id
            AND a2.id             <> p_appointment_id
            AND a2.status NOT IN ('cancelado', 'lista_espera')
            AND s2.resource_group = v_service.resource_group
            AND a2.starts_at <= pts.t
            AND a2.ends_at   >  pts.t
       ) + 1 > v_service.capacity
    ) INTO v_group_would_exceed;

    IF v_group_would_exceed THEN
      RETURN jsonb_build_object('error', 'slot_taken');
    END IF;

  ELSE
    IF v_prof_capacity > 1 THEN
      PERFORM pg_advisory_xact_lock(
        hashtext(v_appt.professional_id::TEXT || 'prof_capacity')
      );

      SELECT EXISTS (
        SELECT 1
          FROM (
            SELECT p_starts_at AS t
            UNION
            SELECT GREATEST(a.starts_at, p_starts_at) AS t
              FROM appointments a
             WHERE a.professional_id = v_appt.professional_id
               AND a.status NOT IN ('cancelado', 'lista_espera')
               AND a.id              <> p_appointment_id
               AND a.starts_at < v_ends_at
               AND a.ends_at   > p_starts_at
          ) pts
         WHERE (
           SELECT count(*)
             FROM appointments a2
            WHERE a2.professional_id = v_appt.professional_id
              AND a2.status NOT IN ('cancelado', 'lista_espera')
              AND a2.id              <> p_appointment_id
              AND a2.starts_at <= pts.t
              AND a2.ends_at   >  pts.t
         ) + 1 > v_prof_capacity
      ) INTO v_prof_would_exceed;

      IF v_prof_would_exceed THEN
        RETURN jsonb_build_object('error', 'slot_taken');
      END IF;

      IF v_service.requiere_atencion_completa THEN
        SELECT EXISTS (
          SELECT 1
            FROM (
              SELECT p_starts_at AS t
              UNION
              SELECT GREATEST(a.starts_at, p_starts_at) AS t
                FROM appointments a
                JOIN services s2 ON s2.id = a.service_id
               WHERE a.professional_id = v_appt.professional_id
                 AND a.status NOT IN ('cancelado', 'lista_espera')
                 AND a.id              <> p_appointment_id
                 AND s2.requiere_atencion_completa = TRUE
                 AND a.starts_at < v_ends_at
                 AND a.ends_at   > p_starts_at
            ) pts
           WHERE (
             SELECT count(*)
               FROM appointments a2
               JOIN services s3 ON s3.id = a2.service_id
              WHERE a2.professional_id = v_appt.professional_id
                AND a2.status NOT IN ('cancelado', 'lista_espera')
                AND a2.id              <> p_appointment_id
                AND s3.requiere_atencion_completa = TRUE
                AND a2.starts_at <= pts.t
                AND a2.ends_at   >  pts.t
           ) + 1 > 1
        ) INTO v_attention_would_exceed;

        IF v_attention_would_exceed THEN
          RETURN jsonb_build_object('error', 'slot_taken');
        END IF;
      END IF;
    END IF;

    IF v_service.capacity <= 1 THEN
      IF v_prof_capacity <= 1 THEN
        PERFORM pg_advisory_xact_lock(
          hashtext(v_appt.professional_id::text || 'slot')
        );

        IF EXISTS (
          SELECT 1 FROM appointments
           WHERE professional_id = v_appt.professional_id
             AND status           <> 'cancelado'
             AND id                <> p_appointment_id
             AND starts_at < v_ends_at
             AND ends_at   > p_starts_at
           FOR UPDATE
        ) THEN
          RETURN jsonb_build_object('error', 'slot_taken');
        END IF;
      END IF;
    ELSE
      PERFORM pg_advisory_xact_lock(
        hashtext(v_appt.professional_id::text || v_appt.service_id::text || 'capacity')
      );

      SELECT EXISTS (
        SELECT 1
          FROM (
            SELECT p_starts_at AS t
            UNION
            SELECT GREATEST(a.starts_at, p_starts_at) AS t
              FROM appointments a
             WHERE a.professional_id = v_appt.professional_id
               AND a.service_id      = v_appt.service_id
               AND a.status NOT IN ('cancelado', 'lista_espera')
               AND a.id              <> p_appointment_id
               AND a.starts_at < v_ends_at
               AND a.ends_at   > p_starts_at
          ) pts
         WHERE (
           SELECT count(*)
             FROM appointments a2
            WHERE a2.professional_id = v_appt.professional_id
              AND a2.service_id      = v_appt.service_id
              AND a2.status NOT IN ('cancelado', 'lista_espera')
              AND a2.id              <> p_appointment_id
              AND a2.starts_at <= pts.t
              AND a2.ends_at   >  pts.t
         ) + 1 > v_service.capacity
      ) INTO v_would_exceed;

      IF v_would_exceed THEN
        RETURN jsonb_build_object('error', 'slot_taken');
      END IF;
    END IF;
  END IF;

  UPDATE appointments
     SET starts_at = p_starts_at, ends_at = v_ends_at
   WHERE id = p_appointment_id;

  RETURN jsonb_build_object('id', p_appointment_id, 'starts_at', p_starts_at, 'ends_at', v_ends_at);
END;
$function$;

-- ─────────────────────────────────────────────────────────────
-- 5) Recalcular ends_at de los turnos FUTUROS de Acqua (estaban sobre-bloqueados)
-- ─────────────────────────────────────────────────────────────
update public.appointments a
   set ends_at = a.starts_at + (s.block_duration_minutes || ' minutes')::interval
  from public.services s
 where s.id = a.service_id
   and a.organization_id = '302fd304-98cb-4611-b510-63c8a95047b0'
   and s.block_duration_minutes is not null
   and a.status <> 'cancelado'
   and a.starts_at >= now();
