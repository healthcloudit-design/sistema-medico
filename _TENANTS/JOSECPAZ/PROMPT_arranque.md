# Proyecto: Sistema de turnos multi-centro para el Municipio de JOSÉ C. PAZ (Buenos Aires)

Quiero replicar, para el sistema de salud del Municipio de José C. Paz, EXACTAMENTE lo mismo que
ya construí para San Fernando (y repliqué para Tigre) sobre mi plataforma "Praxis Agenda".
Proyecto donado (impacto social + caso de referencia comercial), gratis para el vecino, sin pasarela
de pago. Fuente oficial: sitio del Municipio de José C. Paz (buscar josecpaz.gob.ar y su sección de Salud).

CONTEXTO: el miércoles a las 17 hs tengo reunión con un **concejal** de José C. Paz para presentarle
el sistema. O sea, la documentación/propuesta tiene que estar orientada a que el concejal lo impulse
y lo eleve a la Secretaría de Salud / Intendencia.

## Organización de archivos
- Los archivos propios del tenant van en: `C:\Dev\Claude\Sistema Medico\_tenants\JOSECPAZ\`
  (misma convención que los demás tenants dentro de `_tenants\`: MSF, TIGRE, etc.).
- El código de PLATAFORMA (reutilizable) NO va en `_tenants\`: vive en `src/` y `supabase/migrations/`.
- Ocupate SOLO de José C. Paz. No toques ningún otro tenant ni sus datos.

## Contexto de la plataforma (YA EXISTE, no rehacer)
- Repo: C:\Dev\Claude\Sistema Medico (React + TS + Tailwind + Vite + Supabase + Vercel).
- Producción: **platform.praxisoperativa.com**, app servida en base `/agenda`, tenant por SLUG: `/agenda/:slug`.
- Supabase: proyecto `xuwkxelrcglstvisbcnk` (usar el MCP; sacar la anon key con get_publishable_keys, no hardcodear).
- `/agenda/:slug` → `BookingFlow` → si `tenant_type='general'` renderiza
  `src/components/booking/MunicipalBookingFlow.tsx` (el flujo municipal reutilizable).
- Flujo del vecino ya implementado: hero → elegir centro → atención con GATE DE ORDEN MÉDICA POR SERVICIO
  (si `requiere_orden` y no la tiene, lo manda al médico de cabecera) → fecha/hora (disponibilidad real vía
  hook `useAvailability`) → datos → confirmación con código de turno.
- Reserva real por RPC `reservar_turno` (stampa organization_id y location_id desde el profesional). Firma:
  (p_professional_id, p_service_id, p_starts_at, p_patient_name, p_patient_phone, p_patient_email,
  p_patient_dni, p_patient_obra_social, p_patient_nro_socio, p_patient_notes).
- Migraciones ya aplicadas que sirven para CUALQUIER tenant 'general' (NO crear de nuevo):
  048 (columna services.requiere_orden) y 049 (lectura anónima de locations solo para tenants 'general').
  => José C. Paz queda cubierto por ser 'general'.

## PRIMER PASO: tema por tenant
El componente DEBE tomar los colores del tenant (de `org.primary_color` + un acento). Si todavía está
hardcodeado en verde San Fernando, parametrizá el tema primero SIN romper San Fernando ni Tigre, y usá para
José C. Paz la paleta oficial del municipio (buscarla del logo/sitio real; no inventar colores).
Ojo con un bug conocido: los subcomponentes (Shell, Back, etc.) DEBEN estar a nivel de módulo, nunca definidos
dentro del componente, o React re-monta los inputs y se pierde el foco al tipear.

## Relevamiento (investigar en el sitio oficial ANTES de cargar nada)
- Entrá al sitio del municipio y a las fichas de cada efector (CAPS / centros de salud / hospital municipal)
  y sacá: nombre, dirección, teléfono, horarios y especialidades de cada uno.
- Definí qué queda FUERA de turnos online (guardias/emergencias) y qué es demanda espontánea
  (Farmacia/Vacunatorio/Enfermería). Traeme una tabla antes de sembrar.

## Qué construir (mismo alcance que San Fernando)
1. Tenant en Supabase: org "Salud José C. Paz" (slug `salud-jose-c-paz`, tenant_type='general',
   primary_color = color oficial, timezone America/Argentina/Buenos_Aires) + locations (centros) + servicios
   por centro con `requiere_orden` bien clasificado (primaria = directo; derivadas = con orden; es PROPUESTA a validar).
2. 2 profesionales por especialidad/centro con agenda Lun-Vie dentro del horario del centro.
3. Usuarios: 1 admin general + 1 admin por centro + 1 recepción + 1 médico. El médico linkeado a un profesional
   que tenga turnos (profiles.professional_id). Activá `feature_hc=true` en el org y dejá una Historia Clínica
   ya cargada para un paciente del médico (así la demo muestra la HC real). Entregame user+clave de los 3 roles.
4. Disponibilidad de prueba + algunos turnos ocupados para la demo.
5. One-pager (PDF) + propuesta institucional (PDF) para presentar — en este caso dirigida/orientada al concejal
   que lo va a impulsar (pedime su nombre si hace falta).
6. Guardar todo lo del tenant en `_tenants\JOSECPAZ\` (docs, db, credenciales, logo, README).

## Pruebas (obligatorio, arreglar antes de seguir)
- tsc --noEmit y vite build limpios.
- E2E backend (rol anon, vía SQL/RPC): leer centros → servicios de un centro → `reservar_turno` (crea turno) y
  verificar doble-booking = slot_taken.
- Historia clínica: emular al médico (seteando su identidad bajo RLS) y confirmar que puede crear/actualizar/leer
  la HC de su paciente.
- E2E frontend (Playwright headless con network mockeado): home → centro → especialidad → gate → sin orden →
  cabecera → fecha/hora → datos → confirmación, con screenshots y 0 errores de consola. Incluir el test de foco
  (tipear char por char en buscador y teléfono sin perder el cursor).

## Entrega
- Escribir archivos al repo (device_commit_files), `git add` acotado SOLO a lo del tenant/código compartido
  (no `git add -A`, hay WIP propio), y comandos de push + deploy (rama feature → preview, merge a main → prod).
- URLs finales en producción:
  - Reservas: platform.praxisoperativa.com/agenda/salud-jose-c-paz
  - Login staff: platform.praxisoperativa.com/agenda/
  - Llamador: platform.praxisoperativa.com/agenda/pantalla/salud-jose-c-paz
  - Tótem: platform.praxisoperativa.com/agenda/totem/salud-jose-c-paz

Arrancá por: (1) revisar MunicipalBookingFlow.tsx y el tema por tenant, (2) investigar centros y branding de
José C. Paz, (3) proponerme el plan antes de sembrar la base.
