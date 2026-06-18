## Imported Claude Cowork project instructions

MVP – Sistema de Turnos Online Autogestionado
Centro Medico | Especificación Técnica v1.0

ACTÚA COMO ARQUITECTO DE SOFTWARE SENIOR Y LEAD FULL-STACK ENGINEER
Quiero que diseñes y construyas un MVP funcional de producción para un sistema de turnos online autogestionado para un centro médico multiespecialidad.
Stack Tecnológico Obligatorio
Frontend:
React
TypeScript
TailwindCSS
React Router
React Query (TanStack Query)
React Hook Form
Zod
Backend:
Supabase
PostgreSQL
Auth
Row Level Security (RLS)
Realtime
Storage
Edge Functions
Vercel para despliegue

OBJETIVO
Generar una solución full-stack real.
NO quiero:
pantallas mockeadas
datos ficticios permanentes
componentes sin integración
pseudocódigo
QUIERO:
arquitectura real
esquema SQL completo
políticas RLS
migraciones
lógica de negocio
transacciones
estructura de carpetas
código listo para implementar

ENTREGABLES OBLIGATORIOS
La respuesta debe estar organizada exactamente en el siguiente orden.
1. Arquitectura General
Explicar:
arquitectura frontend
arquitectura backend
flujo de autenticación
flujo de reserva
flujo de historia clínica
flujo administrativo
Incluir diagramas Mermaid.

2. Modelo de Dominio
Generar:
entidades
relaciones
cardinalidades
Incluir:
ERD en Mermaid
explicación de decisiones de diseño

3. Esquema SQL Completo
Generar:
CREATE TABLE
PRIMARY KEY
FOREIGN KEY
índices
UNIQUE constraints
CHECK constraints
No omitir tablas.
Utilizar:
UUID
timestamps UTC
soft delete cuando corresponda

4. Estrategia Anti Doble Reserva
Diseñar una solución robusta para concurrencia.
Debe incluir:
transaction
locking
constraints
validación backend
Explicar exactamente:
qué ocurre si dos pacientes reservan simultáneamente
cómo se evita el doble booking
Debe implementarse en PostgreSQL y Supabase.

5. Supabase Auth + RBAC
Diseñar:
profiles
roles
claims
autorización
Roles:
paciente público
medico
recepcion
admin
superadmin
Explicar flujo completo de autenticación.

6. Políticas RLS
Generar SQL completo para:
Médico
Puede acceder únicamente a:
sus turnos
sus disponibilidades
historias clínicas permitidas
Recepción
Puede:
ver turnos globales
gestionar agenda
gestionar pacientes
Superadmin
Acceso total.
Público
Solo puede crear reservas mediante flujo controlado.
Generar código SQL de policies.

7. Edge Functions y RPC
Definir:
createAppointment()
Debe:
validar disponibilidad
crear paciente si no existe
crear historia clínica si no existe
reservar slot
crear turno
generar auditoría
Todo dentro de una única transacción.
Si algo falla:
ROLLBACK completo.

8. API Contract
Definir:
Públicas
listarEspecialidades()
listarMedicos()
listarServicios()
listarFechasDisponibles()
listarHorariosDisponibles()
crearReserva()
Médico
obtenerDashboard()
obtenerAgenda()
obtenerHistoriaClinica()
crearEvolucion()
Administrativo
dashboardGlobal()
bloquearAgenda()
cancelarTurno()
reprogramarTurno()
Para cada endpoint especificar:
input
output
validaciones
errores

9. Estructura del Proyecto
Generar árbol completo.
Ejemplo:
src/
features/
components/
hooks/
services/
supabase/
functions/
policies/
migrations/
Explicar responsabilidad de cada módulo.

10. Diseño UI/UX
Diseñar:
Reserva Pública
selección especialidad
médico
servicio
fecha
horario
paciente
confirmación
Dashboard Médico
Dashboard Administrativo
Describir componentes y navegación.
Mobile-first obligatorio.

11. Plan de Implementación
Dividir el proyecto en fases.
Fase 1:
Base de datos
Fase 2:
Auth + Roles
Fase 3:
Reserva pública
Fase 4:
Dashboard médico
Fase 5:
Historia clínica
Fase 6:
Administración
Fase 7:
Realtime
Fase 8:
Testing

12. Testing
Generar:
unit tests
integration tests
RLS tests
concurrency tests
Incluir casos de doble reserva.

REQUISITOS DE CALIDAD
Actúa como si el sistema fuera a entrar en producción.
Prioriza:
escalabilidad
seguridad
trazabilidad
mantenibilidad
separación de responsabilidades
cumplimiento de buenas prácticas PostgreSQL
cumplimiento de buenas prácticas Supabase
Evita simplificaciones.
Justifica las decisiones arquitectónicas importantes.
Si existen varias alternativas válidas, explica ventajas y desventajas y luego selecciona una.
La solución debe quedar preparada para futuras extensiones:
pagos online
WhatsApp
email
recordatorios automáticos
múltiples sedes
múltiples consultorios
archivos clínicos
recetas digitales
firma digital
reportes operativos
métricas de negocio
No generes solamente wireframes o UI.
Genera una arquitectura full-stack real lista para desarrollo incremental y despliegue en producción.
