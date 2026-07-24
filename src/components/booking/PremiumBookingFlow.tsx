import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, ChevronLeft, ChevronRight, Clock, MapPin, Calendar, Home, MessageCircle, Instagram } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import type { BookingState, Organization, Professional, Service } from '../../types'
import { ProfessionalSelector } from './ProfessionalSelector'
import { DateTimeSelector } from './DateTimeSelector'
import { BookingConfirm } from './BookingConfirm'

// ── Tokens ──────────────────────────────────────────────────────────────────
const DARK      = '#0B0B0B'
const CARD      = '#141414'
const CARD2     = '#1A1A1A'
const BORDER    = 'rgba(255,255,255,0.07)'
const BORDER2   = 'rgba(255,255,255,0.12)'
const TEXT_PRI  = '#FFFFFF'
const TEXT_SEC  = 'rgba(255,255,255,0.52)'
const TEXT_MUTED= 'rgba(255,255,255,0.28)'
const SERIF     = "'Playfair Display', Georgia, serif"
const SANS      = "'Inter', sans-serif"

const fade   = (hex: string) => hex + '1E'
const bord   = (hex: string) => hex + '40'

// ── Category accent gradients (no external images) ──────────────────────────
const CAT_GRADIENT: Record<string, string> = {
  // Hair / beauty
  'Peluquería':    'linear-gradient(135deg, #2C1810 0%, #1A0F0A 100%)',
  'Peluqueria':    'linear-gradient(135deg, #2C1810 0%, #1A0F0A 100%)',
  'Barbería':      'linear-gradient(135deg, #1A1A2E 0%, #0F0F1A 100%)',
  'Barberia':      'linear-gradient(135deg, #1A1A2E 0%, #0F0F1A 100%)',
  // Nails
  'Manicuría':     'linear-gradient(135deg, #2A1520 0%, #1A0D14 100%)',
  'Manicuria':     'linear-gradient(135deg, #2A1520 0%, #1A0D14 100%)',
  'Manos':         'linear-gradient(135deg, #2A1520 0%, #1A0D14 100%)',
  'Nail Art':      'linear-gradient(135deg, #2A1520 0%, #1A0D14 100%)',
  'Semi':          'linear-gradient(135deg, #2A1520 0%, #1A0D14 100%)',
  'Pedicuría':     'linear-gradient(135deg, #201520 0%, #120F12 100%)',
  'Pedicuria':     'linear-gradient(135deg, #201520 0%, #120F12 100%)',
  // Relaxation
  'Masajes':       'linear-gradient(135deg, #0F1E2A 0%, #091218 100%)',
  'Reflexología':  'linear-gradient(135deg, #0F1E2A 0%, #091218 100%)',
  'Reflexologia':  'linear-gradient(135deg, #0F1E2A 0%, #091218 100%)',
  'Drenaje':       'linear-gradient(135deg, #0A1A1A 0%, #060F0F 100%)',
  // Skin / facial / medical aesthetic
  'Facial':        'linear-gradient(135deg, #1E1420 0%, #120D14 100%)',
  'Aparatología':  'linear-gradient(135deg, #0E1C2A 0%, #091218 100%)',
  'Aparatologia':  'linear-gradient(135deg, #0E1C2A 0%, #091218 100%)',
  // Dermatology
  'Consultas':     'linear-gradient(135deg, #0E1A24 0%, #091218 100%)',
  'Consulta':      'linear-gradient(135deg, #0E1A24 0%, #091218 100%)',
  'Tratamientos':  'linear-gradient(135deg, #1C1020 0%, #110A14 100%)',
  'Tratamiento':   'linear-gradient(135deg, #1C1020 0%, #110A14 100%)',
  'Procedimientos':'linear-gradient(135deg, #101E20 0%, #0A1214 100%)',
  'Procedimiento': 'linear-gradient(135deg, #101E20 0%, #0A1214 100%)',
  'LASER':         'linear-gradient(135deg, #101E20 0%, #0A1214 100%)',
  'Laser':         'linear-gradient(135deg, #101E20 0%, #0A1214 100%)',
  // Sports
  'Fútbol':        'linear-gradient(135deg, #0F2010 0%, #091509 100%)',
  'Futbol':        'linear-gradient(135deg, #0F2010 0%, #091509 100%)',
  'Pádel':         'linear-gradient(135deg, #1A1A10 0%, #0F0F09 100%)',
  'Padel':         'linear-gradient(135deg, #1A1A10 0%, #0F0F09 100%)',
  'Tenis':         'linear-gradient(135deg, #1A1A10 0%, #0F0F09 100%)',
}

const DEFAULT_GRAD = 'linear-gradient(135deg, #1A1A1A 0%, #0F0F0F 100%)'

// ── Per-specialty context ────────────────────────────────────────────────────
interface SpecialtyCtx {
  eyebrow:    string
  subtitle:   string
  ctaLabel:   string
  doneTitle:  string
  doneMsg:    string
  newBooking: string
  heroImg:    string
  accentHint: string
}

const SPECIALTY_MAP: Record<string, SpecialtyCtx> = {
  // ── Médicas ──────────────────────────────────────────────────────────────
  oftalmologia: {
    eyebrow:    'Oftalmología',
    subtitle:   'Reservá tu examen visual con un especialista',
    ctaLabel:   'Reservar Consulta',
    doneTitle:  'Consulta confirmada',
    doneMsg:    'Tu consulta fue registrada. Te contactamos para confirmar el turno.',
    newBooking: 'Reservar otra consulta',
    heroImg:    'https://images.unsplash.com/photo-1516069677018-378515003435?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#1B6CA8',
  },
  pediatria: {
    eyebrow:    'Pediatría',
    subtitle:   'El cuidado que tu pequeño merece',
    ctaLabel:   'Reservar Turno',
    doneTitle:  'Turno confirmado',
    doneMsg:    'El turno fue registrado. Te contactamos para confirmar.',
    newBooking: 'Reservar otro turno',
    heroImg:    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#E8762C',
  },
  kinesiologia: {
    eyebrow:    'Kinesiología & Fisioterapia',
    subtitle:   'Tu recuperación en las mejores manos',
    ctaLabel:   'Reservar Sesión',
    doneTitle:  'Sesión confirmada',
    doneMsg:    'Tu sesión fue registrada. Te contactamos para confirmar.',
    newBooking: 'Reservar otra sesión',
    heroImg:    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#2D8B55',
  },
  fisioterapia: {
    eyebrow:    'Fisioterapia',
    subtitle:   'Tu recuperación en las mejores manos',
    ctaLabel:   'Reservar Sesión',
    doneTitle:  'Sesión confirmada',
    doneMsg:    'Tu sesión fue registrada. Te contactamos para confirmar.',
    newBooking: 'Reservar otra sesión',
    heroImg:    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#2D8B55',
  },
  dermatologia: {
    eyebrow:    'Dermatología',
    subtitle:   'Cuidado experto para tu piel',
    ctaLabel:   'Reservar Consulta',
    doneTitle:  'Consulta confirmada',
    doneMsg:    'Tu consulta fue registrada. Te contactamos para confirmar.',
    newBooking: 'Reservar otra consulta',
    heroImg:    'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#7B5E8A',
  },
  medicinaEstetica: {
    eyebrow:    'Medicina Estética',
    subtitle:   'Reservá tu consulta personalizada',
    ctaLabel:   'Reservar Consulta',
    doneTitle:  'Consulta confirmada',
    doneMsg:    'Tu consulta fue registrada. Te contactamos para confirmar.',
    newBooking: 'Reservar otra consulta',
    heroImg:    'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#C9A96E',
  },
  cardiologia: {
    eyebrow:    'Cardiología',
    subtitle:   'Tu corazón en las manos correctas',
    ctaLabel:   'Reservar Consulta',
    doneTitle:  'Consulta confirmada',
    doneMsg:    'Tu consulta fue registrada. Te contactamos para confirmar.',
    newBooking: 'Reservar otra consulta',
    heroImg:    'https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#8B2040',
  },
  odontologia: {
    eyebrow:    'Odontología',
    subtitle:   'Tu sonrisa, nuestra especialidad',
    ctaLabel:   'Reservar Turno',
    doneTitle:  'Turno confirmado',
    doneMsg:    'Tu turno fue registrado. Te contactamos para confirmar.',
    newBooking: 'Reservar otro turno',
    heroImg:    'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#2B7A9E',
  },
  nutricion: {
    eyebrow:    'Nutrición',
    subtitle:   'Alimentá tu bienestar con asesoramiento profesional',
    ctaLabel:   'Reservar Consulta',
    doneTitle:  'Consulta confirmada',
    doneMsg:    'Tu consulta fue registrada. Te contactamos para confirmar.',
    newBooking: 'Reservar otra consulta',
    heroImg:    'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#3A8F5A',
  },
  psicologia: {
    eyebrow:    'Psicología',
    subtitle:   'Un espacio seguro para tu bienestar mental',
    ctaLabel:   'Reservar Sesión',
    doneTitle:  'Sesión confirmada',
    doneMsg:    'Tu sesión fue registrada. Te contactamos para confirmar.',
    newBooking: 'Reservar otra sesión',
    heroImg:    'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#7B68AA',
  },
  traumatologia: {
    eyebrow:    'Traumatología',
    subtitle:   'Especialistas en tu movilidad y recuperación',
    ctaLabel:   'Reservar Consulta',
    doneTitle:  'Consulta confirmada',
    doneMsg:    'Tu consulta fue registrada. Te contactamos para confirmar.',
    newBooking: 'Reservar otra consulta',
    heroImg:    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#4A6B8A',
  },
  ginecologia: {
    eyebrow:    'Ginecología & Obstetricia',
    subtitle:   'Tu salud femenina en buenas manos',
    ctaLabel:   'Reservar Consulta',
    doneTitle:  'Consulta confirmada',
    doneMsg:    'Tu consulta fue registrada. Te contactamos para confirmar.',
    newBooking: 'Reservar otra consulta',
    heroImg:    'https://images.unsplash.com/photo-1631815588090-d1bcbe9a8a72?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#A85882',
  },
  neurologia: {
    eyebrow:    'Neurología',
    subtitle:   'Diagnóstico y tratamiento especializado',
    ctaLabel:   'Reservar Consulta',
    doneTitle:  'Consulta confirmada',
    doneMsg:    'Tu consulta fue registrada. Te contactamos para confirmar.',
    newBooking: 'Reservar otra consulta',
    heroImg:    'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#5B4A8A',
  },
  gastroenterologia: {
    eyebrow:    'Gastroenterología',
    subtitle:   'Cuidado integral de tu sistema digestivo',
    ctaLabel:   'Reservar Consulta',
    doneTitle:  'Consulta confirmada',
    doneMsg:    'Tu consulta fue registrada. Te contactamos para confirmar.',
    newBooking: 'Reservar otra consulta',
    heroImg:    'https://images.unsplash.com/photo-1576671081837-49000212a370?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#3A7B8A',
  },
  endocrinologia: {
    eyebrow:    'Endocrinología',
    subtitle:   'Equilibrio hormonal y metabólico',
    ctaLabel:   'Reservar Consulta',
    doneTitle:  'Consulta confirmada',
    doneMsg:    'Tu consulta fue registrada. Te contactamos para confirmar.',
    newBooking: 'Reservar otra consulta',
    heroImg:    'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#2A7A7A',
  },
  clinicamedica: {
    eyebrow:    'Clínica Médica',
    subtitle:   'Atención médica integral de calidad',
    ctaLabel:   'Reservar Consulta',
    doneTitle:  'Consulta confirmada',
    doneMsg:    'Tu consulta fue registrada. Te contactamos para confirmar.',
    newBooking: 'Reservar otra consulta',
    heroImg:    'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#1B6CA8',
  },
  // ── Estética / Beauty ─────────────────────────────────────────────────────
  estetica: {
    eyebrow:    'Estética de Autor',
    subtitle:   'Reservá tu experiencia personalizada',
    ctaLabel:   'Reservar Turno',
    doneTitle:  'Reserva confirmada',
    doneMsg:    'Tu reserva fue registrada. Te contactamos para confirmar.',
    newBooking: 'Reservar otro turno',
    heroImg:    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#C9A96E',
  },
  beauty: {
    eyebrow:    'Peluquería & Belleza',
    subtitle:   'Reservá tu experiencia personalizada',
    ctaLabel:   'Reservar Turno',
    doneTitle:  'Reserva confirmada',
    doneMsg:    'Tu reserva fue registrada. Te contactamos para confirmar.',
    newBooking: 'Reservar otro turno',
    heroImg:    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#C9A96E',
  },
  masajes: {
    eyebrow:    'Masajes & Bienestar',
    subtitle:   'Reservá tu momento de relajación',
    ctaLabel:   'Reservar Sesión',
    doneTitle:  'Sesión confirmada',
    doneMsg:    'Tu sesión fue registrada. Te contactamos para confirmar.',
    newBooking: 'Reservar otra sesión',
    heroImg:    'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#8A7B5A',
  },
  // ── Mascotas / Deporte ───────────────────────────────────────────────────
  petshop: {
    eyebrow:    'Peluquería Canina',
    subtitle:   'Reservá el baño y cuidado de tu mascota',
    ctaLabel:   'Reservar Turno',
    doneTitle:  'Turno confirmado',
    doneMsg:    'El turno para tu mascota fue registrado. Te contactamos para confirmar.',
    newBooking: 'Reservar otro turno',
    heroImg:    'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#C97B3D',
  },
  veterinary: {
    eyebrow:    'Atención Veterinaria',
    subtitle:   'Reservá la consulta para tu mascota',
    ctaLabel:   'Reservar Consulta',
    doneTitle:  'Consulta confirmada',
    doneMsg:    'La consulta para tu mascota fue registrada. Te contactamos para confirmar.',
    newBooking: 'Reservar otra consulta',
    heroImg:    'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#2E7D6B',
  },
  cancha: {
    eyebrow:    'Reserva de Cancha',
    subtitle:   'Reservá tu cancha en simples pasos',
    ctaLabel:   'Reservar Cancha',
    doneTitle:  'Cancha reservada!',
    doneMsg:    'Tu cancha fue reservada. Te esperamos!',
    newBooking: 'Reservar otra cancha',
    heroImg:    'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=1600&h=900&fit=crop&auto=format&q=80',
    accentHint: '#2E7D32',
  },
}

// Slug keyword → specialty key (fallback when org.specialty is null)
const SLUG_KEYWORDS: [RegExp, string][] = [
  [/oftalmo/i,             'oftalmologia'],
  [/pediatr/i,             'pediatria'],
  [/kinesi/i,              'kinesiologia'],
  [/fisiote/i,             'fisioterapia'],
  [/dermato/i,             'dermatologia'],
  [/estetica|laser/i,      'medicinaEstetica'],
  [/cardio/i,              'cardiologia'],
  [/odonto|dental/i,       'odontologia'],
  [/nutrici/i,             'nutricion'],
  [/psico|psiqui/i,        'psicologia'],
  [/traumato|ortop/i,      'traumatologia'],
  [/gineco|obstetr/i,      'ginecologia'],
  [/neurolog/i,            'neurologia'],
  [/gastro/i,              'gastroenterologia'],
  [/endocrin/i,            'endocrinologia'],
  [/clinica|medico-gral/i, 'clinicamedica'],
  [/masaje|spa|zen/i,      'masajes'],
]

function getOrgContext(org: Organization): SpecialtyCtx {
  // 1. Explicit specialty field
  if (org.specialty && SPECIALTY_MAP[org.specialty]) return SPECIALTY_MAP[org.specialty]
  // 2. Slug keyword detection
  for (const [re, key] of SLUG_KEYWORDS) {
    if (re.test(org.slug) && SPECIALTY_MAP[key]) return SPECIALTY_MAP[key]
  }
  // 3. Tenant-type fallback
  const tt = org.tenant_type ?? 'beauty'
  return SPECIALTY_MAP[tt] ?? SPECIALTY_MAP.medicinaEstetica
}

const INIT: BookingState = {
  step: 1, nombre: '', telefono: '', email: '', dni: '',
  obra_social: '', nro_socio: '', observaciones: '',
}

const STEPS = ['Servicio', 'Profesional', 'Fecha y hora', 'Confirmar']

export function PremiumBookingFlow({ org }: { org: Organization }) {
  const navigate = useNavigate()
  const ctx     = getOrgContext(org)
  const gold    = org.primary_color ?? ctx.accentHint ?? '#C9A96E'
  const heroImg = org.cover_image_url ?? ctx.heroImg

  const isLight  = org.tenant_type === 'medical'
  const TH_BG    = isLight ? '#F8FAFC'             : DARK
  const TH_CARD  = isLight ? '#FFFFFF'             : CARD
  const TH_CARD2 = isLight ? '#EEF2F7'             : CARD2
  const TH_BD    = isLight ? 'rgba(15,23,42,0.09)' : BORDER
  const TH_BD2   = isLight ? 'rgba(15,23,42,0.14)' : BORDER2
  const TH_T1    = isLight ? '#0F172A'             : TEXT_PRI
  const TH_T2    = isLight ? '#475569'             : TEXT_SEC
  const TH_T3    = isLight ? '#94A3B8'             : TEXT_MUTED
  const TH_BAR   = isLight ? '#FFFFFF'             : '#0E0E0E'
  const TH_BARBD = isLight ? 'rgba(15,23,42,0.08)' : BORDER

  // ── Tenant-specific hero enhancement (scoped, zero impact on other tenants) ──
  const isClinicaDelEste  = org.slug === 'clinica-del-este'
  const isAlco            = org.slug === 'alco-rehabilitacion'
  const isPremiumHero     = isClinicaDelEste || isAlco

  const [state, setState]           = useState<BookingState>(INIT)
  const [completed, setCompleted]   = useState(false)
  const [services, setServices]     = useState<Service[]>([])
  const [loadingSvc, setLoadingSvc] = useState(true)
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [hovCat, setHovCat]         = useState<string | null>(null)
  const [hovSvc, setHovSvc]         = useState<string | null>(null)
  const [hovCta, setHovCta]         = useState(false)
  const bookingRef = useRef<HTMLDivElement>(null)

  const instagramHandle = org.instagram_handle?.replace(/^@/, '') ?? null
  const whatsappNumber  = org.whatsapp_number ?? null
  const orgAddress      = org.address ?? null
  const logoUrl         = org.logo_url ?? null

  useEffect(() => {
    supabase.from('services').select('*')
      .eq('organization_id', org.id).eq('active', true).order('name')
      .then(({ data }) => { setServices((data ?? []) as Service[]); setLoadingSvc(false) })
  }, [org.id])

  const categories = useMemo(
    () => [...new Set(services.map(s => s.category).filter(Boolean))] as string[],
    [services],
  )

  const update = (p: Partial<BookingState>) => setState(prev => ({ ...prev, ...p }))

  const scrollToBooking = () =>
    setTimeout(() => bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)

  useEffect(() => { if (state.step > 1) scrollToBooking() }, [state.step])

  const handleServiceSelect = async (svc: Service) => {
    const { data } = await supabase
      .from('professional_services')
      .select('professionals(id, full_name, specialty, bio, avatar_url, active)')
      .eq('service_id', svc.id)
    const profs = (data ?? []).map((r: any) => r.professionals as Professional).filter(p => p?.active)
    if (profs.length === 1) {
      setState(prev => ({ ...prev, service: svc, professional: profs[0], fecha: undefined, hora: undefined, step: 3 }))
    } else {
      setState(prev => ({ ...prev, service: svc, professional: undefined, fecha: undefined, hora: undefined, step: 2 }))
    }
    scrollToBooking()
  }

  const filteredSvcs = useMemo(
    () => selectedCat ? services.filter(s => s.category === selectedCat) : services,
    [services, selectedCat],
  )

  // ── Completed ──────────────────────────────────────────────────────────────
  if (completed) return (
    <div style={{ minHeight: '100vh', backgroundColor: TH_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${heroImg})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(24px)', opacity: 0.08, transform: 'scale(1.1)', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1, backgroundColor: TH_CARD, border: `1px solid ${TH_BD}`, borderRadius: '20px', padding: '40px 32px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: fade(gold), border: `1px solid ${bord(gold)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <CheckCircle size={28} style={{ color: gold }} />
        </div>
        <div style={{ fontFamily: SERIF, fontSize: '26px', fontStyle: 'italic', fontWeight: 400, color: TH_T1, marginBottom: '8px' }}>{ctx.doneTitle}</div>
        <p style={{ fontFamily: SANS, fontSize: '13px', color: TH_T2, marginBottom: '28px', lineHeight: 1.65 }}>{ctx.doneMsg}</p>
        <div style={{ backgroundColor: fade(gold), border: `1px solid ${bord(gold)}`, borderRadius: '12px', padding: '16px', textAlign: 'left', marginBottom: '24px' }}>
          {([['Servicio', state.service?.name ?? ''], ['Profesional', state.professional?.full_name ?? ''], ['Fecha', state.fecha ? format(parseISO(state.fecha), "EEEE d 'de' MMMM", { locale: es }) : ''], ['Hora', state.hora ? `${state.hora}hs` : '']] as [string,string][]).filter(([,v]) => v).map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontFamily: SANS, fontSize: '13px' }}>
              <span style={{ color: TH_T3 }}>{label}</span>
              <span style={{ color: TH_T1, fontWeight: 500, textTransform: label === 'Fecha' ? 'capitalize' : 'none' }}>{val}</span>
            </div>
          ))}
        </div>
        <button onClick={() => { setState(INIT); setCompleted(false); setSelectedCat(null); navigate(`/${org.slug}`) }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', backgroundColor: gold, color: DARK, border: 'none', borderRadius: '10px', padding: '13px', fontFamily: SANS, fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginBottom: '10px' }}>
          <Home size={15} /> Volver al inicio
        </button>
        <button onClick={() => navigate(`/totem/${org.slug}`)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', backgroundColor: 'transparent', color: TH_T1, border: `1px solid ${TH_BD2}`, borderRadius: '10px', padding: '13px', fontFamily: SANS, fontSize: '13px', fontWeight: 500, cursor: 'pointer', marginBottom: '20px' }}>
          <Calendar size={15} /> Consultar mis turnos
        </button>
        <p style={{ fontFamily: SANS, fontSize: '12px', color: TH_T3, margin: 0 }}>
          Ya podés cerrar esta ventana.
        </p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: TH_BG }}>

      {/* ─── HERO ─── */}
      <div style={{ position: 'relative', height: '88vh', minHeight: '580px', maxHeight: '900px' }}>
        <img src={heroImg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }} />

        {/* ── Overlay base: más intenso para CDE, igual para resto ── */}
        <div style={{ position: 'absolute', inset: 0, background: isPremiumHero
          ? 'linear-gradient(180deg, rgba(4,12,24,0.28) 0%, rgba(4,12,24,0.60) 42%, rgba(4,12,24,0.93) 100%)'
          : 'linear-gradient(180deg, rgba(11,11,11,0.2) 0%, rgba(11,11,11,0.5) 45%, rgba(11,11,11,0.94) 100%)'
        }} />

        {/* ── CDE only: viñeta lateral suave ── */}
        {isPremiumHero && (
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 78% 100% at 50% 50%, transparent 22%, rgba(4,12,24,0.52) 100%)', pointerEvents: 'none' }} />
        )}

        {/* ── CDE only: backdrop central que separa texto de la imagen ── */}
        {isPremiumHero && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -54%)', width: 'min(700px, 95%)', height: '440px', background: 'radial-gradient(ellipse at 50% 50%, rgba(4,12,24,0.50) 0%, transparent 68%)', filter: 'blur(18px)', pointerEvents: 'none' }} />
        )}

        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: isPremiumHero ? '0 32px' : '0 24px', textAlign: 'center' }}>
          {logoUrl && (
            <img src={logoUrl} alt={org.name} style={{ width: '100px', height: '100px', objectFit: 'contain', backgroundColor: '#fff', borderRadius: '22px', padding: '3px', boxShadow: '0 16px 48px rgba(0,0,0,0.5)', marginBottom: '28px' }} />
          )}

          {/* Eyebrow / categoría */}
          <div style={{
            fontFamily: SANS,
            fontSize: isPremiumHero ? '11px' : '10px',
            fontWeight: isPremiumHero ? 500 : 400,
            letterSpacing: isPremiumHero ? '0.44em' : '0.35em',
            textTransform: 'uppercase',
            color: gold,
            marginBottom: isPremiumHero ? '18px' : '14px',
            ...(isPremiumHero ? {
              backgroundColor: 'rgba(255,255,255,0.08)',
              border: `1px solid ${gold}30`,
              borderRadius: '100px',
              padding: '7px 22px',
            } : {}),
          }}>{ctx.eyebrow}</div>

          {/* Título principal */}
          <h1 style={{
            fontFamily: SERIF,
            fontSize: isPremiumHero ? 'clamp(36px, 6.5vw, 60px)' : 'clamp(30px, 6vw, 50px)',
            fontWeight: 400,
            fontStyle: 'italic',
            color: '#fff',
            margin: isPremiumHero ? '0 0 22px' : '0 0 18px',
            lineHeight: 1.1,
            maxWidth: isPremiumHero ? '660px' : '580px',
            ...(isPremiumHero ? {
              textShadow: '0 2px 20px rgba(0,0,0,0.55), 0 0 60px rgba(0,0,0,0.20)',
            } : {}),
          }}>{org.name}</h1>

          {/* Subtítulo */}
          <p style={{
            fontFamily: SANS,
            fontSize: isPremiumHero ? '16px' : '15px',
            fontWeight: isPremiumHero ? 400 : 300,
            color: isPremiumHero ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.58)',
            marginBottom: isPremiumHero ? '52px' : '44px',
            maxWidth: isPremiumHero ? '380px' : '320px',
            lineHeight: 1.65,
            ...(isPremiumHero ? {
              textShadow: '0 1px 10px rgba(0,0,0,0.45)',
            } : {}),
          }}>{org.booking_headline ?? ctx.subtitle}</p>

          {/* CTA row */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: isPremiumHero ? '36px' : '52px' }}>
            <button
              onClick={scrollToBooking}
              onMouseEnter={() => setHovCta(true)}
              onMouseLeave={() => setHovCta(false)}
              style={{
                backgroundColor: gold,
                color: DARK,
                border: 'none',
                borderRadius: isPremiumHero ? '10px' : '8px',
                padding: isPremiumHero ? '17px 56px' : '14px 36px',
                fontFamily: SANS,
                fontWeight: 600,
                fontSize: isPremiumHero ? '14px' : '13px',
                letterSpacing: isPremiumHero ? '0.10em' : '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                ...(isPremiumHero ? {
                  boxShadow: hovCta
                    ? `0 8px 32px ${gold}60, 0 2px 8px rgba(0,0,0,0.3)`
                    : `0 4px 22px ${gold}40, 0 1px 4px rgba(0,0,0,0.18)`,
                  transform: hovCta ? 'translateY(-2px) scale(1.01)' : 'none',
                } : {}),
              }}>
              {ctx.ctaLabel}
            </button>
            {instagramHandle && (
              <a href={`https://instagram.com/${instagramHandle}`} target="_blank" rel="noopener noreferrer"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '8px', padding: '14px 28px', fontFamily: SANS, fontWeight: 400, fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Instagram size={14} /> @{instagramHandle}
              </a>
            )}
          </div>

          {/* Dirección + WhatsApp */}
          <div style={{ display: 'flex', gap: isPremiumHero ? '10px' : '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {orgAddress && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(orgAddress)}`} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isPremiumHero ? '8px' : '6px',
                  fontFamily: SANS,
                  fontSize: isPremiumHero ? '13px' : '12px',
                  fontWeight: isPremiumHero ? 400 : 400,
                  color: isPremiumHero ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.38)',
                  textDecoration: 'none',
                  ...(isPremiumHero ? {
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.11)',
                    borderRadius: '100px',
                    padding: '8px 18px',
                    backdropFilter: 'blur(4px)',
                  } : {}),
                }}>
                <MapPin size={isPremiumHero ? 14 : 13} style={isPremiumHero ? { color: gold, flexShrink: 0 } : undefined} />
                {orgAddress}
              </a>
            )}
            {whatsappNumber && (
              <a href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: SANS,
                  fontSize: isPremiumHero ? '13px' : '12px',
                  color: isPremiumHero ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.38)',
                  textDecoration: 'none',
                  ...(isPremiumHero ? {
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.11)',
                    borderRadius: '100px',
                    padding: '8px 18px',
                    backdropFilter: 'blur(4px)',
                  } : {}),
                }}>
                <MessageCircle size={13} style={isPremiumHero ? { color: '#25D366', flexShrink: 0 } : undefined} />WhatsApp
              </a>
            )}
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: '28px', left: '50%', transform: 'translateX(-50%)' }}>
          <div style={{ width: '1px', height: '36px', background: `linear-gradient(to bottom, transparent, ${gold})` }} />
        </div>
      </div>

      {/* ─── STEPS BAR ─── */}
      <div ref={bookingRef} style={{ backgroundColor: TH_BAR, borderBottom: `1px solid ${TH_BARBD}`, position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {STEPS.map((label, i) => {
              const n = i + 1; const isActive = state.step === n; const isDone = state.step > n
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontSize: '11px', fontWeight: 600, backgroundColor: isDone ? gold : 'transparent', border: isDone ? 'none' : isActive ? `1.5px solid ${gold}` : `1px solid ${TH_BD}`, color: isDone ? DARK : isActive ? gold : TH_T3 }}>
                      {isDone ? '✓' : n}
                    </div>
                    <span style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', color: isActive ? gold : TH_T3, whiteSpace: 'nowrap' }}>{label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div style={{ flex: 1, height: '1px', margin: '0 6px 18px', backgroundColor: isDone ? gold : TH_BD }} />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─── CONTENT ─── */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* STEP 1 — Services */}
        {state.step === 1 && (
          <div>
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontFamily: SANS, fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: gold, marginBottom: '8px' }}>Paso 1</div>
              <h2 style={{ fontFamily: SERIF, fontSize: '28px', fontStyle: 'italic', fontWeight: 400, color: TH_T1, margin: 0 }}>
                {selectedCat ? `Servicios de ${selectedCat}` : '¿Qué servicio buscás?'}
              </h2>
            </div>

            {selectedCat && (
              <button onClick={() => setSelectedCat(null)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: SANS, fontSize: '12px', color: gold, background: 'none', border: `1px solid ${bord(gold)}`, borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', marginBottom: '20px' }}>
                <ChevronLeft size={14} /> {selectedCat}
              </button>
            )}

            {loadingSvc ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {[1,2,3,4].map(i => <div key={i} style={{ height: '140px', backgroundColor: TH_CARD, borderRadius: '16px', border: `1px solid ${TH_BD}` }} />)}
              </div>
            ) : !selectedCat && categories.length > 1 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {categories.map(cat => {
                  const count   = services.filter(s => s.category === cat).length
                  const isHov   = hovCat === cat
                  const grad    = isLight
                    ? (isHov ? 'linear-gradient(135deg, #E3EFF9 0%, #EEF5FC 100%)' : 'linear-gradient(135deg, #EEF5FB 0%, #F5F9FF 100%)')
                    : (CAT_GRADIENT[cat] ?? DEFAULT_GRAD)
                  const cardBd  = isLight
                    ? (isHov ? `1px solid ${gold}` : '1px solid rgba(27,108,168,0.15)')
                    : (isHov ? `1px solid ${gold}` : `1px solid ${TH_BD}`)
                  const lineClr = isLight
                    ? (isHov ? gold : 'rgba(27,108,168,0.25)')
                    : (isHov ? gold : 'rgba(255,255,255,0.15)')
                  const catT1   = isLight ? TH_T1 : TEXT_PRI
                  const catT2   = isLight ? TH_T2 : TEXT_MUTED
                  return (
                    <button key={cat} onClick={() => setSelectedCat(cat)} onMouseEnter={() => setHovCat(cat)} onMouseLeave={() => setHovCat(null)}
                      style={{ position: 'relative', height: '140px', borderRadius: '16px', overflow: 'hidden', border: cardBd, cursor: 'pointer', background: grad, padding: 0, transition: 'all 0.2s', transform: isHov ? 'scale(1.02)' : 'scale(1)', textAlign: 'left', boxShadow: isLight ? (isHov ? '0 4px 20px rgba(27,108,168,0.12)' : '0 1px 4px rgba(15,23,42,0.06)') : 'none' }}>
                      {!isLight && <div style={{ position: 'absolute', inset: 0, background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.04\'/%3E%3C/svg%3E")', opacity: 0.4 }} />}
                      <div style={{ position: 'absolute', top: 0, left: '20px', width: isHov ? '36px' : '24px', height: '2px', backgroundColor: lineClr, transition: 'background-color 0.2s, width 0.2s' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '18px 18px 16px' }}>
                        <div style={{ fontFamily: SERIF, fontSize: '18px', fontStyle: 'italic', color: catT1, marginBottom: '4px', lineHeight: 1.2 }}>{cat}</div>
                        <div style={{ fontFamily: SANS, fontSize: '11px', color: isHov ? gold : catT2, transition: 'color 0.2s' }}>{count} {count === 1 ? 'opción' : 'opciones'} →</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredSvcs.map(svc => {
                  const isHov = hovSvc === svc.id
                  return (
                    <button key={svc.id} onClick={() => handleServiceSelect(svc)} onMouseEnter={() => setHovSvc(svc.id)} onMouseLeave={() => setHovSvc(null)}
                      style={{ display: 'flex', alignItems: 'center', borderRadius: '14px', border: isHov ? `1px solid ${gold}` : `1px solid ${TH_BD}`, backgroundColor: isHov ? TH_CARD2 : TH_CARD, cursor: 'pointer', padding: '18px 20px', textAlign: 'left', transition: 'all 0.18s', gap: '14px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isHov ? gold : 'rgba(255,255,255,0.2)', flexShrink: 0, transition: 'background-color 0.18s' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: '14px', color: TH_T1, marginBottom: '3px' }}>{svc.name}</div>
                        {svc.description && <div style={{ fontFamily: SANS, fontSize: '12px', color: TH_T2, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{svc.description}</div>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: SANS, fontSize: '11px', color: TH_T3 }}><Clock size={11} />{svc.duration_minutes} min</span>
                          {svc.price != null && svc.price > 0 && <span style={{ fontFamily: SANS, fontSize: '12px', fontWeight: 600, color: gold }}>${svc.price.toLocaleString('es-AR')}</span>}
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ color: isHov ? gold : TH_T3, flexShrink: 0, transition: 'color 0.18s' }} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* STEP 2 */}
        {state.step === 2 && state.service && (
          <div>
            <div style={{ fontFamily: SANS, fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: gold, marginBottom: '8px' }}>Paso 2</div>
            <ProfessionalSelector service={state.service} selected={state.professional} onSelect={p => update({ professional: p, fecha: undefined, hora: undefined })} onConfirm={() => update({ step: 3 })} onBack={() => update({ step: 1 })} accentColor={gold} tenantType={org.tenant_type ?? 'beauty'} darkMode={!isLight} />
          </div>
        )}

        {/* STEP 3 */}
        {state.step === 3 && state.professional && (
          <div>
            <div style={{ fontFamily: SANS, fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: gold, marginBottom: '8px' }}>Paso 3</div>
            <DateTimeSelector professional={state.professional} selectedDate={state.fecha} selectedTime={state.hora} serviceDurationMinutes={state.service?.duration_minutes ?? 30} serviceId={state.service?.id} onSelect={(fecha, hora) => update({ fecha, hora, step: 4 })} onBack={() => update({ step: 2 })} accentColor={gold} darkMode={!isLight} weeksToShow={(org as any).booking_weeks ?? 1} />
          </div>
        )}

        {/* STEP 4 */}
        {state.step === 4 && state.professional && state.service && (
          <div>
            <div style={{ fontFamily: SANS, fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: gold, marginBottom: '8px' }}>Paso 4</div>
            <BookingConfirm state={state} onChange={update} onBack={() => update({ step: 3 })} onComplete={() => setCompleted(true)} tenantType={org.tenant_type ?? 'medical'} accentColor={gold} darkMode={!isLight} />
          </div>
        )}

      </div>
    </div>
  )
}
