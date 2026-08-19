import type { Organization } from '../types'

/**
 * Tema por tenant para el flujo municipal (tenant_type = 'general').
 *
 * Objetivo: que MunicipalBookingFlow.tsx NO tenga colores ni textos
 * institucionales hardcodeados. Cada organismo de salud pública resuelve su
 * paleta + copy desde acá.
 *
 * Estrategia (la más limpia sin migración y sin romper tenants existentes):
 *   1) Se deriva una paleta completa a partir de `org.primary_color` (acento).
 *   2) Se superpone, por `slug`, un override curado para los tenants que tienen
 *      identidad institucional específica (San Fernando: verde + acento magenta;
 *      Tigre: su paleta oficial + su copy). San Fernando queda PINEADO a los
 *      valores exactos que renderiza hoy => cambio de riesgo cero para ese tenant.
 *
 * Un tenant `general` nuevo sin entrada curada igual queda temeado sólo con su
 * `primary_color` (data-driven). Agregar un municipio con branding propio es
 * agregar una entrada acá (el copy institucional es específico igual).
 */
export interface MunicipalEmergency {
  /** Teléfono de urgencias que se muestra en el pie. */
  phone: string
  /** Etiqueta del servicio de emergencias (ej: "Emergencias San Fernando"). */
  label: string
  /** Horario de la guardia (ej: "24 h"). */
  hours: string
}

export interface MunicipalEmergencyCard {
  name: string
  address: string
  badge: string
}

export interface MunicipalTheme {
  /** Color de acción principal (botones, acentos). Alto contraste (WCAG AA). */
  accent: string
  /** Variante oscura del acento (texto sobre claro, código de turno). */
  accentInk: string
  /** Color institucional claro (cierre del gradiente del hero). */
  brand: string
  /** Inicio del gradiente del hero. */
  gradientFrom: string
  /** Verde de éxito/confirmación (check, paso completado). Convención universal. */
  success: string
  /** Acento secundario (rol "magenta" de San Fernando: badges "requiere orden"). */
  secondary: string
  secondaryBg: string
  secondaryTxt: string

  // ── Copy institucional ────────────────────────────────────────────────
  /** Subtítulo del header (ej: "Municipio de San Fernando · Secretaría de Salud Pública"). */
  subtitle: string
  /** Sufijo del municipio para el hero (ej: " de San Fernando"; "" para genérico). */
  heroMunicipio: string
  /** Horario de atención mostrado junto a la línea de turnos. */
  hoursLabel: string
  emergency: MunicipalEmergency
  /** Tarjeta fija de guardia en el listado de centros. null = no mostrar. */
  emergencyCard: MunicipalEmergencyCard | null
  /** Prefijo del código de turno (ej: "SF" => "SF-12345"). */
  turnoPrefix: string
  /** Nombre del archivo de logo servido por la app si org.logo_url es null. */
  logoFallback: string
  /** Teléfono por defecto si org.phone es null. */
  phoneFallback: string
}

// ── Helpers de color (mezcla hacia negro/blanco) ────────────────────────────
function clamp(n: number) { return Math.max(0, Math.min(255, Math.round(n))) }
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('')
}
function mix(hex: string, target: string, ratio: number) {
  const [r1, g1, b1] = hexToRgb(hex)
  const [r2, g2, b2] = hexToRgb(target)
  return rgbToHex(r1 + (r2 - r1) * ratio, g1 + (g2 - g1) * ratio, b1 + (b2 - b1) * ratio)
}
const darken = (hex: string, r: number) => mix(hex, '#000000', r)
const lighten = (hex: string, r: number) => mix(hex, '#ffffff', r)

/** Paleta + copy 100% derivados de un color de acento (para tenants sin curar). */
function deriveTheme(primary: string): MunicipalTheme {
  const accent = /^#[0-9a-fA-F]{6}$/.test(primary) ? primary : '#3F7D1E'
  return {
    accent,
    accentInk: darken(accent, 0.22),
    brand: lighten(accent, 0.28),
    gradientFrom: darken(accent, 0.12),
    success: '#2E7D32',
    secondary: accent,
    secondaryBg: lighten(accent, 0.88),
    secondaryTxt: darken(accent, 0.22),
    subtitle: 'Secretaría de Salud',
    heroMunicipio: '',
    hoursLabel: 'Lun a Vie, 8 a 17 h',
    emergency: { phone: '107', label: 'Emergencias', hours: '24 h' },
    emergencyCard: null,
    turnoPrefix: 'TURNO',
    logoFallback: 'praxis_logo.png',
    phoneFallback: '',
  }
}

/** Overrides curados por slug (Partial => se superpone sobre lo derivado). */
const CURATED: Record<string, Partial<MunicipalTheme>> = {
  // ── San Fernando: PINEADO a lo que renderiza hoy (verde + magenta). ──────
  'salud-san-fernando': {
    accent: '#3F7D1E',
    accentInk: '#2f6417',
    brand: '#8CC63F',
    gradientFrom: '#4d7c0f',
    success: '#2E7D32',
    secondary: '#A31860',
    secondaryBg: '#FCE4EF',
    secondaryTxt: '#A31860',
    subtitle: 'Municipio de San Fernando · Secretaría de Salud Pública',
    heroMunicipio: ' de San Fernando',
    hoursLabel: 'Lun a Vie, 7 a 19 h',
    emergency: { phone: '107', label: 'Emergencias San Fernando', hours: '24 h' },
    emergencyCard: {
      name: 'Emergencias San Fernando',
      address: 'Carlos Casares y Entre Ríos',
      badge: 'Guardia 24 h — no requiere turno',
    },
    turnoPrefix: 'SF',
    logoFallback: 'msf_logo.png',
    phoneFallback: '0800 888 5566',
  },

  // ── Tigre: rojo institucional oficial (#D02013, sitio tigre.gob.ar) + acento
  //    celeste (botones oficiales). Copy institucional de Tigre. Ver _TENANTS/TIGRE.
  'salud-tigre': {
    accent: '#D02013',
    accentInk: '#a5160c',
    brand: '#e8433a',
    gradientFrom: '#9e1109',
    success: '#2E7D32',
    secondary: '#0E7CB0',
    secondaryBg: '#E3F2FB',
    secondaryTxt: '#0E5E86',
    subtitle: 'Municipio de Tigre · Secretaría de Salud',
    heroMunicipio: ' de Tigre',
    hoursLabel: 'Lun a Vie, 8 a 20 h · Sáb 8 a 13 h',
    emergency: { phone: '107', label: 'Emergencias (SAME)', hours: '24 h' },
    emergencyCard: null,
    turnoPrefix: 'TIG',
    logoFallback: 'tigre_logo.svg',
    phoneFallback: '0810 444 3400',
  },
}

export function getMunicipalTheme(org: Organization): MunicipalTheme {
  const base = deriveTheme(org.primary_color ?? '')
  const ov = CURATED[org.slug]
  if (!ov) return base
  return {
    ...base,
    ...ov,
    emergency: { ...base.emergency, ...(ov.emergency ?? {}) },
    emergencyCard: 'emergencyCard' in ov ? (ov.emergencyCard ?? null) : base.emergencyCard,
  }
}
