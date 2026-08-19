# DB — Salud Tigre

## Qué se aplicó (proyecto Supabase `xuwkxelrcglstvisbcnk`)
- `01_seed_centros_servicios.sql`: org `Salud Tigre` (id `2f5b9c74-8a1e-4d3b-9f6a-1c2d3e4f5a6b`), 31 locations,
  151 services (41 con `requiere_orden`), 302 professionals (2 por servicio), 1510 schedules (Lun–Vie),
  150 appointments de prueba (turnos ocupados para mostrar huecos en la demo). Idempotente: re-ejecutable.
- Admins: 32 usuarios `@saludtigre.gob.ar` (1 por centro + 1 general), rol `admin`, contraseña demo
  `SaludTigre2026!` (ver `CREDENCIALES_admins.md`). Creados en `auth.users` + `auth.identities` + `public.profiles`.

## Placeholder / a validar
- Profesionales = "Agenda 1/2 — <servicio>" (no son personas reales; cargar los reales por centro).
- Horarios = horario del centro (Lun–Vie); afinar por especialidad.
- `requiere_orden` por servicio = PROPUESTA (validar con la Secretaría).
- Logo del tenant = placeholder SVG.

## No se crearon migraciones nuevas
048 (`services.requiere_orden`) y 049 (lectura anónima de `locations` para tenants `general`) ya cubren a Tigre.
