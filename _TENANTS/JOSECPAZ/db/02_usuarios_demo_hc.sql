-- ============================================================================
-- Usuarios demo + médico con turnos + Historia Clínica — tenant salud-jose-c-paz
-- Idempotente. NO toca otros tenants. Contraseña demo (todos): SaludJCP2026!
-- Correr DESPUÉS de 01_seed_centros_servicios.sql.
-- ============================================================================
DO $$
DECLARE
  v_org  uuid := '7c1e4a52-3b6d-4f0e-9a8c-5d2b1e0f4a91';
  v_pw   text := 'SaludJCP2026!';
  r record; v_uid uuid; v_email text; v_slug text;
  v_med_prof uuid; v_med_loc uuid; v_svc uuid; v_dur int;
  v_pat1 uuid; v_pat2 uuid; v_pat3 uuid; v_past_appt uuid;
  v_wed date := (date_trunc('week', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date + 9); -- próximo miércoles
  v_prev_wed date := (date_trunc('week', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date + 2); -- miércoles de esta semana
  tz text := 'America/Argentina/Buenos_Aires';
BEGIN
  -- ── Limpieza de usuarios demo de este tenant ──────────────────────────────
  DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@saludjcp.gob.ar');
  DELETE FROM profiles WHERE id IN (SELECT id FROM auth.users WHERE email LIKE '%@saludjcp.gob.ar');
  DELETE FROM auth.users WHERE email LIKE '%@saludjcp.gob.ar';

  -- ── Médico demo: se toma la Agenda 1 de Clínica Médica de la US Las Heras ─
  SELECT p.id, p.location_id, ps.service_id, s.duration_minutes INTO v_med_prof, v_med_loc, v_svc, v_dur
    FROM professionals p JOIN locations l ON l.id = p.location_id
    JOIN professional_services ps ON ps.professional_id = p.id JOIN services s ON s.id = ps.service_id
   WHERE p.organization_id = v_org AND l.name = 'Unidad Sanitaria Las Heras' AND p.full_name = 'Agenda 1 — Clínica Médica';
  UPDATE professionals SET full_name = 'Dra. Laura Medina', consultorio = 'Consultorio 1' WHERE id = v_med_prof;

  -- ── Función local para crear usuario (auth.users + identities + profile) ──
  CREATE TEMP TABLE IF NOT EXISTS _jcp_users(email text, full_name text, role text, prof uuid) ON COMMIT DROP;
  TRUNCATE _jcp_users;
  INSERT INTO _jcp_users VALUES
    ('admin.general@saludjcp.gob.ar', 'Admin General — Salud José C. Paz', 'admin', NULL),
    ('recepcion.demo@saludjcp.gob.ar', 'Recepción — Salud José C. Paz', 'recepcion', NULL),
    ('medico.demo@saludjcp.gob.ar', 'Dra. Laura Medina', 'medico', v_med_prof);
  -- 1 admin por centro
  FOR r IN SELECT name FROM locations WHERE organization_id = v_org ORDER BY name LOOP
    v_slug := left(trim(both '-' from regexp_replace(lower(translate(r.name,
              'áéíóúüñÁÉÍÓÚÜÑº—','aeiouunAEIOUUNo-')), '[^a-z0-9]+', '-', 'g')), 45);
    INSERT INTO _jcp_users VALUES ('admin.'||v_slug||'@saludjcp.gob.ar', 'Admin — '||r.name, 'admin', NULL);
  END LOOP;

  FOR r IN SELECT * FROM _jcp_users LOOP
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    VALUES ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', r.email,
            extensions.crypt(v_pw, extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('role', r.role, 'full_name', r.full_name), now(), now(), '', '', '', '');
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_uid, v_uid::text,
            jsonb_build_object('sub', v_uid::text, 'email', r.email, 'email_verified', true),
            'email', now(), now(), now());
    -- el trigger handle_new_user crea el profile; acá lo completamos con org y profesional
    INSERT INTO profiles (id, role, full_name, organization_id, professional_id)
    VALUES (v_uid, r.role, r.full_name, v_org, r.prof)
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name,
      organization_id = EXCLUDED.organization_id, professional_id = EXCLUDED.professional_id;
  END LOOP;

  -- ── Pacientes ficticios del médico ────────────────────────────────────────
  v_pat1 := gen_random_uuid(); v_pat2 := gen_random_uuid(); v_pat3 := gen_random_uuid();
  INSERT INTO patients (id, organization_id, full_name, phone, dni) VALUES
    (v_pat1, v_org, 'Rosa Benítez (paciente demo)', '11 5000 0001', '20000001'),
    (v_pat2, v_org, 'Carlos Acosta (paciente demo)', '11 5000 0002', '20000002'),
    (v_pat3, v_org, 'Lucía Romero (paciente demo)', '11 5000 0003', '20000003');

  -- Turno pasado completado (con HC) de Rosa
  v_past_appt := gen_random_uuid();
  INSERT INTO appointments (id, organization_id, location_id, professional_id, service_id, patient_id, starts_at, ends_at, status, patient_name, patient_phone)
  VALUES (v_past_appt, v_org, v_med_loc, v_med_prof, v_svc, v_pat1,
          (v_prev_wed + time '09:20') AT TIME ZONE tz, (v_prev_wed + time '09:20') AT TIME ZONE tz + make_interval(mins => v_dur),
          'completado', 'Rosa Benítez (paciente demo)', '11 5000 0001');

  -- Turnos del día de la reunión (próximo miércoles) — evitan 09:00 y 10:00 (ocupados de prueba)
  INSERT INTO appointments (organization_id, location_id, professional_id, service_id, patient_id, starts_at, ends_at, status, patient_name, patient_phone)
  SELECT v_org, v_med_loc, v_med_prof, v_svc, pid, (v_wed + t) AT TIME ZONE tz, (v_wed + t) AT TIME ZONE tz + make_interval(mins => v_dur),
         'confirmado', pname, pphone
  FROM (VALUES (v_pat1, 'Rosa Benítez (paciente demo)', '11 5000 0001', time '10:20'),
               (v_pat2, 'Carlos Acosta (paciente demo)', '11 5000 0002', time '10:40'),
               (v_pat3, 'Lucía Romero (paciente demo)', '11 5000 0003', time '11:00')) v(pid, pname, pphone, t)
  WHERE NOT EXISTS (SELECT 1 FROM appointments a WHERE a.professional_id = v_med_prof AND a.starts_at = (v_wed + v.t) AT TIME ZONE tz);

  -- Historia clínica ya cargada (datos ficticios de demo)
  INSERT INTO clinical_records (organization_id, appointment_id, patient_id, professional_id, motivo, diagnostico, indicaciones, notas)
  VALUES (v_org, v_past_appt, v_pat1, v_med_prof,
          'Control de presión arterial y renovación de medicación habitual.',
          'Hipertensión arterial controlada.',
          'Continuar tratamiento indicado. Dieta hiposódica, caminatas 30 min/día. Control en 30 días con laboratorio.',
          'Paciente DEMO — datos ficticios para presentación.');
END $$;
