# MSF — Tenant "Salud San Fernando"

Carpeta con todo lo **propio de este tenant** (relevamiento, seed, credenciales, docs, logo, tests, landing).
El **código de plataforma** (reutilizable) NO vive acá: vive en `src/`, `public/` y `supabase/`.

## Datos del tenant
- Supabase: proyecto `xuwkxelrcglstvisbcnk` (compartido, multi-tenant).
- organization_id: `c72846ab-d346-465e-9b2b-10c02fb1cd5d` · slug `salud-san-fernando` · `tenant_type='general'` · `feature_hc=true`
- Colores institucionales: verde `#3F7D1E` (acento) + verde lima `#8CC63F` + magenta `#A31860` (acento secundario).
- Logo: velero azul/ámbar + "SAN FERNANDO MUNICIPIO" (`public/msf_logo.png`, servido en `/agenda/msf_logo.png`).
- Prefijo de código de turno: `SF-`
- Tema por tenant: entrada curada `salud-san-fernando` en `src/lib/municipalTheme.ts`.

## URLs de producción
- Reservas (vecino): https://platform.praxisoperativa.com/agenda/salud-san-fernando
- Login staff: https://platform.praxisoperativa.com/agenda/
- Llamador: https://platform.praxisoperativa.com/agenda/pantalla/salud-san-fernando
- Tótem: https://platform.praxisoperativa.com/agenda/totem/salud-san-fernando
- Portal (maqueta): https://platform.praxisoperativa.com/agenda/propuesta/salud-san-fernando

## Contenido
- `relevamiento_efectores.md` — 15 centros online (11 de atención primaria + 4 especializados) + Emergencias, con coordenadas.
- `IMAGENES/logo.png` — logo oficial del Municipio (copia del de `public/msf_logo.png`).
- `db/01_seed_centros_servicios.sql` — org + 15 centros + servicios + agendas de prueba.
- `db/CREDENCIALES_admins.md` — usuarios y contraseñas demo (admin general, admin por centro, recepción, médico).
- `db/DEMO_reunion_Campos.md` — guion de la demo para la Secretaría de Salud.
- `db/README_db.md` — qué se aplicó y pruebas backend.
- `docs/OnePager - Turnos Salud San Fernando.pdf` — una hoja, orientada a la Secretaría de Salud.
- `docs/Propuesta institucional - Turnos Salud San Fernando.pdf` — 4 páginas, dirigida a la Secretaría de Salud.
- `docs/onepager-fuente.html`, `docs/propuesta-fuente.html`, `docs/qr.svg`, `docs/build_pdfs.py` — fuentes editables.
  Regenerar con el destinatario: `python3 docs/build_pdfs.py "Sr. Secretario de Salud, Marcelo Campos" ../tests/shots`
- `tests/e2e_sf.py` + `tests/shots/` — E2E frontend Playwright (red mockeada) y screenshots del flujo.
- `tests/landing_shots/` — capturas de la landing.
- `landing/` — **propuesta de portal "Salud San Fernando"** (maqueta no oficial, marcada como tal):
  `landing-fuente.html` (editable) → `python3 landing/build_landing.py` → `landing/index.html` (autocontenida, logo embebido).
  Copia publicada en `public/propuesta-salud-san-fernando.html` → **platform.praxisoperativa.com/agenda/propuesta/salud-san-fernando**
  (rewrite en `vercel.json`, `noindex`). Mapa Leaflet + OSM con los 15 centros + Emergencias (coordenadas OSM / Georef datos.gob.ar),
  "usar mi ubicación" → ordena por cercanía, filtros, centros especializados, sin-turno, FAQ.
  Cada "Sacar turno aquí" hace **deep link** al turnero: `/agenda/salud-san-fernando?centro=<clave>`, donde la clave es
  el nombre del centro en la base sin tildes y en kebab-case. Si se renombra un centro en la base, actualizar su nombre
  en el array `C` de `landing-fuente.html` (7º campo = nombre en la base si difiere del display).

## Código de plataforma tocado (compartido)
- `src/lib/municipalTheme.ts` — entrada curada `salud-san-fernando` (verde + magenta, prefijo `SF`, Emergencias). (Ya existente.)
- `public/msf_logo.png` + `vercel.json` (rewrite `/agenda/msf_logo.png`). (Ya existente.)
- `vercel.json` — nuevo rewrite `/agenda/propuesta/salud-san-fernando` → `/propuesta-salud-san-fernando.html`.
- `MunicipalBookingFlow.tsx`: soporta deep link `?centro=<clave>` (reutilizable por cualquier tenant `general`). (Ya existente.)

## Estado verificado (10/10/2026)
- E2E frontend (red mockeada): home → centro (buscador) → Nutrición (con orden) → gate → sin orden → cabecera →
  fecha/hora (08:20 ocupado / 09:00 libre) → datos → confirmación `SF-xxxxx`; foco OK en buscador y teléfono;
  deep link `?centro=` abre el centro directo y cae al listado si la clave no existe; mobile 375 px sin scroll
  horizontal; **0 errores de consola**. Acento `#3F7D1E` aplicado al botón principal.
- Landing: compila autocontenida (73 KB), mobile sin scroll horizontal, mapa con 16 pines (15 centros + Emergencias).

## Pendiente antes de producción real
- Validar con la Secretaría: centros del piloto, especialidades por centro, horarios y criterio de orden médica.
- Cargar profesionales y agendas reales; cambiar contraseñas demo.
- Confirmar la ubicación exacta de Finochietto (Ruta 202 km 5,5) y del CS Absalón Rojas en las islas.
