-- ============================================================================
-- Seed tenant "Salud Tigre" (tenant_type = general) — Praxis Agenda
-- Fuente: sitio oficial tigre.gob.ar/salud (relevamiento 19/08/2026).
-- Idempotente: borra y recrea el tenant salud-tigre. NO toca otros tenants.
-- Clasificación de requiere_orden = PROPUESTA a validar con la Secretaría.
-- ============================================================================
DO $$
DECLARE
  v_org uuid := '2f5b9c74-8a1e-4d3b-9f6a-1c2d3e4f5a6b';
  c jsonb; s jsonb; v_loc uuid; v_svc uuid; v_prof uuid; d int; k int;
  data jsonb := '[
    {"name":"Hospital Materno Infantil Dr. Florencio Escardó","address":"Carlos de Alvear 1666, Tigre Centro","phone":"0810 444 3400","open":"08:00","close":"18:00","services":[{"n":"Obstetricia","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Ecografía Obstétrica","d":20,"o":true},{"n":"Control de Embarazo","d":20,"o":true}]},
    {"name":"Hospital Odontológico Prof. Dr. Ricardo Guardo","address":"Hipólito Yrigoyen (ex Ruta 197) esq. San Lorenzo, General Pacheco","phone":"11 2764 7072","open":"08:30","close":"19:30","services":[{"n":"Odontología General","d":30,"o":false},{"n":"Odontopediatría","d":30,"o":false},{"n":"Endodoncia","d":30,"o":true},{"n":"Prótesis","d":30,"o":true},{"n":"Ortodoncia","d":30,"o":true}]},
    {"name":"Hospital Oftalmológico Dr. Ramón Carrillo","address":"Lisandro de la Torre 1324, Troncos del Talar","phone":"11 3831 6448","open":"08:00","close":"16:45","services":[{"n":"Oftalmología General","d":20,"o":false},{"n":"Oftalmopediatría","d":20,"o":true},{"n":"Fondo de Ojo","d":20,"o":true}]},
    {"name":"HMDI Dr. Floreal Ferrara","address":"Colectora Oeste esq. Menéndez y Pelayo, Don Torcuato","phone":"11 2689 9228","open":"08:00","close":"20:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Radiología","d":20,"o":true},{"n":"Laboratorio","d":20,"o":true}]},
    {"name":"Centro de Prevención y Asistencia en Nutrición (CEPAN)","address":"Av. de los Constituyentes 3284, Las Tunas","phone":"11 6395 3503","open":"08:00","close":"17:00","services":[{"n":"Nutrición","d":20,"o":true},{"n":"Nutrición Infantojuvenil","d":20,"o":true}]},
    {"name":"HMDI Dr. Valentín Nores","address":"Maipú 257 esq. Casaretto, Tigre Centro","phone":"11 2178 6191","open":"08:00","close":"18:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Radiología","d":20,"o":true},{"n":"Laboratorio","d":20,"o":true}]},
    {"name":"Centro de Rehabilitación Frida Kahlo","address":"Av. Hipólito Yrigoyen 1400, General Pacheco","phone":"11 2182 1683","open":"08:00","close":"16:00","services":[{"n":"Kinesiología","d":30,"o":true},{"n":"Terapia Ocupacional","d":30,"o":true},{"n":"Fonoaudiología","d":30,"o":true}]},
    {"name":"HMDI Dr. Eduardo Juan Mocoroa","address":"Fernando Fader e/ San Martín y Moreno, Benavídez","phone":"11 2689 9228","open":"08:00","close":"18:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Radiología","d":20,"o":true},{"n":"Laboratorio","d":20,"o":true}]},
    {"name":"Centro Talar Sur - Salud Mental y Adicciones","address":"Independencia 259, El Talar","phone":"11 3344 3237","open":"08:00","close":"17:00","services":[{"n":"Psicología","d":30,"o":false},{"n":"Salud Mental","d":30,"o":false},{"n":"Tratamiento en Adicciones","d":30,"o":false}]},
    {"name":"Centro de Rehabilitación Psicofísica Juana Azurduy","address":"Maipú 201, Tigre Centro","phone":"11 3113 1759","open":"08:00","close":"16:00","services":[{"n":"Kinesiología","d":30,"o":true},{"n":"Terapia Ocupacional","d":30,"o":true}]},
    {"name":"Hospital Municipal de Medicina Cardiovascular Dr. Genaro Serantes","address":"Dr. Casaretto 849, Tigre Centro","phone":"11 2178 6191","open":"08:00","close":"16:00","services":[{"n":"Cardiología","d":20,"o":true},{"n":"Electrocardiograma","d":20,"o":true},{"n":"Ecocardiograma","d":20,"o":true}]},
    {"name":"Centro de Salud Almirante Brown","address":"Gral. Juan Andrés 3010, El Talar","phone":"11 2689 8820","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false},{"n":"Nutrición","d":20,"o":true}]},
    {"name":"Centro de Salud Baires","address":"Blandengues e/ Alvear y Ombú, Don Torcuato","phone":"11 2178 6831","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false},{"n":"Nutrición","d":20,"o":true}]},
    {"name":"Centro de Salud Benavídez","address":"Alvear esq. Marabotto, Benavídez","phone":"11 2178 6878","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false},{"n":"Nutrición","d":20,"o":true}]},
    {"name":"Centro de Salud Carupá","address":"Ruperto Mazza 1154, Tigre","phone":"11 2689 9120","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false},{"n":"Nutrición","d":20,"o":true}]},
    {"name":"Centro de Salud Canal","address":"Italia 105 esq. Ruperto Mazza, Tigre Centro","phone":"11 6608 2123","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false},{"n":"Nutrición","d":20,"o":true}]},
    {"name":"Centro de Salud Dique Luján","address":"12 de Octubre 943 esq. 9 de Julio, Dique Luján","phone":"11 2689 8948","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false},{"n":"Nutrición","d":20,"o":true}]},
    {"name":"Centro de Salud El Arco","address":"Tomás Godoy Cruz 1182, Benavídez","phone":"11 2689 9099","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false},{"n":"Nutrición","d":20,"o":true}]},
    {"name":"Centro de Salud La Paloma","address":"Av. La Paloma e/ Monteagudo y Paraguay, El Talar","phone":"11 2178 6379","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false},{"n":"Nutrición","d":20,"o":true}]},
    {"name":"Centro de Salud Troncos del Talar","address":"Escalada 598, Troncos del Talar","phone":"11 2178 7035","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false},{"n":"Nutrición","d":20,"o":true}]},
    {"name":"Centro de Salud Las Tunas","address":"Arístides Sacriste 2900 esq. Mosconi, General Pacheco","phone":"11 2689 8830","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false},{"n":"Nutrición","d":20,"o":true}]},
    {"name":"Centro de Salud Rincón de Milberg","address":"Santa María esq. Irala, Rincón de Milberg","phone":"11 2689 8771","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false},{"n":"Nutrición","d":20,"o":true}]},
    {"name":"Centro de Salud Ricardo Rojas","address":"Richieri esq. Elizalde, Ricardo Rojas","phone":"11 2689 8940","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false},{"n":"Nutrición","d":20,"o":true}]},
    {"name":"Centro de Salud Don Torcuato","address":"Arata esq. España, Don Torcuato","phone":"11 2689 9331","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false},{"n":"Nutrición","d":20,"o":true}]},
    {"name":"Centro de Salud Río Capitán","address":"Río Capitán y Arroyo El Toro, 1ª sección de Islas","phone":"11 6860 7325","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false}]},
    {"name":"Centro de Salud Río Carapachay","address":"Río Carapachay 900 y Canal Ortiz, 1ª sección de Islas","phone":"11 5715 0600","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false}]},
    {"name":"Centro de Salud General Belgrano","address":"Av. Belgrano 1661, Don Torcuato","phone":"11 2689 8838","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false},{"n":"Nutrición","d":20,"o":true}]},
    {"name":"Centro de Salud General Pacheco","address":"Salta 550, General Pacheco","phone":"11 2689 9021","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false},{"n":"Nutrición","d":20,"o":true}]},
    {"name":"Centro de Salud Juana Manso","address":"Agustín García 5960, Nuevo Delta","phone":"11 2178 6157","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false},{"n":"Nutrición","d":20,"o":true}]},
    {"name":"Centro de Salud Eva Perón","address":"Padre Nuestro y Sans Sousi, General Pacheco","phone":"11 2689 9213","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false},{"n":"Nutrición","d":20,"o":true}]},
    {"name":"Centro de Salud Juan Urionagüena","address":"Coronel Rosales y Lucio López, Tigre","phone":"11 2178 6325","open":"08:00","close":"17:00","services":[{"n":"Clínica Médica","d":20,"o":false},{"n":"Pediatría","d":20,"o":false},{"n":"Ginecología","d":20,"o":false},{"n":"Obstetricia","d":20,"o":false},{"n":"Odontología General","d":30,"o":false},{"n":"Nutrición","d":20,"o":true}]}
  ]'::jsonb;
BEGIN
  -- Limpieza idempotente (solo este tenant)
  DELETE FROM appointments WHERE organization_id = v_org;
  DELETE FROM schedules WHERE professional_id IN (SELECT id FROM professionals WHERE organization_id = v_org);
  DELETE FROM professional_services WHERE professional_id IN (SELECT id FROM professionals WHERE organization_id = v_org);
  DELETE FROM professionals WHERE organization_id = v_org;
  DELETE FROM services WHERE organization_id = v_org;
  DELETE FROM locations WHERE organization_id = v_org;
  DELETE FROM organizations WHERE id = v_org;

  INSERT INTO organizations (id,name,slug,tenant_type,primary_color,logo_url,timezone,active,address,phone,booking_headline)
  VALUES (v_org,'Salud Tigre','salud-tigre','general','#D02013','/agenda/tigre_logo.svg','America/Argentina/Buenos_Aires',true,'Municipio de Tigre, Buenos Aires','0810 444 3400','Turnos en los Centros de Salud Municipales');

  FOR c IN SELECT * FROM jsonb_array_elements(data) LOOP
    v_loc := gen_random_uuid();
    INSERT INTO locations (id,organization_id,name,address,phone,active)
      VALUES (v_loc,v_org,c->>'name',c->>'address',c->>'phone',true);
    FOR s IN SELECT * FROM jsonb_array_elements(c->'services') LOOP
      v_svc := gen_random_uuid(); d := (s->>'d')::int;
      INSERT INTO services (id,organization_id,name,duration_minutes,requiere_orden,active,color)
        VALUES (v_svc,v_org,s->>'n',d,(s->>'o')::boolean,true,'#D02013');
      -- 2 profesionales (agendas) por servicio/centro
      FOR k IN 1..2 LOOP
        v_prof := gen_random_uuid();
        INSERT INTO professionals (id,organization_id,location_id,full_name,specialty,active)
          VALUES (v_prof,v_org,v_loc,'Agenda '||k||' — '||(s->>'n'),s->>'n',true);
        INSERT INTO professional_services (professional_id,service_id) VALUES (v_prof,v_svc);
        INSERT INTO schedules (professional_id,day_of_week,start_time,end_time,interval_minutes,active)
          SELECT v_prof,dow,(c->>'open')::time,(c->>'close')::time,d,true FROM generate_series(1,5) dow;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Turnos ocupados de prueba: reserva el primer slot (09:00) del próximo martes y
  -- miércoles para ~1 de cada 4 agendas, para que la demo muestre huecos.
  INSERT INTO appointments (organization_id, location_id, professional_id, service_id, starts_at, ends_at, status, patient_name, patient_phone)
  SELECT p.organization_id, p.location_id, p.id, ps.service_id,
         ((date_trunc('week', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date + 8 + off) + time '09:00') AT TIME ZONE 'America/Argentina/Buenos_Aires',
         ((date_trunc('week', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date + 8 + off) + time '09:00') AT TIME ZONE 'America/Argentina/Buenos_Aires' + (sv.duration_minutes||' minutes')::interval,
         'confirmado', 'Turno de prueba (demo)', '1100000000'
  FROM (SELECT id, organization_id, location_id, row_number() OVER (ORDER BY id) rn FROM professionals WHERE organization_id = v_org) p
  JOIN professional_services ps ON ps.professional_id = p.id
  JOIN services sv ON sv.id = ps.service_id
  CROSS JOIN (VALUES (0),(1)) AS days(off)
  WHERE p.rn % 4 = 0;
END $$;
