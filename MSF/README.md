# MSF — Tenant "Salud San Fernando"

Carpeta con todo lo **propio de este tenant** (documentos, one-pager, scripts de datos, credenciales, logo).
El **código de plataforma** (reutilizable para otros municipios) NO vive acá: vive en el árbol de la app.

## Datos del tenant
- Supabase: proyecto `xuwkxelrcglstvisbcnk`
- organization_id: `c72846ab-d346-465e-9b2b-10c02fb1cd5d`
- slug: `salud-san-fernando` · tenant_type: `general`
- URL pública de reservas: `https://<tu-dominio>/agenda/salud-san-fernando`
- Login de gestión: `https://<tu-dominio>/agenda/`
- Color: `#1F5C99` (azul) + acento ámbar `#D98A1F` · Logo: velero San Fernando

## Contenido de esta carpeta
- `IMAGENES/logo.png` — logo oficial del municipio.
- `docs/OnePager - Turnos Salud San Fernando.pdf` — one-pager para la Secretaría.
- `docs/onepager-fuente.html` — fuente editable del one-pager.
- `docs/Propuesta - Turnos Salud San Fernando.md` — documento de decisión + relevamiento.
- `docs/prototipo-navegable.html` — prototipo clickable inicial (referencia de UX).
- `db/01_seed_centros_servicios.sql` — seed de centros + servicios.
- `db/CREDENCIALES_admins.md` — usuarios y contraseña demo.
- `db/README_db.md` — qué se aplicó en la base y qué datos son placeholder.

## Código de plataforma (compartido — NO mover a MSF)
Vive en el repo porque Vite compila desde `src/` y sirve para el próximo tenant público:
- `src/components/booking/MunicipalBookingFlow.tsx` — flujo multi-centro + gate de orden.
- `src/components/booking/BookingFlow.tsx` — rutea `tenant_type='general'` al flujo municipal.
- `src/types/index.ts` — campo `requiere_orden` en `Service`.
- `vercel.json` — sirve `/agenda/msf_logo.png`.
- `public/msf_logo.png` — logo servido por la app (copia del de IMAGENES).
- `supabase/migrations/048_service_requiere_orden.sql` y `049_locations_public_read_general.sql`.

## Deploy
1. `npm run build` local para verificar (ya probado: tsc + vite build OK).
2. Commit + push (Vercel auto-deploya) o `vercel --prod`.
3. Público en `/agenda/salud-san-fernando`. Subdominio propio: mapear en Vercel.

## Pendiente antes de producción real
- Reemplazar profesionales/horarios placeholder por los reales de cada centro.
- Validar con la Secretaría qué especialidades requieren orden.
- Cambiar las contraseñas de los admin demo.
