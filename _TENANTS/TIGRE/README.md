# TIGRE — Tenant "Salud Tigre"

Carpeta con todo lo **propio de este tenant** (relevamiento, seed, credenciales, one-pager, logo).
El **código de plataforma** (reutilizable) NO vive acá: vive en `src/` y `supabase/`.

## Datos del tenant
- Supabase: proyecto `xuwkxelrcglstvisbcnk`
- organization_id: `2f5b9c74-8a1e-4d3b-9f6a-1c2d3e4f5a6b`
- slug: `salud-tigre` · tenant_type: `general`
- URL pública de reservas: `https://<tu-dominio>/agenda/salud-tigre`
- Login de gestión: `https://<tu-dominio>/agenda/`
- Color oficial: `#D02013` (rojo Tigre) + acento celeste `#0E7CB0`
- Línea de turnos: `0810 444 3400`
- Logo: **placeholder** `public/tigre_logo.svg`. Oficial (reemplazar): `https://www.tigre.gob.ar/public/assets/frontend/img/logos/webtigre2022-03.svg`

## Contenido de esta carpeta
- `relevamiento_efectores.md` — 31 efectores oficiales (nombre, dirección, tel, horario) + clasificación propuesta.
- `db/01_seed_centros_servicios.sql` — seed idempotente de org + centros + servicios + 2 profesionales/servicio + agendas + turnos ocupados de prueba.
- `db/CREDENCIALES_admins.md` — 32 admins demo (1 por centro + 1 general) y contraseña.
- `db/README_db.md` — qué se aplicó y qué es placeholder.
- `docs/OnePager - Turnos Salud Tigre.pdf` — one-pager para la Secretaría.
- `docs/onepager-fuente.html` — fuente editable del one-pager.

## Código de plataforma (compartido — NO mover acá)
- `src/lib/municipalTheme.ts` — **NUEVO**: resolver de tema por tenant. San Fernando pineado (verde),
  Tigre con rojo oficial; cualquier otro tenant `general` se deriva de `org.primary_color`.
- `src/components/booking/MunicipalBookingFlow.tsx` — parametrizado: usa `getMunicipalTheme(org)`,
  sin colores ni textos institucionales hardcodeados. `Shell`/`Back` a nivel de módulo (evita el bug de foco).
- `public/tigre_logo.svg` + `vercel.json` (rewrite `/agenda/tigre_logo.svg`).
- Migraciones 048/049 ya cubrían a cualquier tenant `general` (no se crearon nuevas).

## Estado (verificado)
- `tsc && vite build`: OK (2961 módulos, 0 errores).
- E2E backend (anon): lee 31 centros de Tigre, 0 de otros tenants; `reservar_turno` crea turno y doble-booking → `slot_taken`.
- E2E frontend (Playwright, red mockeada): Tigre rojo, San Fernando intacto verde, test de foco (buscador + teléfono) OK, flujo completo hasta código `TIG-`, 0 errores de JS.

## Pendiente antes de producción real
- Reemplazar el logo placeholder por el SVG oficial de Tigre.
- Validar con la Secretaría qué especialidades requieren orden y qué efectores van a turnos online.
- Reemplazar profesionales/horarios placeholder por los reales de cada centro.
- Cambiar las contraseñas de los admin demo.
