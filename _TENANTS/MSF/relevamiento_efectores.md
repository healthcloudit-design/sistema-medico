# San Fernando — Relevamiento de efectores de salud (PROPUESTA, a validar)

**Fuente principal:** red de salud del Municipio de San Fernando (sanfernando.gob.ar) y datos cargados en el
tenant (`_tenants/MSF/db/01_seed_centros_servicios.sql`).
**Coordenadas del mapa:** OpenStreetMap y el normalizador de direcciones del Estado (Georef, apis.datos.gob.ar),
geocodificadas por dirección dentro del partido de San Fernando (06749).
**Nota:** especialidades por centro, horarios de atención y criterio de orden médica son PROPUESTA
(mismo criterio que Tigre / José C. Paz), a validar con la Secretaría de Salud.

## A. Turnos online — Centros de salud de atención primaria (11)
| # | Centro | Dirección | Teléfono | Lat, Lng |
|---|---|---|---|---|
| 1 | Centro de Salud y Vacunatorio Municipal San Fernando Centro | Av. Avellaneda 1460 | 11 2732 8608 | -34.449058, -58.550360 |
| 2 | Centro de Salud 31 Dr. Carcagno | Entre Ríos y Carlos Casares | 11 2732 8618 | -34.458648, -58.555615 |
| 3 | Centro de Salud Villa Jardín | Guatemala 3069 | 11 2732 8590 | -34.478821, -58.583289 |
| 4 | Centro de Salud N°66 Dr. Pietranera | Balcarce 2950 | 11 2732 8609 | -34.469955, -58.573887 |
| 5 | Centro de Salud Piaggi | Málaga y Garibaldi | 11 2732 8612 | -34.472621, -58.591794 |
| 6 | Centro de Salud María Isabel | Arenales 3200 | 4746 1941 | -34.456006, -58.568727 |
| 7 | Centro de Salud Finochietto | Ruta 202 km 5,5 | 11 2732 8583 | -34.465974, -58.595883 |
| 8 | Centro de Salud Crisol | Martín Rodríguez y Tucumán | 11 2732 8605 | -34.462048, -58.550913 |
| 9 | Centro de Salud Bertrés | Azcuénaga 1745 | 4714 6214 | -34.457322, -58.577098 |
| 10 | Centro de Salud Reinecke | Alvear 600 | 11 2732 8603 | -34.433455, -58.558151 |
| 11 | Centro de Salud Absalón Rojas (Islas) | Arroyo Felicaria · 2ª Sección de Islas | 11 2754 0109 | -34.217277, -58.531866 *(aprox., referencia del arroyo)* |

Servicios por centro (propuesta, mismo criterio Tigre/SF):
- **Directo (sin orden):** Clínica Médica, Pediatría, Ginecología, Obstetricia, Odontología General, Control de recién nacido.
- **Con orden del médico de cabecera:** Nutrición, Traumatología, Nefrología y demás derivadas.
- Horario propuesto para agendas demo: **Lun–Vie** dentro del horario de cada centro (p. ej. 8 a 17 h).

## B. Turnos online — Centros especializados (4, consultorio externo)
| Centro | Dirección | Teléfono | Lat, Lng | Servicios propuestos |
|---|---|---|---|---|
| Centro de Rehabilitación y Kinesiología | Besares 2172 | 11 7109 5732 | -34.451498, -58.552291 | Kinesiología traumatológica, geriátrica, deportiva y cardiovascular; hidroterapia; RPG; talleres de obesidad, diabetes y gestantes (con orden) |
| CeMAT – Dr. Pedro Di Matteo (Atención Temprana) | Sarmiento 3244 | 11 7154 3950 | -34.450761, -58.573931 | Pediatría y odontología (directo); psicología, kinesiología, psicomotricidad, fonoaudiología, psicopedagogía, terapia ocupacional (con orden) |
| Unidad de Diagnóstico Precoz N°27 | 25 de Mayo 2290 | 11 2732 8644 | -34.446607, -58.567052 | Clínica, pediatría, obstetricia, control de recién nacido (directo); nutrición, radiología y mamografía (con orden) |
| Centro Odontológico Dr. Gálvez | Portugal 2276 | 11 2732 8591 | -34.469150, -58.586981 | Odontología general y odontopediatría (directo); endodoncia y ortodoncia (con orden) |

## C. FUERA de turnos online
| Efector | Motivo |
|---|---|
| Centro de Emergencias San Fernando — Carlos Casares y Entre Ríos | Guardia 24 h y derivación: se atiende por orden de gravedad, sin turno. Urgencias: 107 (SAME). |
| Demanda espontánea en los centros | Vacunatorio Municipal (Av. Avellaneda 1460), farmacia y enfermería: por orden de llegada, sin turno. |

**Urgencias:** Centro de Emergencias 24 h y línea 107 (SAME).

## Branding (institucional San Fernando)
- Verde institucional (acento / botones): `#3F7D1E` · verde oscuro (gradiente): `#4d7c0f` / `#223f10`
- Verde lima (destacados): `#8CC63F`
- Magenta (acento secundario, badges "requiere orden"): `#A31860`
- Logo: velero azul/ámbar + "SAN FERNANDO MUNICIPIO" (`_tenants/MSF/IMAGENES/logo.png`, servido en `/agenda/msf_logo.png`).
- Prefijo de código de turno: `SF-`
- El tema por tenant vive en `src/lib/municipalTheme.ts` (entrada curada `salud-san-fernando`).
