# Auditoría de seguridad — PRAXIS
**Fecha:** 17 de julio de 2026
**Alcance:** Base de datos (RLS, funciones, storage) + código del repo (frontend, edge functions)
**Modalidad:** Solo diagnóstico — no se aplicó ningún cambio en esta pasada (a excepción de los fixes ya aplicados y confirmados en la sesión anterior: RLS de `services`, `professionals`, `schedules`, `professional_services`, `availability_blocks`, `profiles`, `organizations`).

Esta auditoría partió del bug de fuga de datos entre tenants que ya habíamos corregido en `services`/`professionals`/`profiles`/`organizations`. Al revisar el resto del sistema con el mismo criterio, aparecieron **hallazgos considerablemente más graves** en otras tablas y en el código. El más serio permite que cualquier usuario logueado se auto-otorgue el rol de superadmin.

---

## Resumen ejecutivo

| Severidad | Cantidad | Descripción general |
|---|---|---|
| Crítica | 2 | Escalación de privilegios total; PII de pacientes de todos los tenants expuesta |
| Alta | 4 | Historia clínica, archivos médicos y creación de usuarios con rol elevado |
| Media | 4 | Exposición de turnos/nombres cross-tenant, cancelación sin token real, assets de marca editables entre tenants, webhook de MP sin firma |
| Baja / buenas prácticas | 4 | Config de Supabase Auth, funciones sin `search_path` fijo, CORS abierto, tabla sin políticas |

---

## 🔴 Críticas

### 1. Cualquier usuario puede auto-asignarse el rol de superadmin
**Tabla:** `profiles` — policies `profiles_self_update` y `profiles_update_own` (ambas `UPDATE`, condición `id = auth.uid()`, sin restricción de columnas).

Cualquier usuario autenticado (un médico, una recepcionista, o incluso una cuenta creada por auto-registro si estuviera habilitado) puede ejecutar desde el cliente:

```js
supabase.from('profiles').update({ role: 'superadmin' }).eq('id', session.user.id)
```

Esto pasa el chequeo de RLS (la fila es la suya) y no hay trigger que valide qué columnas se pueden cambiar. El resultado: acceso total a todos los tenants, incluyendo poder crear/borrar organizaciones.

Además, `handle_new_user()` (el trigger que crea el perfil al registrarse) le asigna **`role = 'admin'` por default** si no se especifica rol — hay que confirmar en el dashboard de Supabase (Authentication → Providers) si el alta por email/password está habilitada; si lo está, cualquier persona podría registrarse sola y luego escalarse a superadmin con la consulta de arriba.

**Impacto:** total. Es la puerta de entrada a todo lo demás.

### 2. Datos de pacientes (PII) de todos los tenants visibles para cualquier usuario logueado
**Tabla:** `patients` — policy `admin_patients_select` (`SELECT`, rol `authenticated`, condición `true`).

Mismo patrón que ya corregimos en `services`/`professionals`: esta policy no filtra por organización y aplica a cualquier usuario autenticado, no solo admins. Expone nombre completo, teléfono, email, DNI y obra social de los pacientes de **todas** las clínicas del sistema. Convive con `patients_staff_all`, que sí está bien filtrada — pero al ser políticas permisivas, alcanza con que una lo permita.

---

## 🟠 Altas

### 3. Historia clínica, anamnesis, signos vitales y adjuntos médicos sin filtro de organización
**Tablas:** `clinical_records` (`staff_all_records`), `patient_anamnesis` (`staff_select_anamnesis`), `vital_signs` (`staff_select_vital_signs`), `appointment_attachments` (`staff_select_attachments`).

Las cuatro policies comparten el mismo defecto: chequean `get_my_role() = ANY(['admin','superadmin','recepcion'])` pero **nunca comparan la organización**. Cualquier admin o recepcionista de cualquier clínica puede leer (y en el caso de `clinical_records`, también editar) diagnósticos, indicaciones médicas, notas clínicas, respuestas de anamnesis, signos vitales y archivos adjuntos de pacientes de **otras** clínicas. Es el hallazgo más sensible en términos de datos de salud.

### 4. Bucket de storage `clinical-attachments` sin restricción por organización
Las policies `auth_read_clinical` / `auth_upload_clinical` / `auth_delete_clinical` solo chequean `auth.role() = 'authenticated'`, sin verificar a qué organización pertenece el archivo. Cualquier usuario logueado de cualquier tenant puede leer o borrar archivos clínicos adjuntos de otro tenant, si conoce (o adivina) la ruta.

### 5. Un admin de clínica puede crearse un usuario `superadmin`
**Archivo:** `supabase/functions/admin-create-user/index.ts`.

La función valida correctamente que el caller sea `admin` o `superadmin`, y fuerza la organización cuando el caller es `admin` (bien resuelto). Pero **no valida qué rol puede asignar** — toma `role` directo del body sin whitelist. Un admin de Bicentenario podría llamar a esta función pidiendo `role: 'superadmin'`, loguearse con esa cuenta nueva, y tener acceso total cross-tenant (rol global, no ligado a organización).

### 6. Webhook de WhatsApp sin verificación de firma de Twilio
**Archivo:** `supabase/functions/whatsapp-webhook/index.ts` (`verify_jwt: false`, público por diseño).

No valida el header `X-Twilio-Signature`. Cualquiera que conozca la URL de la function puede enviar un POST simulando un mensaje de WhatsApp (`Body=CANCELAR`, `From=<cualquier teléfono>`) y cancelar el próximo turno de esa persona — sin autenticación de ningún tipo, y la búsqueda de turno tampoco está acotada por organización (busca en toda la tabla `appointments` por teléfono).

---

## 🟡 Medias

### 7. Turnos del día visibles cross-tenant vía API directa
**Tabla:** `appointments` — policies `sala_espera_publica` (rol `anon`) y `disponibilidad_publica` (rol `public`, con `auth.uid() IS NULL` embebido en la condición, por lo que en la práctica ya está bien acotada a visitantes sin sesión). El problema de `sala_espera_publica` es que no filtra por organización: alguien que llame directo a la API REST con la anon key (pública, viene en el bundle del frontend) puede pedir los turnos de **todas** las clínicas de hoy — nombre de paciente, hora, profesional — no solo los de la que está mirando. La app normal nunca lo hace porque filtra por `organization_id` en el cliente, pero RLS es la barrera real, no el filtro del frontend.

### 8. Cancelación de turno sin validar el token real
**Tabla:** `appointments` — policy `cancelacion_publica_update`. La condición solo exige `cancellation_token IS NOT NULL` (verdadero en casi cualquier turno), no que el valor coincida con el token que se le mandó al paciente. Alguien que conozca el `id` de un turno (no el token) podría cancelarlo igual, llamando a la API directamente en vez de por la UI.

### 9. Logos y assets de marca editables entre tenants
**Storage:** buckets `logos` y `org-assets` — lectura pública (correcta, es contenido de las landing pages), pero escritura (`insert`/`update`/`delete`) abierta a cualquier usuario autenticado, sin chequear que el archivo pertenezca a su organización. Un usuario de un tenant podría sobrescribir o borrar el logo de otro.

### 10. Webhook de Mercado Pago sin verificación de firma
**Archivo:** `mp-webhook/index.ts`. No valida la firma de MP, pero sí vuelve a consultar el pago real contra la API de MP antes de actualizar el turno, lo que mitiga bastante el riesgo (un atacante no puede inventar un pago, solo forzar una relectura de un pago real existente). Igual, sería mejor práctica verificar la firma.

---

## ⚪ Bajas / buenas prácticas

- **Password protection (HaveIBeenPwned) deshabilitada** en Supabase Auth — activarla es gratis y reduce el riesgo de credenciales reusadas/filtradas.
- **Funciones con `search_path` mutable** (`get_my_role`, `get_my_org_id`, `crear_tenant`, etc.) — buena práctica es fijar `SET search_path = public` en cada función `SECURITY DEFINER` para evitar ataques de shadowing de esquema.
- **CORS `Access-Control-Allow-Origin: *`** en las edge functions de administración (`admin-create-user`, `admin-delete-user`, `admin-reset-password`). Bajo riesgo real porque usan Bearer token explícito (no cookies), pero no es buena práctica dejarlo abierto a cualquier origen.
- **Tabla `locations`** tiene RLS habilitado pero cero policies — en la práctica, ningún rol (ni anon ni authenticated) puede leerla ni escribirla vía API normal (solo el `service_role`, que es como está haciendo los inserts esta sesión). Si la app la necesita en algún flujo de usuario, hoy devolvería vacío. Si no se usa desde el cliente, no es un problema de seguridad, solo llama la atención.
- **`professional_questions`**: mismo patrón de falta de filtro por organización que los hallazgos altos, pero el dato expuesto (plantillas de preguntas de anamnesis) es de bajo valor/sensibilidad.
- **`crear_tenant`** es ejecutable por `anon` a nivel de permisos de Postgres, pero internamente valida `role IN ('superadmin','globaladmin')` y devuelve error si no — no es explotable, aunque sería más prolijo revocar el `EXECUTE` a `anon`/`authenticated` directamente.

---

## Qué NO llegué a revisar en profundidad

- El resto de los componentes del panel de administración (`AdminLayout.tsx`, `CentrosManager.tsx`, `Dashboard.tsx`, `OrgSettings.tsx`, `ReportsView.tsx`) línea por línea — vale la pena confirmar que ninguno asuma que "todo admin es superadmin" al armar sus queries, dado que ambos roles llegan a la misma ruta `/admin`.
- Rate limiting / protección anti-abuso en los endpoints públicos de reserva (`reservar_turno`, `crear_tenant` — este último ya vimos que está guardado igual).
- Configuración de Supabase Auth en el dashboard (si el alta por email está habilitada, políticas de sesión, etc.) — no es visible por SQL, hay que chequearlo manualmente.

---

## Recomendación de orden de arreglo

1. `profiles_self_update` / `profiles_update_own` (crítico — bloquea la escalación de privilegios; hay que decidir si se restringe por columna o se mueve la edición de `role`/`organization_id` a una función `SECURITY DEFINER` separada).
2. `admin_patients_select` + las 4 policies de historial clínico/anamnesis/signos vitales/adjuntos sin filtro de org.
3. Bucket `clinical-attachments`.
4. `admin-create-user`: whitelist de roles que un `admin` (no superadmin) puede asignar.
5. Firma de Twilio en `whatsapp-webhook`.
6. El resto de los hallazgos medios/bajos, sin apuro pero antes de sumar más tenants con datos reales.

Estoy para aplicar cualquiera de estos fixes ni bien me confirmes — dado lo crítico del punto 1, sugeriría arrancar por ahí incluso antes de la reunión de mañana si hay tiempo.
