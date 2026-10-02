-- ============================================================================
-- Seed tenant "Salud José C. Paz" (tenant_type = general) — Praxis Agenda
-- Fuente: Ministerio de Salud PBA — Datos Abiertos PBA, "Establecimientos de salud
-- públicos" 2025 (partido José C. Paz) + josecpaz.gob.ar. Relevamiento 02/10/2026.
-- Idempotente: borra y recrea SOLO el tenant salud-jose-c-paz. NO toca otros tenants.
-- Servicios por centro, horarios y requiere_orden = PROPUESTA a validar con la Secretaría.
-- ============================================================================
DO $$
DECLARE
  v_org uuid := '7c1e4a52-3b6d-4f0e-9a8c-5d2b1e0f4a91';
  c jsonb; s jsonb; v_loc uuid; v_svc uuid; v_prof uuid; d int; k int;
  -- Atención primaria estándar de cada CAPS (o = requiere orden del médico de cabecera)
  prim jsonb := '[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false},{"n":"Nutrición","d":20,"o":true}]';
  -- [nombre, dirección, teléfono] — 22 CAPS / Unidades Sanitarias municipales
  caps jsonb := '[
    ["Unidad Sanitaria 9 de Julio","Maestro Ángel D''Elía 4265","2320 436930"],
    ["Unidad Sanitaria San Roque","Pavón 3545","11 4451-4327"],
    ["Unidad Sanitaria Mirador Altube","Ruta Prov. 24 (ex 197) y Tres Marías","2320 439580"],
    ["Unidad Sanitaria Vucetich","Guanacaste y Crucero La Argentina 442","2320 437098"],
    ["Unidad Sanitaria Alberdi","Montes de Oca y Florida","2320 465917"],
    ["Unidad Sanitaria Las Acacias","General Pinto y Eva Duarte de Perón s/n","2320 463432"],
    ["Unidad Sanitaria La Paz","Oribe y Castañeda","2320 424672"],
    ["Unidad Sanitaria Las Heras","Coronel Arias y Av. Presidente Sarmiento","2320 462604"],
    ["Unidad Sanitaria Primavera","Ayacucho y Santa Marta",null],
    ["Unidad Sanitaria San Atilio","Guillermo Miller e/ San Blas y Managua","2320 452072"],
    ["Unidad Sanitaria Sagrada Familia","Uspallata e/ Londres y Roma","2320 445857"],
    ["Unidad Sanitaria El Ombú","General Arenales 362","2320 436966"],
    ["Centro Asistencial Suizo Infico","Balcarce 3812","2320 437049"],
    ["Unidad Sanitaria Zona Norte","Malnati 3759","2320 425432"],
    ["Unidad Sanitaria Urquiza","Caracas s/n e/ Bolívar y Canal de Panamá","2320 437666"],
    ["Unidad Sanitaria Sol y Verde","Dinamarca esq. Finlay","2320 491561"],
    ["Centro de Salud Santa Paula","Piñero 755","2320 447291"],
    ["Centro Asistencial Tráiler Barrio Piñeiro","Pedernera y Lacroce s/n","2320 431127"],
    ["Centro de Salud Suizo Ideal","Chile y Roque Sáenz Peña","2320 438808"],
    ["Unidad Sanitaria Frino Sur","Cesáreo B. de Quirós 1956 esq. Ugarteche","2320 465723"],
    ["Unidad Sanitaria Piñeyro II","11 de Septiembre y Carmen Puch","2320 421983"],
    ["Tráiler I — Secretaría de Salud","Av. Hipólito Yrigoyen 2945 e/ Casacuberta y Martel","2320 589583"]
  ]';
  -- 3 hospitales/centros municipales de especialidad (consultorio externo)
  esp jsonb := '[
    {"name":"Hospital Odontológico Eva Perón","address":"Av. Hipólito Yrigoyen 3072, Bº Argital","phone":"2320 422260","services":[{"n":"Odontología General","d":30,"o":false},{"n":"Odontopediatría","d":30,"o":false},{"n":"Endodoncia","d":30,"o":true},{"n":"Ortodoncia","d":30,"o":true},{"n":"Prótesis","d":30,"o":true}]},
    {"name":"Hospital Oftalmológico Juan Domingo Perón","address":"Av. Hipólito Yrigoyen 2900","phone":null,"services":[{"n":"Oftalmología General","d":20,"o":false},{"n":"Oftalmopediatría","d":20,"o":true},{"n":"Fondo de Ojo","d":20,"o":true}]},
    {"name":"Centro Integral del Diabético","address":"Zuviría y Lavalle","phone":null,"services":[{"n":"Diabetología","d":20,"o":true},{"n":"Nutrición","d":20,"o":true},{"n":"Podología","d":30,"o":true}]}
  ]';
  data jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('name',x->>0,'address',x->>1,'phone',x->>2,'services',prim)) || esp
    INTO data FROM jsonb_array_elements(caps) x;

  -- Limpieza idempotente (solo este tenant)
  DELETE FROM clinical_records WHERE organization_id = v_org;
  DELETE FROM appointments WHERE organization_id = v_org;
  DELETE FROM patients WHERE organization_id = v_org;
  DELETE FROM schedules WHERE professional_id IN (SELECT id FROM professionals WHERE organization_id = v_org);
  DELETE FROM professional_services WHERE professional_id IN (SELECT id FROM professionals WHERE organization_id = v_org);
  UPDATE profiles SET professional_id = NULL WHERE organization_id = v_org;
  DELETE FROM professionals WHERE organization_id = v_org;
  DELETE FROM services WHERE organization_id = v_org;
  DELETE FROM locations WHERE organization_id = v_org;

  INSERT INTO organizations (id,name,slug,tenant_type,primary_color,logo_url,timezone,active,address,phone,booking_headline,feature_hc)
  VALUES (v_org,'Salud José C. Paz','salud-jose-c-paz','general','#11547B','/agenda/josecpaz_logo.png','America/Argentina/Buenos_Aires',true,
          'Secretaría de Salud — Av. Hipólito Yrigoyen 2945, José C. Paz','(02320) 440-511','Turnos en los Centros de Salud Municipales',true)
  ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, slug=EXCLUDED.slug, tenant_type=EXCLUDED.tenant_type,
    primary_color=EXCLUDED.primary_color, logo_url=EXCLUDED.logo_url, timezone=EXCLUDED.timezone, active=true,
    address=EXCLUDED.address, phone=EXCLUDED.phone, booking_headline=EXCLUDED.booking_headline, feature_hc=true;

  FOR c IN SELECT * FROM jsonb_array_elements(data) LOOP
    v_loc := gen_random_uuid();
    INSERT INTO locations (id,organization_id,name,address,phone,active)
      VALUES (v_loc,v_org,c->>'name',(c->>'address')||', José C. Paz',c->>'phone',true);
    FOR s IN SELECT * FROM jsonb_array_elements(c->'services') LOOP
      v_svc := gen_random_uuid(); d := (s->>'d')::int;
      INSERT INTO services (id,organization_id,name,duration_minutes,requiere_orden,active,color)
        VALUES (v_svc,v_org,s->>'n',d,(s->>'o')::boolean,true,'#11547B');
      -- 2 profesionales (agendas) por servicio/centro, Lun–Vie 8 a 16 h (horario propuesto)
      FOR k IN 1..2 LOOP
        v_prof := gen_random_uuid();
        INSERT INTO professionals (id,organization_id,location_id,full_name,specialty,active)
          VALUES (v_prof,v_org,v_loc,'Agenda '||k||' — '||(s->>'n'),s->>'n',true);
        INSERT INTO professional_services (professional_id,service_id) VALUES (v_prof,v_svc);
        INSERT INTO schedules (professional_id,day_of_week,start_time,end_time,interval_minutes,active)
          SELECT v_prof,dow,time '08:00',time '16:00',d,true FROM generate_series(1,5) dow;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Turnos ocupados de prueba: 09:00 y 10:00 del próximo martes y miércoles para ~1 de
  -- cada 4 agendas (la demo muestra horarios tachados).
  INSERT INTO appointments (organization_id, location_id, professional_id, service_id, starts_at, ends_at, status, patient_name, patient_phone)
  SELECT p.organization_id, p.location_id, p.id, ps.service_id,
         ((date_trunc('week', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date + 8 + off) + hr) AT TIME ZONE 'America/Argentina/Buenos_Aires',
         ((date_trunc('week', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date + 8 + off) + hr) AT TIME ZONE 'America/Argentina/Buenos_Aires' + (sv.duration_minutes||' minutes')::interval,
         'confirmado', 'Turno de prueba (demo)', '1100000000'
  FROM (SELECT id, organization_id, location_id, row_number() OVER (ORDER BY id) rn FROM professionals WHERE organization_id = v_org) p
  JOIN professional_services ps ON ps.professional_id = p.id
  JOIN services sv ON sv.id = ps.service_id
  CROSS JOIN (VALUES (0),(1)) AS days(off)
  CROSS JOIN (VALUES (time '09:00'),(time '10:00')) AS hrs(hr)
  WHERE p.rn % 4 = 0;
END $$;
