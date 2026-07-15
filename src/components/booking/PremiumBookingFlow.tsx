import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle, ChevronLeft, ChevronRight, Clock, MapPin, MessageCircle, Instagram } from 'lucide-react'
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
  const ctx     = getOrgContext(org)
  const gold    = org.primary_color ?? ctx.accentHint ?? '#C9A96E'
  const heroImg = org.cover_image_url ?? ctx.heroImg

  const [state, setState]           = useState<BookingState>(INIT)
  const [completed, setCompleted]   = useState(false)
  const [services, setServices]     = useState<Service[]>([])
  const [loadingSvc, setLoadingSvc] = useState(true)
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [hovCat, setHovCat]         = useState<string | null>(null)
  const [hovSvc, setHovSvc]         = useState<string | null>(null)
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
    <div style={{ minHeight: '100vh', backgroundColor: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${heroImg})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(24px)', opacity: 0.08, transform: 'scale(1.1)', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1, backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: '20px', padding: '40px 32px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: fade(gold), border: `1px solid ${bord(gold)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <CheckCircle size={28} style={{ color: gold }} />
        </div>
        <div style={{ fontFamily: SERIF, fontSize: '26px', fontStyle: 'italic', fontWeight: 400, color: TEXT_PRI, marginBottom: '8px' }}>{ctx.doneTitle}</div>
        <p style={{ fontFamily: SANS, fontSize: '13px', color: TEXT_SEC, marginBottom: '28px', lineHeight: 1.65 }}>{ctx.doneMsg}</p>
        <div style={{ backgroundColor: fade(gold), border: `1px solid ${bord(gold)}`, borderRadius: '12px', padding: '16px', textAlign: 'left', marginBottom: '24px' }}>
          {([['Servicio', state.service?.name ?? ''], ['Profesional', state.professional?.full_name ?? ''], ['Fecha', state.fecha ? format(parseISO(state.fecha), "EEEE d 'de' MMMM", { locale: es }) : ''], ['Hora', state.hora ? `${state.hora}hs` : '']] as [string,string][]).filter(([,v]) => v).map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontFamily: SANS, fontSize: '13px' }}>
              <span style={{ color: TEXT_MUTED }}>{label}</span>
              <span style={{ color: TEXT_PRI, fontWeight: 500, textTransform: label === 'Fecha' ? 'capitalize' : 'none' }}>{val}</span>
            </div>
          ))}
        </div>
        {whatsappNumber && (
          <a href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '10px', padding: '13px', fontFamily: SANS, fontSize: '13px', fontWeight: 500, cursor: 'pointer', textDecoration: 'none', marginBottom: '10px' }}>
            <MessageCircle size={15} /> Confirmar por WhatsApp
          </a>
        )}
        <button onClick={() => { setState(INIT); setCompleted(false); setSelectedCat(null) }}
          style={{ width: '100%', backgroundColor: gold, color: DARK, border: 'none', borderRadius: '10px', padding: '13px', fontFamily: SANS, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          {ctx.newBooking}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: DARK }}>

      {/* ─── HERO ─── */}
      <div style={{ position: 'relative', height: '88vh', minHeight: '580px', maxHeight: '900px' }}>
        <img src={heroImg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(11,11,11,0.2) 0%, rgba(11,11,11,0.5) 45%, rgba(11,11,11,0.94) 100%)' }} />
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', textAlign: 'center' }}>
          {logoUrl && (
            <img src={logoUrl} alt={org.name} style={{ width: '100px', height: '100px', objectFit: 'contain', backgroundColor: '#fff', borderRadius: '22px', padding: '10px', boxShadow: '0 16px 48px rgba(0,0,0,0.5)', marginBottom: '28px' }} />
          )}
          <div style={{ fontFamily: SANS, fontSize: '10px', fontWeight: 400, letterSpacing: '0.35em', textTransform: 'uppercase', color: gold, marginBottom: '14px' }}>{ctx.eyebrow}</div>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(30px, 6vw, 50px)', fontWeight: 400, fontStyle: 'italic', color: '#fff', margin: '0 0 18px', lineHeight: 1.15, maxWidth: '580px' }}>{org.name}</h1>
          <p style={{ fontFamily: SANS, fontSize: '15px', fontWeight: 300, color: 'rgba(255,255,255,0.58)', marginBottom: '44px', maxWidth: '320px', lineHeight: 1.65 }}>{org.booking_headline ?? ctx.subtitle}</p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '52px' }}>
            <button onClick={scrollToBooking}
              style={{ backgroundColor: gold, color: DARK, border: 'none', borderRadius: '8px', padding: '14px 36px', fontFamily: SANS, fontWeight: 600, fontSize: '13px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              {ctx.ctaLabel}
            </button>
            {instagramHandle && (
              <a href={`https://instagram.com/${instagramHandle}`} target="_blank" rel="noopener noreferrer"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '8px', padding: '14px 28px', fontFamily: SANS, fontWeight: 400, fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Instagram size={14} /> @{instagramHandle}
              </a>
            )}
          </div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {orgAddress && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(orgAddress)}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: SANS, fontSize: '12px', color: 'rgba(255,255,255,0.38)', textDecoration: 'none' }}>
                <MapPin size={13} />{orgAddress}
              </a>
            )}
            {whatsappNumber && (
              <a href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: SANS, fontSize: '12px', color: 'rgba(255,255,255,0.38)', textDecoration: 'none' }}>
                <MessageCircle size={13} />WhatsApp
              </a>
            )}
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: '28px', left: '50%', transform: 'translateX(-50%)' }}>
          <div style={{ width: '1px', height: '36px', background: `linear-gradient(to bottom, transparent, ${gold})` }} />
        </div>
      </div>

      {/* ─── STEPS BAR ─── */}
      <div ref={bookingRef} style={{ backgroundColor: '#0E0E0E', borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {STEPS.map((label, i) => {
              const n = i + 1; const isActive = state.step === n; const isDone = state.step > n
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontSize: '11px', fontWeight: 600, backgroundColor: isDone ? gold : 'transparent', border: isDone ? 'none' : isActive ? `1.5px solid ${gold}` : `1px solid rgba(255,255,255,0.18)`, color: isDone ? DARK : isActive ? gold : TEXT_MUTED }}>
                      {isDone ? '✓' : n}
                    </div>
                    <span style={{ fontFamily: SANS, fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', color: isActive ? gold : TEXT_MUTED, whiteSpace: 'nowrap' }}>{label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div style={{ flex: 1, height: '1px', margin: '0 6px 18px', backgroundColor: isDone ? gold : BORDER }} />}
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
              <h2 style={{ fontFamily: SERIF, fontSize: '28px', fontStyle: 'italic', fontWeight: 400, color: TEXT_PRI, margin: 0 }}>
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
                {[1,2,3,4].map(i => <div key={i} style={{ height: '140px', backgroundColor: CARD, borderRadius: '16px', border: `1px solid ${BORDER}` }} />)}
              </div>
            ) : !selectedCat && categories.length > 1 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {categories.map(cat => {
                  const count = services.filter(s => s.category === cat).length
                  const grad  = CAT_GRADIENT[cat] ?? DEFAULT_GRAD
                  const isHov = hovCat === cat
                  return (
                    <button key={cat} onClick={() => setSelectedCat(cat)} onMouseEnter={() => setHovCat(cat)} onMouseLeave={() => setHovCat(null)}
                      style={{ position: 'relative', height: '140px', borderRadius: '16px', overflow: 'hidden', border: isHov ? `1px solid ${gold}` : `1px solid ${BORDER}`, cursor: 'pointer', background: grad, padding: 0, transition: 'border-color 0.2s, transform 0.15s', transform: isHov ? 'scale(1.02)' : 'scale(1)', textAlign: 'left' }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.04\'/%3E%3C/svg%3E")', opacity: 0.4 }} />
                      <div style={{ position: 'absolute', top: 0, left: '20px', width: '24px', height: '2px', backgroundColor: isHov ? gold : 'rgba(255,255,255,0.15)', transition: 'background-color 0.2s, width 0.2s', ...(isHov ? { width: '36px' } : {}) }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '18px 18px 16px' }}>
                        <div style={{ fontFamily: SERIF, fontSize: '18px', fontStyle: 'italic', color: TEXT_PRI, marginBottom: '4px', lineHeight: 1.2 }}>{cat}</div>
                        <div style={{ fontFamily: SANS, fontSize: '11px', color: isHov ? gold : TEXT_MUTED, transition: 'color 0.2s' }}>{count} {count === 1 ? 'opción' : 'opciones'} →</div>
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
                      style={{ display: 'flex', alignItems: 'center', borderRadius: '14px', border: isHov ? `1px solid ${gold}` : `1px solid ${BORDER}`, backgroundColor: isHov ? CARD2 : CARD, cursor: 'pointer', padding: '18px 20px', textAlign: 'left', transition: 'all 0.18s', gap: '14px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isHov ? gold : 'rgba(255,255,255,0.2)', flexShrink: 0, transition: 'background-color 0.18s' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: '14px', color: TEXT_PRI, marginBottom: '3px' }}>{svc.name}</div>
                        {svc.description && <div style={{ fontFamily: SANS, fontSize: '12px', color: TEXT_SEC, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{svc.description}</div>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: SANS, fontSize: '11px', color: TEXT_MUTED }}><Clock size={11} />{svc.duration_minutes} min</span>
                          {svc.price != null && svc.price > 0 && <span style={{ fontFamily: SANS, fontSize: '12px', fontWeight: 600, color: gold }}>${svc.price.toLocaleString('es-AR')}</span>}
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ color: isHov ? gold : TEXT_MUTED, flexShrink: 0, transition: 'color 0.18s' }} />
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
            <ProfessionalSelector service={state.service} selected={state.professional} onSelect={p => update({ professional: p, fecha: undefined, hora: undefined })} onConfirm={() => update({ step: 3 })} onBack={() => update({ step: 1 })} accentColor={gold} tenantType={org.tenant_type ?? 'beauty'} darkMode={true} />
          </div>
        )}

        {/* STEP 3 */}
        {state.step === 3 && state.professional && (
          <div>
            <div style={{ fontFamily: SANS, fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: gold, marginBottom: '8px' }}>Paso 3</div>
            <DateTimeSelector professional={state.professional} selectedDate={state.fecha} selectedTime={state.hora} serviceDurationMinutes={state.service?.duration_minutes ?? 30} onSelect={(fecha, hora) => update({ fecha, hora, step: 4 })} onBack={() => update({ step: 2 })} accentColor={gold} darkMode={true} weeksToShow={(org as any).booking_weeks ?? 1} />
          </div>
        )}

        {/* STEP 4 */}
        {state.step === 4 && state.professional && state.service && (
          <div>
            <div style={{ fontFamily: SANS, fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: gold, marginBottom: '8px' }}>Paso 4</div>
            <BookingConfirm state={state} onChange={update} onBack={() => update({ step: 3 })} onComplete={() => setCompleted(true)} tenantType={org.tenant_type ?? 'medical'} accentColor={gold} darkMode={true} />
          </div>
        )}

      </div>
    </div>
  )
}
