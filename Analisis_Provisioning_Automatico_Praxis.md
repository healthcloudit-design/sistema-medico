# Praxis Agenda: de "creamos tenants a mano" a "self-serve estilo Wix"
### Análisis crítico — arquitectura, riesgos y roadmap

---

## Veredicto en una frase

La visión es correcta y el mercado existe (Booksy y Fresha son, literalmente, esta misma idea aplicada a salones y clínicas). Pero el flujo que describís es el 20% visible del problema. El 80% invisible —aislamiento de datos a prueba de fallos, prevención de abuso, cobro antes de aprovisionar, y el hecho de que "reserva" no significa lo mismo para un odontólogo que para un hotel— es donde esto se rompe si se apura. No es una mala idea; es una idea que está pidiendo saltearse una etapa.

Y tengo evidencia de primera mano de por qué digo esto: en esta misma sesión, haciendo *manualmente* (con SQL directo) el alta de 3 recepcionistas para un solo tenant, aparecieron dos bugs reales — uno de permisos (un admin de organización no podía resetear contraseñas de su propio equipo) y uno de datos (columnas `NULL` en `auth.users` que rompían el login silenciosamente). Si crear 3 usuarios a mano ya produjo dos fallas distintas, automatizar la creación completa de un tenant (org + usuarios + servicios + horarios + branding + storage) sin ese control humano de por medio multiplica esa superficie de error, justo en el momento en que menos control tenés sobre quién la dispara.

---

## 1. ¿Es técnicamente viable?

Sí, sin duda. No es territorio inexplorado: Wix, Shopify, Calendly-for-teams, y sobre todo **Booksy** y **Fresha** (que son el mismo vertical: booking SaaS self-serve para salones, spas y clínicas) ya operan así en producción, a gran escala. El patrón es viable y probado.

Lo que hay que separar es "viable" de "trivial". La parte mecánica (generar filas en la base, aplicar un logo, mostrar una URL) es relativamente simple. La parte difícil es todo lo que rodea a eso: que un tenant nuevo no pueda ver datos de otro, que un usuario que no paga no pueda generar 500 tenants de spam, que un dentista y un hotel no terminen forzados en el mismo modelo de datos. Esa parte es la que normalmente se subestima, y es exactamente la que tu producto todavía no tiene resuelta.

## 2. Arquitectura recomendada

Mantené lo que ya tenés de base —una sola base Postgres con aislamiento por `organization_id` vía RLS— porque es la elección correcta para esta etapa. Lo que falta construir alrededor:

Primero, **una función de aprovisionamiento única, transaccional e idempotente**, que reemplace todo el SQL manual que hice esta sesión. Hoy la creación de un tenant es una secuencia de pasos sueltos (insertar organización, crear usuarios en `auth.users`, vincular perfiles, cargar servicios, horarios) que un humano ejecuta y corrige sobre la marcha si algo falla. Eso tiene que convertirse en un solo job del lado del servidor que use las Admin APIs de Supabase (no INSERTs directos a `auth.users`, que es justamente lo que causó el bug del login roto), con estados explícitos (`pendiente → creando_org → creando_admin → cargando_defaults → listo / fallido`) para poder reintentar o revertir sin dejar tenants a medio crear.

Segundo, **separar "definición de plantilla" de "instancia de organización"** como entidades de primera clase (más detalle en el punto 6), en vez de que el theming siga viviendo como columnas sueltas (`primary_color`, `cover_image_url`) con fallbacks dispersos en cada componente (así está hoy en `PremiumBookingFlow`, con `org.primary_color ?? ctx.accentHint`).

Tercero, diseñá la resolución de tenant (qué organización corresponde a esta request) para que pueda leer tanto de la URL/path como eventualmente del hostname. Hoy resolvés todo por slug en el path (`/agenda/:slug`), lo cual es correcto y barato para esta etapa, pero si más adelante querés subdominios o dominios propios por cliente (lo esperable en una experiencia "tipo Wix"), no querés tener que reescribir el resolver de cero.

## 3. ¿Single database o database por tenant?

Single database con RLS, sin dudarlo, a esta escala. Database-per-tenant recién se justifica cuando aparece un cliente enterprise que exige aislamiento físico de datos o residencia de datos por contrato (por ejemplo, una cadena de clínicas grande, o un requisito regulatorio puntual) — y ahí generalmente migrás *ese* tenant puntual, no todos. Antes de eso, base por tenant solo te suma un problema operativo enorme: migraciones que correr contra N bases, límites de conexión, backups y restores que se vuelven una pesadilla logística mucho antes de que el volumen de datos lo justifique.

Dicho eso, con RLS hay un costo real que hay que vigilar: cada policy es un predicado que se evalúa en cada query. A cientos o miles de tenants, la indexación sobre `organization_id` en cada tabla deja de ser opcional — es lo primero que rompe performance si no está bien cubierto.

## 4. ¿Qué parte del flujo automatizar primero?

La creación de organización + usuario admin + branding default — exactamente lo que hice a mano en esta sesión para Bicentenario. Es el tramo de mayor retorno porque: (a) hoy es puro trabajo manual tuyo/mío sin ningún beneficio de producto, (b) automatizarlo no expone nada nuevo a usuarios externos — sigue detrás de un superadmin — así que el riesgo es bajo, y (c) te obliga a construir y probar el motor de aprovisionamiento *antes* de sacarle el gate humano de encima, que es el paso realmente riesgoso.

## 5. ¿Qué tan compleja es la generación automática de tenants?

Más de lo que parece a simple vista. No es un INSERT: es una orquestación entre `auth.users`, `auth.identities`, `profiles`, `organizations`, servicios por defecto, horarios por defecto, y objetos en storage para los assets de marca — y ya vimos, en esta misma sesión, que ese camino falla de formas no obvias (el bug de permisos en el reset de contraseña, y el bug de `NULL` en columnas de `auth.users` que rompía el login sin ningún error visible en el momento de la creación). A escala de "tenant completo" en vez de "un usuario más", esa superficie de fallo crece proporcionalmente. La única forma sensata de manejarlo es con un job transaccional con verificación automática al final (por ejemplo, un smoke test que intente loguearse con el usuario admin recién creado antes de marcar el tenant como "listo"), no con SQL disparado y asumido como exitoso.

## 6. ¿Cómo implementarías el sistema de templates?

Como entidades separadas de la organización: una tabla `templates` (id, nombre, categoría, `layout_config` en jsonb, `default_theme` en jsonb, imagen de preview) que las organizaciones referencian mediante `template_id`, con overrides propios encima. El componente de landing/reserva debería resolver un único objeto de tema mezclando defaults de la plantilla con los overrides del tenant — formalizando lo que hoy ya hacés de manera intuitiva pero informal (los `??` de fallback en `PremiumBookingFlow`) en un resolver de tema real y centralizado, en vez de lógica repetida componente por componente.

## 7. ¿Cómo almacenarías temas, colores, logos y branding?

Los assets (logos, imágenes de portada) ya tienen el lugar correcto: Supabase Storage con un bucket/prefix por organización — la migración `org_assets_storage` que ya existe en tu proyecto va en la dirección correcta, seguí por ahí. Para colores y configuración de tema, migrá de columnas sueltas a un campo `theme` en jsonb (o una tabla `organization_themes` aparte) — así podés agregar tipografía, radios de borde, espaciados, etc. más adelante sin migraciones de esquema cada vez que se te ocurre una propiedad nueva de branding.

## 8. ¿Cómo escala esto a cientos o miles de tenants?

El modelo single-DB + RLS aguanta ese volumen para este tipo de carga (datos de reservas de negocios chicos no son pesados) siempre que: los índices por `organization_id` estén auditados en todas las tablas, el pooling de conexiones esté bien dimensionado, y los jobs recurrentes (vi en los logs que `send-reminders` corre aproximadamente cada hora) estén diseñados para iterar de forma eficiente por tenant, no escanear todo secuencialmente. Los assets estáticos escalan casi gratis vía Storage + CDN. El cuello de botella real a esa escala no va a ser la base de datos — va a ser operativo: soporte, moderación de abuso, y la reputación de envío si todos los tenants comparten el mismo remitente de WhatsApp/email (a miles de tenants enviando desde una sola identidad, el riesgo de que te bloqueen el canal completo por el mal comportamiento de un solo tenant es real).

## 9. Riesgos que veo — sin filtro

**Seguridad/aislamiento.** Ya encontramos y corregimos una fuga de datos entre tenants en las políticas RLS de admin en esta misma implementación (tarea completada #5). Hoy, que cada tenant lo crees vos a mano, actúa como una red de seguridad accidental: cualquier caso raro lo detectás vos antes de que impacte a un cliente real. Sacar ese gate humano es exactamente el momento en que un bug de RLS latente deja de ser un hallazgo interno y pasa a ser una filtración de datos de pacientes entre clínicas distintas.

**El trigger `handle_new_user` es una bomba de tiempo para self-signup.** Lo vimos en la auditoría de seguridad: si no se especifica un rol, el trigger asigna `role = 'admin'` por default, y no asigna `organization_id`. Tu flujo propuesto tiene un paso explícito de "Crea su cuenta" (self-signup). Si eso se habilita hoy tal cual está, cualquiera que se registre puede terminar con un perfil admin sin organización — el escenario de escalamiento de privilegios que la auditoría ya marcó como riesgo, pero ahora con una puerta de entrada pública en vez de hipotética.

**No es "hacer un sitio web", es aprovisionar un responsable de datos de salud.** Wix no tiene que preocuparse por si el usuario final está cargando datos clínicos de pacientes. Vos sí — varias de las categorías que proponés (consultorio médico, odontología, psicología, kinesiología) manejan datos de salud, que en Argentina caen bajo la Ley de Protección de Datos Personales con protecciones reforzadas. Un flujo 100% self-serve, sin ningún tipo de verificación, para entidades que van a cargar historia clínica de terceros, es una responsabilidad legal distinta a la de un generador de sitios genérico. Esto no significa que no se pueda hacer self-serve — significa que el "sin fricción, 5 minutos, cero contacto humano" necesita al menos un checkbox de términos + responsable de tratamiento de datos, y probablemente convenga arrancar el self-serve real por verticales *sin* datos de salud (barbería, estética, canchas) antes que por las clínicas.

**Sin monetización, self-serve es una invitación a spam.** No until ahora vi evidencia de un sistema de cobro/suscripción. Self-serve sin pago de por medio significa tenants infinitos gratis, costo de infraestructura sin techo, y cero filtro contra bots o cuentas basura.

**El alcance de rubros es más amplio de lo que el modelo de datos actual soporta.** Tu esquema actual (profesional + servicio + horario + turno de duración fija) está modelado para negocios de "franja horaria con un profesional" — un consultorio médico, un odontólogo, una peluquería. Un hotel no reserva franjas horarias, reserva *noches* contra un inventario de habitaciones. Un salón de eventos no repite turnos, vende *una* reserva grande con seña y catering. Una cancha deportiva reserva contra inventario de canchas/horarios, no contra un profesional. Meter estos tres modelos de reserva estructuralmente distintos bajo la misma plantilla de "servicio + profesional + turno" no es un tema de diseño de UI — es forzar rubros completamente distintos a encajar en un esquema que no fue pensado para ellos.

**La automatización de dominio/subdominio se subestima siempre.** Recién pasamos por el ejercicio de montar una sola app bajo un path (`/agenda`) en un dominio compartido, y no fue trivial (bases de Vite, rewrites de Vercel, assets rotos). Una experiencia "tipo Wix" real normalmente promete subdominio propio (o dominio propio) por tenant — eso es DNS wildcard, automatización de certificados SSL, y flujos de verificación de dominio. Es un proyecto de ingeniería aparte, no una casilla más en el wizard.

## 10. ¿Qué haría diferente?

No perseguiría "5 minutos, cualquier rubro" como objetivo de v1. Apuntaría a "5 minutos" para **un solo vertical que ya servís bien** — negocios de franja horaria con un profesional (médico, odontología, psicología, kinesiología, nutrición, estética, spa, barbería) — con un wizard que primero está gateado por vos (superadmin), no público. Eso te saca el trabajo manual de encima (el dolor real de hoy) sin exponer nada a usuarios externos todavía. Recién after eso probado, agregaría cobro obligatorio antes de habilitar el self-serve público (filtra abuso y valida si alguien realmente paga por esto). Los rubros estructuralmente distintos (hoteles, canchas, salones de eventos) los trataría como una segunda línea de producto con su propio modelo de datos, no como una plantilla más del wizard actual.

---

## Entorno de laboratorio / sandbox

Sí, lo recomiendo, y lo haría *antes* de tocar la plataforma principal. Con `tenant-demo-001`, `tenant-demo-002`, etc. podés validar el pipeline completo de aprovisionamiento automático sin arriesgar datos reales de clínicas que ya están operando (como Bicentenario o Clínica del Este).

**Ventajas:** aísla el radio de impacto de bugs del motor de aprovisionamiento (no corrompe tenants reales ni dispara envíos de WhatsApp/email a números reales por accidente); te da un lugar seguro para iterar rápido sobre templates y generación de branding sin miedo a romper producción; y es el lugar correcto para simular carga (cientos de tenants falsos) y medir de verdad el punto 8 (performance con volumen) en vez de asumirlo.

**Desventajas:** es un ambiente más para mantener — si es un proyecto de Supabase separado, tenés migraciones que mantener sincronizadas entre sandbox y producción, con el riesgo de que diverjan con el tiempo. También existe el riesgo de "sandbox miente": las pruebas pasan ahí pero la configuración de producción difiere en algo (variables de entorno, extensiones instaladas, políticas RLS) y el bug aparece recién en el pasaje a real. Y no replica automáticamente las características de carga de producción — si querés probar "miles de tenants" de verdad, tenés que sembrar ese volumen artificialmente, lo cual también lleva trabajo.

Mi recomendación concreta: usar un **branch de Supabase** separado (la herramienta que ya tenés disponible para esto) en vez de un proyecto completamente aparte — te da el aislamiento que necesitás para probar sin el costo de mantener una segunda base de migraciones divergente a mano. Promové a producción el *código* de aprovisionamiento validado en el sandbox, nunca los datos de prueba.

---

## Roadmap realista

**Fase 0 — Fundamentos (semanas).** Corregir el trigger `handle_new_user` para que nunca asigne `admin` por default sin organización. Consolidar toda la creación de tenants en una única función transaccional usando las Admin APIs (no SQL manual). Auditar índices sobre `organization_id` en todas las tablas. Formalizar el branding actual como un campo `theme` en jsonb.

**Fase 1 — Wizard gateado (1-2 meses).** Construir el wizard de creación de tenant, pero detrás de tu propio login de superadmin — reemplaza el trabajo manual de esta sesión, no todavía expuesto a clientes.

**Fase 2 — Sandbox (en paralelo a la fase 1, o inmediatamente después).** Branch de prueba con tenants demo, validando creación automática, branding, generación de landing y aprovisionamiento de usuarios de punta a punta, incluyendo un smoke test de login automático post-creación.

**Fase 3 — Self-serve gateado (2-4 meses).** Self-serve real pero con aprobación manual o cobro obligatorio desde el primer momento, limitado a los rubros que ya encajan en tu modelo de datos actual (franja horaria + profesional).

**Fase 4 — Escala y nuevos verticales (6-12+ meses).** Automatización de subdominio/dominio propio, expansión a rubros con modelo de reserva distinto (hoteles, canchas, salones) como línea de producto separada con su propio esquema de datos, no como plantilla adicional del wizard actual.
