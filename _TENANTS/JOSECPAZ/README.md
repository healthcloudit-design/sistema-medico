# JOSECPAZ — Tenant "Salud José C. Paz"

Carpeta con todo lo **propio de este tenant** (relevamiento, seed, credenciales, docs, logo, tests).
El **código de plataforma** (reutilizable) NO vive acá: vive en `src/`, `public/` y `supabase/`.

## Datos del tenant
- Supabase: proyecto `xuwkxelrcglstvisbcnk`
- organization_id: `7c1e4a52-3b6d-4f0e-9a8c-5d2b1e0f4a91` · slug `salud-jose-c-paz` · `tenant_type='general'` · `feature_hc=true`
- Colores oficiales (header/botones de josecpaz.gob.ar): azul `#11547B` + celeste `#14B3E4` (solo fondos de badge)
- Logo: escudo oficial (`public/josecpaz_logo.png`, servido en `/agenda/josecpaz_logo.png`). No se usa el logo
  horizontal del sitio porque incluye "Intendencia Mario Ishii".
- Teléfono mostrado: Secretaría de Salud `(02320) 440-511` (no hay línea de turnos centralizada publicada).
- Prefijo de código de turno: `JCP-`

## URLs de producción
- Reservas (vecino): https://platform.praxisoperativa.com/agenda/salud-jose-c-paz
- Login staff: https://platform.praxisoperativa.com/agenda/
- Llamador: https://platform.praxisoperativa.com/agenda/pantalla/salud-jose-c-paz
- Tótem: https://platform.praxisoperativa.com/agenda/totem/salud-jose-c-paz

## Contenido
- `relevamiento_efectores.md` — 45 establecimientos del registro oficial PBA, clasificados (online / fuera / demanda espontánea).
- `logo-escudo-josecpaz.png` — escudo oficial recortado (copia del de `public/`).
- `db/01_seed_centros_servicios.sql` — org + 25 centros + 143 servicios + 286 agendas + turnos ocupados de prueba.
- `db/02_usuarios_demo_hc.sql` — 28 usuarios demo, médico linkeado, pacientes ficticios y HC cargada.
- `db/CREDENCIALES.md` — usuarios y contraseña demo.
- `db/README_db.md` — qué se aplicó, pruebas backend, placeholders.
- `docs/OnePager - Turnos Salud José C. Paz.pdf` — una hoja, orientada al concejal.
- `docs/Propuesta institucional - Turnos Salud José C. Paz.pdf` — 4 páginas, dirigida al HCD.
- `docs/onepager-fuente.html`, `docs/propuesta-fuente.html`, `docs/qr.svg`, `docs/build_pdfs.py` — fuentes editables.
  Regenerar con el nombre del concejal: `python3 docs/build_pdfs.py "Concejal Nombre Apellido" tests/shots`
- `docs/DEMO_reunion_concejal.md` — guion de la demo del miércoles.
- `tests/e2e_jcp.py` + `tests/shots/` — E2E frontend Playwright (red mockeada) y screenshots.
- `landing/` — **propuesta de portal "Salud José C. Paz"** (maqueta no oficial, marcada como tal):
  `landing-fuente.html` (editable) → `python3 landing/build_landing.py` → `landing/index.html` (autocontenida, escudo embebido).
  Copia publicada en `public/propuesta-salud-jose-c-paz.html` → **platform.praxisoperativa.com/agenda/propuesta/salud-jose-c-paz**
  (rewrite en `vercel.json`, `noindex`). Mapa Leaflet + OSM con los 30 efectores (coordenadas del registro PBA),
  "usar mi ubicación" → ordena por cercanía, filtros, hospitales, sin-turno, FAQ. Screens en `tests/landing_shots/`.

## Código de plataforma tocado (compartido)
- `src/lib/municipalTheme.ts` — nueva entrada curada `'salud-jose-c-paz'` (azul/celeste oficiales, copy, prefijo `JCP`).
  San Fernando y Tigre sin cambios.
- `public/josecpaz_logo.png` + `vercel.json` (rewrite `/agenda/josecpaz_logo.png`).
- `MunicipalBookingFlow.tsx` NO se tocó: ya estaba parametrizado y con `Shell`/`Back` a nivel de módulo.

## Estado verificado (02/10/2026)
- `tsc --noEmit`: OK · `vite build`: OK (2966 módulos).
- E2E backend anon: centros → servicios → `reservar_turno` OK → doble-booking `slot_taken`.
- HC bajo RLS emulando al médico: lee / actualiza / crea su HC; 0 HC de otros tenants visibles.
- E2E frontend: home → centro → Nutrición (con orden) → gate → sin orden → cabecera → fecha/hora → datos →
  confirmación `JCP-xxxxx`; foco OK en buscador y teléfono; mobile 375 px sin scroll horizontal; **0 errores de consola**.

## Pendiente antes de producción real
- Validar con la Secretaría: centros del piloto, especialidades por CAPS, horarios y criterio de orden médica.
- Cargar profesionales y agendas reales; cambiar contraseñas demo.
- Confirmar dirección del Oftalmológico (registro PBA: H. Yrigoyen 2900; prensa municipal: 3028).
