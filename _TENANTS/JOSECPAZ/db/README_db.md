# DB — Salud José C. Paz

## Qué se aplicó (proyecto Supabase `xuwkxelrcglstvisbcnk`, 02/10/2026)
- **`01_seed_centros_servicios.sql`**: org `Salud José C. Paz` (id `7c1e4a52-3b6d-4f0e-9a8c-5d2b1e0f4a91`,
  `tenant_type='general'`, `primary_color='#11547B'`, `feature_hc=true`, tz `America/Argentina/Buenos_Aires`),
  **25 locations** (22 CAPS + 3 hospitales de especialidad), **143 services** (30 con `requiere_orden`),
  **286 professionals** (2 agendas por servicio/centro), **1.430 schedules** (Lun–Vie 8–16 h),
  **284 turnos ocupados de prueba** (09:00 y 10:00 del mar 6 y mié 7/10, ~1 de cada 4 agendas).
- **`02_usuarios_demo_hc.sql`**: 28 usuarios `@saludjcp.gob.ar` (1 admin general, 25 admin por centro, 1 recepción,
  1 médico) en `auth.users` + `auth.identities` + `profiles`. El médico (`medico.demo@`) está linkeado
  (`profiles.professional_id`) a la **Dra. Laura Medina** (Agenda 1 — Clínica Médica, US Las Heras), con:
  - 1 turno **completado** el mié 30/09 09:20 (Rosa Benítez) **con Historia Clínica cargada**.
  - 3 turnos **confirmados** el mié 07/10 (día de la reunión) 10:20 / 10:40 / 11:00.
  - Pacientes 100% ficticios, marcados "(paciente demo)".

## Re-ejecución
Ambos scripts son idempotentes: arrancan borrando SOLO lo de este tenant (`organization_id` de JCP y
emails `@saludjcp.gob.ar`). Por tener `DELETE`, el MCP de Supabase pide confirmación antes de correrlos.
Las fechas de los turnos de prueba se calculan relativas a la semana en que se corre (`date_trunc('week', now())`).

## Pruebas corridas (02/10/2026)
- **Anon:** ve la org y sus 25 centros; servicios de US La Paz (6, Nutrición con orden); `reservar_turno` creó turno
  con `organization_id`/`location_id` correctos (jue 08/10 11:00) y el 2º intento devolvió `slot_taken`.
  El turno de prueba quedó **cancelado** (no ocupa agenda).
- **HC bajo RLS (rol authenticated + sub del médico):** `get_my_role()=medico`, ve 1 HC (0 de otros tenants),
  UPDATE 1, INSERT 1, lectura posterior 2 → todo en transacción con ROLLBACK (la demo queda limpia).

## Placeholder / a validar con la Secretaría
- Profesionales = "Agenda 1/2 — <servicio>" (salvo la Dra. Laura Medina, ficticia para la demo).
- Horario 8–16 h Lun–Vie para todos los centros (no está publicado oficialmente).
- Mix de especialidades por CAPS y `requiere_orden` = PROPUESTA.
- Teléfono de US Primavera incompleto en la fuente; Oftalmológico y Centro del Diabético sin teléfono en la fuente.

## Sin migraciones nuevas
048 (`services.requiere_orden`) y 049 (lectura anónima de `locations` para tenants `general`) ya cubren a JCP.
