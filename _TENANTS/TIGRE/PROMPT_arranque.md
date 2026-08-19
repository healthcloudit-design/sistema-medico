# Proyecto: Sistema de turnos multi-centro para el Municipio de TIGRE (Buenos Aires)

Quiero replicar, para el sistema de salud del Municipio de Tigre, EXACTAMENTE lo mismo
que ya construí para San Fernando sobre mi plataforma "Praxis Agenda". Es un proyecto
donado (impacto social + caso de referencia comercial), gratis para el vecino, sin pasarela
de pago. Fuente oficial de datos: https://www.tigre.gob.ar/salud

## Organización de archivos (IMPORTANTE)
- Dentro de la carpeta del proyecto tengo `_tenants\`, y ahí adentro una carpeta por tenant
  con TODO lo exclusivo de cada uno (docs, imágenes, scripts de base, credenciales, README).
- Los archivos de ESTE tenant van en: `C:\Dev\Claude\Sistema Medico\_tenants\TIGRE\`
  (misma convención que uso para los demás tenants dentro de `_tenants\`).
- El código de PLATAFORMA (reutilizable) NO va en `_tenants\`: vive en `src/` y
  `supabase/migrations/` porque Vite compila desde ahí y sirve para todos los municipios.
- Ocupate SOLO de Tigre. No toques ningún otro tenant ni sus datos.

## Contexto de la plataforma (YA EXISTE, no rehacer)
- Repo: C:\Dev\Claude\Sistema Medico (React + TS + Tailwind + Vite + Supabase + Vercel).
- Supabase: proyecto `xuwkxelrcglstvisbcnk` (usar el MCP de Supabase; sacar la anon key con
  get_publishable_keys, no hardcodear).
- Multi-tenant por SLUG en la URL: `/agenda/:slug` → `BookingFlow` → si `tenant_type='general'`
  renderiza `src/components/booking/MunicipalBookingFlow.tsx` (el flujo municipal reutilizable
  que ya construí para San Fernando).
- El flujo del vecino ya está implementado ahí: hero → elegir centro → elegir atención con
  GATE DE ORDEN MÉDICA POR SERVICIO (si el servicio `requiere_orden` y el vecino dice que no
  la tiene, lo manda a sacar turno con su médico de cabecera) → fecha/hora (disponibilidad
  real vía hook `useAvailability` sobre `schedules`) → datos → confirmación con código de turno.
- Reserva real por RPC `reservar_turno` (stampa organization_id y location_id desde el
  profesional). Firma: (p_professional_id, p_service_id, p_starts_at, p_patient_name,
  p_patient_phone, p_patient_email, p_patient_dni, p_patient_obra_social, p_patient_nro_socio,
  p_patient_notes).
- Migraciones ya aplicadas que sirven para CUALQUIER tenant 'general' (NO crear de nuevo):
  - 048: columna `services.requiere_orden`.
  - 049: policy RLS que da lectura anónima de `locations` SOLO a tenants `tenant_type='general'`.
    => Tigre queda cubierto automáticamente por ser 'general'.

## PRIMER PASO OBLIGATORIO (antes de cargar datos): parametrizar el tema por tenant
Hoy `MunicipalBookingFlow.tsx` tiene la paleta HARDCODEADA en verde San Fernando
(ACCENT='#3F7D1E', magenta, etc.). Para reutilizarlo con la identidad de Tigre:
1. Leé el componente y sacá la paleta a que salga del registro del org (ej: `org.primary_color`
   como color principal + un acento secundario). San Fernando DEBE seguir viéndose igual
   (verde) — no romper ese tenant. Si hace falta, guardá los colores del tenant en la fila de
   `organizations` (primary_color) y deriva el resto en el componente, o agregá un pequeño mapa
   de tema por slug. Elegí la opción más limpia y explicámela.
2. Verificá que San Fernando (`/agenda/salud-san-fernando`) sigue verde y Tigre toma sus colores.

## Identidad visual de Tigre
- Revisá el sitio oficial (tigre.gob.ar) y el logo/manual de marca de Tigre para sacar la
  paleta REAL y una tipografía accesible. No inventes colores: usá los oficiales.
- Pedime/uso el logo oficial de Tigre (si no lo tengo, avisame y lo consigo; dejá el
  placeholder mientras tanto). Institucional, accesible, alto contraste, botones grandes.

## Relevamiento (investigar en el sitio oficial ANTES de cargar nada)
- Entrá a tigre.gob.ar/salud y a las fichas de cada efector (CAPS / centros de salud /
  hospitales municipales) y sacá: nombre, dirección, teléfono, horarios y
  especialidades/servicios de cada uno.
- Definí qué efectores quedan FUERA de turnos online (ej: guardias/emergencias) y qué
  servicios son demanda espontánea (Farmacia/Vacunatorio/Enfermería, etc.).
- Traeme el detalle en una tabla antes de sembrar.

## Qué construir (mismo alcance que San Fernando)
1. Crear el tenant en Supabase: org "Salud Tigre" (slug sugerido `salud-tigre`,
   tenant_type='general', primary_color = color oficial de Tigre, timezone
   America/Argentina/Buenos_Aires), + todas las locations (centros) + servicios por centro
   con el flag `requiere_orden` bien clasificado (primaria = acceso directo; especialidades
   derivadas = con orden). La clasificación de orden es PROPUESTA a validar con la Secretaría.
2. 2 profesionales por especialidad/centro, con agenda Lun-Vie dentro del horario del centro.
3. 1 admin por centro + 1 admin general (auth.users + profiles con organization_id + identities;
   contraseña demo; entregame la lista de credenciales). Aclarar que hoy el admin es a nivel
   organización (no por centro) hasta agregar scoping por sede.
4. Disponibilidad de prueba + algunos turnos ocupados para que la demo muestre huecos.
5. One-pager institucional (PDF, 1 carilla) para presentar a la Secretaría de Salud de Tigre.
6. Guardar TODOS los archivos propios del tenant en `C:\Dev\Claude\Sistema Medico\_tenants\TIGRE\`
   (docs, db, credenciales, logo, README que apunte al código compartido en src/ y supabase/).

## Pruebas (obligatorio, punto por punto, arreglar antes de seguir)
- tsc --noEmit y vite build limpios.
- E2E backend (como rol anon, vía SQL/RPC): leer centros → servicios de un centro → llamar
  `reservar_turno` (crea turno) y verificar que el doble-booking devuelve `slot_taken`.
- E2E frontend (Playwright headless con network mockeado, porque el sandbox no llega a Supabase):
  home → centro → especialidad → gate de orden → sin orden → cabecera → fecha/hora → datos →
  confirmación, con screenshots. Verificar 0 errores de consola.
- Test específico del bug de foco: tipear carácter por carácter en el buscador y en el teléfono
  y confirmar que el input NO pierde el foco (los subcomponentes DEBEN estar a nivel de módulo,
  nunca definidos dentro del componente, o React re-monta el input y se va el cursor).

## Entrega
- Escribir los archivos al repo (device_commit_files), dar el `git add` acotado SOLO a los
  archivos del tenant/código compartido (no `git add -A`, tengo WIP propio), y los comandos de
  push + deploy a Vercel (rama de feature → preview, merge a main → producción).
- URL pública final: `/agenda/salud-tigre`.

Arrancá por: (1) leer MunicipalBookingFlow.tsx y parametrizar el tema, (2) investigar centros y
branding de Tigre, (3) proponerme el plan antes de sembrar la base.
