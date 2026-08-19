# Turnos Salud San Fernando — Documento de decisión y relevamiento

**Proyecto:** Sistema de autogestión de turnos multi-centro para los Centros de Salud del Municipio de San Fernando (donado / impacto social + caso de referencia).
**Plataforma base:** Praxis Agenda (Supabase `xuwkxelrcglstvisbcnk`).
**Estado:** Preparación / propuesta. Sin reunión ni aprobación formal todavía.
**Fecha:** 13/08/2026

---

## 1. Resumen ejecutivo

Este documento cubre los tres puntos que pediste antes de tocar código:

1. **Arquitectura** — recomendación sobre cómo montar el proyecto sobre Praxis Agenda.
2. **Relevamiento real** de los 16 centros (dirección, teléfono, horario, especialidades, y si van o no a turnos online), sacado de las fichas oficiales del sitio del municipio.
3. **Identidad visual** institucional, partiendo del branding real de San Fernando.

Además incluyo dos cosas que aparecieron en el análisis y conviene definir temprano: (a) el **texto "sin orden"** redactado, y (b) un **problema de diseño del flujo de la orden médica** que, si no lo resolvemos, genera una contradicción para el vecino.

**Recomendación en una línea:** modelar los 16 centros como **un solo tenant "Salud San Fernando" con 16 *locations***, arrancar el piloto **sobre la instancia actual** con subdominio y tema institucional propios, y **graduar a instancia dedicada** recién cuando haya aprobación formal y datos reales de vecinos en producción.

---

## 2. Decisión de arquitectura

Conviene separar la decisión en **dos preguntas distintas**, porque se suelen mezclar y no son lo mismo:

- **A. Modelo de datos:** ¿los centros son *locations* de una organización, u organizaciones separadas?
- **B. Hosting/aislamiento:** ¿corre en la instancia actual (mismo proyecto Supabase + deploy), o en una instancia dedicada?

### 2.A — Modelo de datos: 1 organización con 16 locations

La plataforma ya tiene la tabla `locations` (una organización → muchas ubicaciones) y los `professionals` ya llevan `location_id`. Eso encaja casi directo con "16 centros bajo un mismo organismo".

| Opción | A favor | En contra |
|---|---|---|
| **1 org + 16 locations** *(recomendada)* | Puerta de entrada única natural (un solo slug/portal que lista los 16 centros). Reporting consolidado trivial para la Secretaría. Branding y configuración una sola vez. Refleja la realidad: un organismo, muchas sedes. | `services` hoy es a nivel organización, no location → hay que derivar "qué ofrece cada centro" vía los profesionales de ese centro, o agregar vínculo servicio↔location. El staff no se puede scopear por centro sin agregar `assigned_locations`. |
| **16 organizaciones** | Aislamiento limpio por centro; recepción de cada centro scopeada sola (el RLS por org ya funciona). Especialidades y profesionales por centro sin ambigüedad. | Rompe el "elegí tu centro" como front-door: igual hay que construir un portal aparte que liste y rutee a 16 páginas. Configuración y branding ×16. Reporting cruzado necesita rol `globaladmin`/`assigned_orgs`. Mucha fricción para un organismo único. |
| **Instancia separada (fork)** | Aislamiento total. | Sin reuso; dos bases de código que divergen. Ver 2.B — esto es decisión de hosting, no de modelo. |

**Recomendación: 1 organización con 16 locations.** Es la que mejor sirve al flujo obligatorio (centro primero) y al reporting único. Requiere dos agregados de esquema, moderados:

1. **Disponibilidad de servicio por centro.** Opción liviana: derivarla de `professionals` (un servicio se ofrece en un centro si hay un profesional de ese centro vinculado al servicio vía `professional_services`). Opción prolija: tabla puente `service_locations`. Para el piloto alcanza la derivación.
2. **(Opcional) Staff scopeado por centro** (`assigned_locations`) si la Secretaría quiere que cada recepción vea solo su centro. Para el piloto se puede vivir con acceso a nivel organismo.

### 2.B — Hosting: instancia actual ahora, dedicada después

| Opción | A favor | En contra |
|---|---|---|
| **Instancia actual (mismo proyecto)** *(recomendada para el piloto)* | Cero infra nueva; salís a validar rápido y gratis. Mismo código, mismo deploy. Ideal mientras el proyecto no está confirmado. | Datos de vecinos conviven con clientes comerciales en la misma DB. Acoplamiento de uptime: un incidente/migración de un cliente pago puede afectar al municipio y viceversa (blast radius). |
| **Instancia dedicada (Supabase + subdominio propios, MISMO repo)** *(recomendada al go-live formal)* | Aislamiento de datos apropiado para un organismo público. Uptime independiente. Y se vuelve **activo de venta**: "cada organismo público tiene su instancia dedicada, sus datos nunca se mezclan" — justo lo que van a preguntar futuros municipios/obras sociales. | Segundo proyecto Supabase + segundo deploy Vercel para mantener. Bajo, porque es el mismo repo con otras variables de entorno, no un fork. |

**Recomendación: "arrancá como tenant, graduá a instancia".** Hoy esto es preparación sin aprobación: montar un proyecto y deploy separados es overhead prematuro. Construílo como tenant nuevo en la instancia actual, con **subdominio propio** (p. ej. `turnos.sanfernando.gob.ar` o `turnossalud.praxisagenda.com`) y **tema institucional**. Cuando haya aprobación formal y vecinos reales cargando datos en producción, migrás a instancia dedicada: como el esquema es idéntico, es export/import de datos + apuntar el deploy a la nueva DB, **manteniendo una sola base de código** (multi-instancia, single repo). Lo mejor de los dos mundos: rápido ahora, aislado cuando importa.

> **Punto clave que no depende de la arquitectura:** el **portal de selección de centro**, el **gate de orden médica** y el **tema institucional** hay que construirlos igual, elijas lo que elijas. No son un diferencial entre opciones — son trabajo nuevo en cualquier escenario.

---

## 3. Flujo del vecino (y un problema a resolver en el gate de la orden)

Flujo pedido: (1) entra → (2) elige centro → (3) elige especialidad **pero antes se le pregunta si tiene la orden** → (4) fecha y hora → (5) datos → (6) confirmación.

**Problema de diseño detectado en el paso 3:** si el gate de la orden es *universal* (se pide para cualquier especialidad), se genera una paradoja. El "médico de cabecera" que emite la orden **es**, en estos centros, la Clínica Médica / Medicina Familiar / Pediatría. Es decir: para conseguir la orden, el vecino necesita sacar turno con Clínica… pero si el sistema le exige la orden *también* para Clínica, nunca puede entrar.

**Recomendación:** el gate **no** debe ser universal, sino **por servicio**. Agregar un flag `requiere_orden` a cada servicio y aplicar la pregunta **solo** a los servicios marcados:

- **Sin orden (puerta de entrada):** Clínica Médica, Medicina Familiar, Pediatría, Obstetricia/control, Enfermería, Vacunatorio, Farmacia. Estos son los que *generan* la orden.
- **Con orden (derivados/especialidades):** Traumatología, Nefrología, Nutrición, Kinesiología/Rehabilitación, especialidades odontológicas (Endodoncia, Ortodoncia), Radiología, Mamografía, Otoemisiones, Psicología, Fonoaudiología, Terapia Ocupacional, etc.

Cuando el vecino elige un servicio marcado y responde "no tengo la orden", se muestra el texto de la sección 4, que además lo **rutea** a sacar turno con su médico de cabecera en ese mismo centro. **Las reglas exactas de qué requiere orden son política clínica/administrativa de la Secretaría de Salud** — esta lista es una propuesta a validar con ellos, no un dato oficial.

---

## 4. Texto "sin orden médica" (redactado)

Tono de salud pública, claro y amable, sin jerga. Propongo esta versión (y una variante corta para pantallas chicas):

> ### Para este turno necesitás una orden de tu médico de cabecera
>
> La especialidad que elegiste requiere que primero te vea tu **médico de cabecera**. Él o ella evalúa tu situación y, si corresponde, te da la **orden** para acceder a esta atención.
>
> **¿Qué hacés ahora?**
> Sacá un turno con tu médico de cabecera en este mismo centro de salud. Es gratuito, como todos los turnos. Cuando tengas la orden, volvés y reservás la especialidad sin problema.
>
> [ **Sacar turno con mi médico de cabecera** ]  [ Volver ]
>
> *¿Ya tenés la orden en mano? Elegí "Sí, tengo la orden" para continuar.*

**Variante corta (mobile):**

> **Necesitás la orden de tu médico de cabecera.** Para esta especialidad, primero te tiene que ver tu médico de cabecera y darte la orden. Sacá un turno con él/ella en este centro —es gratis— y después volvés a reservar. [ Sacar turno con mi médico de cabecera ]

**Texto de la pregunta-gate (paso 3):**

> **¿Tenés la orden de tu médico de cabecera para esta atención?**
> [ Sí, tengo la orden ]   [ No tengo la orden ]

---

## 5. Relevamiento de los 16 centros

Datos sacados de las fichas individuales oficiales (`sanfernando.gob.ar/.../centrosdesalud/...`). Línea de turnos actual: **0800 888 5566**, L–V 7 a 19 h.

| # | Centro | Dirección | Teléfono | Horario | ¿Turnos online? |
|---|---|---|---|---|---|
| 1 | Rehabilitación y Kinesiología | Besares 2172 | 11 7109 5732 | L–V 8–19 | **Sí** (12+ años; todo por derivación → requiere orden) |
| 2 | CeMAT – Dr. Pedro Di Matteo (Atención Temprana) | Sarmiento 3244 (e/ Suipacha y Ex Comb. J. Sánchez) | 11 7154 3950 | L–V 8–17 | **Sí** (niños 0–13; ingreso por evaluación/derivación) |
| 3 | Emergencias San Fernando (EMEF) | Carlos Casares y Entre Ríos | 107 / 0800 888 3633 | 24 h | **No** — guardia/ambulancias, no maneja turnos programados |
| 4 | Vacunatorio Municipal "San Fernando Centro" | Av. Avellaneda 1460 (e/ Lavalle y Belgrano) | 11 2732 8608 | L–V 8–17 | **Parcial** (ver nota) |
| 5 | Centro de Salud 31 "Dr. Carcagno" | Entre Ríos y Carlos Casares (Mil Viviendas) | 11 2732 8618 | L–V 8–17 | **Sí** |
| 6 | Villa Jardín | Guatemala 3069 | 11 2732 8590 | L–V 8–17 | **Sí** |
| 7 | Unidad de Diagnóstico Precoz N°27 | 25 de Mayo 2290 | 11 2732 8644 | L–V 8–18 | **Sí** |
| 8 | Odontológico Dr. Gálvez | Portugal 2276 (Santa Catalina) | 11 2732 8591 | L–V 8–17 | **Sí** |
| 9 | N°66 "Dr. Pietranera" | Balcarce 2950 (Fate) | 11 2732 8609 | L–V 8–17 | **Sí** |
| 10 | Absalón Rojas | Arroyo Felicaria, 2da Secc. de Islas | 11 2754 0109 (VHF canal 68) | L–V 9–15 | **Sí** (sede insular; contemplar logística de acceso) |
| 11 | Piaggi | Málaga y Garibaldi (Santa Catalina) | 11 2732 8612 | L–V 8–17 | **Sí** |
| 12 | María Isabel | Arenales 3200 | 4746 1941 | L–V 8–17 | **Sí** |
| 13 | Finochietto | Ruta 202 km 5,5 (San Jorge) | 11 2732 8583 | L–V 8–17 | **Sí** |
| 14 | Crisol | Martín Rodríguez y Tucumán (Crisol) | 11 2732 8605 | L–V 8–17 | **Sí** |
| 15 | Bertrés | Azcuénaga 1745 (Villa del Carmen) | 4714 6214 | L–V 8–17 | **Sí** |
| 16 | Reinecke | Alvear 600 (San José) | 11 2732 8603 | L–V 8–17 | **Sí** |

### Especialidades / servicios por centro

- **1. Rehabilitación y Kinesiología:** Kinesiología (Traumatológica, Geriátrica, Cardiovascular, Deportiva), Hidroterapia Traumatológica, RPG, Sesiones grupales (Obesidad, Diabéticos), Taller para Gestante.
- **2. CeMAT:** Pediatría, Psicología, Kinesiología, Odontología, Psicomotricidad, Fonoaudiología, Psicopedagogía, Terapia Ocupacional, Enfermería/Vacunación.
- **3. Emergencias:** ambulancias, historia clínica digital (24/7). *Fuera del alcance de turnos.*
- **4. Vacunatorio San Fernando Centro:** Clínica Médica, Enfermería, Farmacia, Vacunatorio, Zoonosis humana (mordeduras), Otoemisiones.
- **5. CeSAC 31 Carcagno:** Clínica Médica, Pediatría, Control de recién nacido, Obstetricia, Traumatología, Enfermería, Farmacia, Vacunatorio, Hisopado.
- **6. Villa Jardín:** Clínica Médica, Enfermería, Obstetricia, Pediatría, Farmacia, Vacunatorio.
- **7. UDP N°27:** Clínica Médica, Pediatría, Control de recién nacido, Internación abreviada pediátrica, Obstetricia, Nutrición, Radiología, Mamografía, Enfermería, Farmacia, Vacunatorio, IRAB.
- **8. Odontológico Gálvez:** Odontología General, Odontopediatría, Endodoncia, Ortodoncia, Enfermería, Farmacia, Vacunatorio.
- **9. N°66 Pietranera:** Clínica Médica, Pediatría, Enfermería, Nutrición, Farmacia, Vacunatorio, Salud Escolar.
- **10. Absalón Rojas:** Clínica Médica, Pediatría, Medicina Familiar (crónicos), Odontología, Psicología, Trabajo Social, Enfermería, Farmacia, Vacunatorio.
- **11. Piaggi:** Enfermería, Pediatría, Obstetricia, Control de recién nacido, Farmacia, Vacunatorio, IRAB.
- **12. María Isabel:** Clínica Médica, Pediatría, Control de recién nacido, Obstetricia, Nutrición, Odontología, Enfermería, Farmacia, Vacunatorio.
- **13. Finochietto:** Clínica Médica, Pediatría, Control de recién nacido, Obstetricia, Nutrición, Odontología, Enfermería, Farmacia, Vacunatorio, IRAB.
- **14. Crisol:** Clínica Médica, Ginecología, Obstetricia, Odontología, Pediatría, Nutrición, Enfermería, Farmacia, Vacunatorio, IRAB.
- **15. Bertrés:** Clínica Médica, Ginecología, Nefrología, Nutrición, Obstetricia, Odontología, Pediatría, Enfermería, Farmacia, Vacunatorio, IRAB.
- **16. Reinecke:** Clínica Médica, Pediatría, Obstetricia, Odontología, Enfermería, Farmacia, Vacunatorio.

### Notas de alcance sobre los servicios

- **Emergencias (3)** queda **fuera** del sistema de turnos: es guardia 24/7.
- **Farmacia, Vacunatorio y Enfermería** suelen ser **demanda espontánea (sin turno)**. Sugiero **no** ofrecerlos como turnables por defecto, o mostrarlos solo informativamente ("se atiende por orden de llegada"). A confirmar con la Secretaría.
- **IRAB** es un programa estacional (jun–ago), no una especialidad turnable.
- **CeMAT (2)** y **Rehabilitación (1)**: el ingreso es por evaluación/derivación → prácticamente todo requiere orden.
- **Absalón Rojas (10)**: sede insular con horario reducido (9–15) y comunicación por VHF; contemplar disponibilidad y logística particular.

> **Pendiente de la Secretaría:** por cada centro/servicio necesitamos los **profesionales reales, sus días/horarios y la duración del turno**. Las fichas oficiales listan especialidades pero no agenda. Sin eso no se puede generar disponibilidad real.

---

## 6. Identidad visual institucional

### Hallazgo importante

El branding real del municipio **no es azul/blanco**. Los colores institucionales de San Fernando son **verde lima + magenta** sobre casi-negro:

| Rol | Color | Hex |
|---|---|---|
| Verde institucional (identidad) | Sushi | `#8CC63F` |
| Magenta institucional (acento) | Cerise | `#E63784` |
| Casi negro (texto/base) | Cod Gray | `#161616` |

*(Fuente: activos de marca del dominio sanfernando.gob.ar. Conviene igualmente pedir el **manual de marca oficial** al contacto municipal antes de congelar la paleta.)*

### Problema de accesibilidad y cómo lo resolvemos

El verde `#8CC63F` y el magenta `#E63784` son **colores de marca vibrantes pero de bajo contraste** para texto o botones con texto blanco (no pasan WCAG AA). Para un público de todas las edades y baja destreza digital, la accesibilidad manda. Propuesta: **usar los colores de marca como identidad/acento, y versiones oscurecidas de alto contraste para lo interactivo.**

**Paleta funcional propuesta (accesible, WCAG AA):**

| Uso | Color | Hex |
|---|---|---|
| Identidad / franjas de marca | Verde San Fernando | `#8CC63F` |
| **Acción primaria** (botones) — verde oscurecido para contraste | Verde acción | `#3F7D1E` |
| Acento secundario (usado con moderación) | Magenta | `#E63784` |
| Texto principal | Casi negro | `#161616` |
| Texto secundario | Gris | `#555B62` |
| Fondo | Blanco | `#FFFFFF` |
| Fondo suave / tarjetas | Gris muy claro | `#F4F6F4` |
| Éxito / confirmación | Verde | `#2E7D32` |
| Error / atención | Rojo | `#C62828` |

### Tipografía

- **Recomendada: Inter** (o **Source Sans 3** como alternativa) — sans-serif de máxima legibilidad, gratuita, excelente en pantalla y en tamaños grandes.
- **Base 18 px** (no 16), interlineado holgado, jerarquía clara.
- Botones grandes (mín. 48 px de alto), un CTA por pantalla, textos cortos, cero jerga técnica.

### Principios de UI institucional

Nada de estética "SaaS premium/beauty". Alto contraste, mucho aire, pasos numerados visibles, lenguaje simple, iconos con etiqueta de texto (no solo icono), foco visible para teclado, y todo el flujo usable en un celular gama baja. Nombre de trabajo: **"Turnos Salud San Fernando"** (a validar con el municipio).

---

## 7. Próximos pasos y decisiones pendientes

**Decisiones que dependen de vos:**

1. Confirmar modelo de datos: **1 org + 16 locations** (recomendado) vs. 16 orgs.
2. Confirmar hosting: **instancia actual con subdominio** ahora + graduación a instancia dedicada al go-live (recomendado).
3. Confirmar el enfoque del **gate de orden por servicio** (flag `requiere_orden`) en vez de universal.

**Pendiente de la Secretaría de Salud (no lo tenemos y es bloqueante para cargar datos reales):**

- Manual de marca oficial (para congelar paleta/tipografía).
- Por centro: profesionales, agenda (días/horarios), duración de turno.
- Política oficial de qué servicios requieren orden y cuáles no.
- Qué servicios se atienden por demanda espontánea (fuera de turnos).
- Confirmar exclusión de Emergencias y el tratamiento de Farmacia/Vacunatorio/Enfermería.

**Cuando confirmes 1–3, el siguiente entregable sería:** un prototipo navegable del portal (selección de centro → gate de orden → especialidad → fecha/hora → datos → confirmación) con el tema institucional aplicado, para mostrarle al contacto municipal.
