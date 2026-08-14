# Base de datos — tenant Salud San Fernando

Proyecto Supabase: `xuwkxelrcglstvisbcnk`
organization_id: `c72846ab-d346-465e-9b2b-10c02fb1cd5d` · slug: `salud-san-fernando` · tenant_type: `general`

## Aplicado en la instancia
- **Migraciones compartidas** (viven en `supabase/migrations/`, no acá):
  - `048_service_requiere_orden.sql` — columna `services.requiere_orden`.
  - `049_locations_public_read_general.sql` — lectura anónima de `locations` SOLO para tenants `general`.
- **Seed del tenant** (`01_seed_centros_servicios.sql`): 15 centros (Emergencias excluido), 79 servicios (29 con orden).
- **Profesionales**: 2 por especialidad/centro (158 en total) con agenda Lun-Vie.
- **Admins**: 15 por centro + 1 general (ver CREDENCIALES_admins.md).
- **Turnos demo**: ~50 turnos ocupados en el próximo día hábil para mostrar disponibilidad parcial.

## Datos placeholder a reemplazar antes de producción
- Profesionales tienen nombres generados y agenda genérica (Lun-Vie, horario completo del centro).
  Reemplazar por el plantel y los horarios reales de cada centro.
- La clasificación "requiere orden" por servicio es una propuesta; validar con la Secretaría de Salud.
