# Demo en vivo — Reunión Secretaría de Salud San Fernando

Contraseña de todos los usuarios de demo: **SaludSF2026!**
Login (todos los roles): **`<TU-DOMINIO>/agenda/`** (o `http://localhost:5173/agenda/` si lo corrés local)

## Usuarios de demo
| Rol | Usuario | Qué mostrar |
|---|---|---|
| Admin general | `admin.general@saludsf.gob.ar` | Alta de centros, profesionales, servicios, agendas, usuarios, reportes |
| Recepción | `recepcion.demo@saludsf.gob.ar` | Gestión diaria de turnos y pacientes del día |
| Médico | `medico.demo@saludsf.gob.ar` | Agenda de la Dra. Valeria Sánchez + Historia Clínica |

> El usuario médico es la **Dra. Valeria Sánchez** (Clínica Médica, Centro Reinecke). Tiene 3 turnos cargados
> (María López, Jorge Fernández, Ana Gómez) y la HC de **María López ya viene cargada** (motivo, diagnóstico,
> indicaciones) para mostrar la historia clínica funcionando.

## URLs (reemplazar <TU-DOMINIO> por tu dominio de Vercel; local = http://localhost:5173)
- **Reservas (vecino):** `<TU-DOMINIO>/agenda/salud-san-fernando`
- **Login de usuario (staff):** `<TU-DOMINIO>/agenda/`
- **Llamador de sala de espera:** `<TU-DOMINIO>/agenda/pantalla/salud-san-fernando`
- **Tótem de autogestión:** `<TU-DOMINIO>/agenda/totem/salud-san-fernando`
- (Admin: `/agenda/admin` · Recepción: `/agenda/recepcion` · Médico: `/agenda/medico` — se llega también logueándose)

## Guion sugerido (10-12 min)
1. **Vecino saca un turno** en `/agenda/salud-san-fernando`: elegir centro → especialidad (mostrar el gate de
   orden médica) → día/hora → datos → confirmación con código.
2. **Recepción**: login → ver el turno recién sacado en la agenda del día.
3. **Médico**: login como Dra. Valeria → su agenda → abrir a **María López** → mostrar la **Historia Clínica**
   cargada (y que puede editar/agregar).
4. **Admin**: mostrar el panel (centros, profesionales, reportes).
5. **Pantallas de sala**: llamador y tótem.

## Cierre
Dejar la **Propuesta (PDF)** impresa o enviada por mail. Pedir: profesionales/horarios reales, política oficial
de qué requiere orden, y manual de marca del Municipio.
