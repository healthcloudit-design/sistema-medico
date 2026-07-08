import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle, ChevronLeft, Clock, MapPin, MessageCircle, Instagram } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import type { BookingState, Organization, Professional, Service } from '../../types'
import { ProfessionalSelector } from './ProfessionalSelector'
import { DateTimeSelector } from './DateTimeSelector'
import { BookingConfirm } from './BookingConfirm'

// ── Design tokens ──────────────────────────────────────────────────────────
const G = {
  gold:      '#C9A96E',
  goldFade:  'rgba(201,169,110,0.12)',
  goldBorder:'rgba(201,169,110,0.25)',
  dark:      '#0B0B0B',
  card:      '#141414',
  border:    'rgba(255,255,255,0.07)',
  textPri:   '#FFFFFF',
  textSec:   'rgba(255,255,255,0.52)',
  textMuted: 'rgba(255,255,255,0.25)',
  serif:     "'Playfair Display', Georgia, serif",
  sans:      "'Inter', sans-serif",
}

// ── Category images — editorial, brand-specific, NOT generic stock ─────────
// These represent the ESSENCE of each service, not the category
const CAT_IMG: Record<string, string> = {
  // Hair — close-up artisan work, not salon interior
  'Peluquería':   'https://images.unsplash.com/photo-1522337660859-02dc82f4c5b9?w=600&h=450&fit=crop&auto=format&q=85',
  'Peluqueria':   'https://images.unsplash.com/photo-1522337660859-02dc82f4c5b9?w=600&h=450&fit=crop&auto=format&q=85',
  // Nails — artistic detail, editorial
  'Manicuría':    'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&h=450&fit=crop&auto=format&q=85',
  'Manicuria':    'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&h=450&fit=crop&auto=format&q=85',
  'Manos':        'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&h=450&fit=crop&auto=format&q=85',
  // Feet
  'Pedicuría':    'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=600&h=450&fit=crop&auto=format&q=85',
  'Pedicuria':    'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=600&h=450&fit=crop&auto=format&q=85',
  // Massage — warm, intimate, textural
  'Masajes':      'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&h=450&fit=crop&auto=format&q=85',
  // Facial — luminous skin, not spa stock
  'Facial':       'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=450&fit=crop&auto=format&q=85',
  // Barber — artisan craft
  'Barbería':     'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&h=450&fit=crop&auto=format&q=85',
  'Barberia':     'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&h=450&fit=crop&auto=format&q=85',
  // Nail art
  'Nail Art':     'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&h=450&fit=crop&auto=format&q=85',
  'Semi':         'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&h=450&fit=crop&auto=format&q=85',
  'Esculpidas':   'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&h=450&fit=crop&auto=format&q=85',
  'Kapping':      'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&h=450&fit=crop&auto=format&q=85',
  // Aesthetic & lymph
  'Drenaje':      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&h=450&fit=crop&auto=format&q=85',
  'Reflexología': 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&h=450&fit=crop&auto=format&q=85',
  'Aparatología': 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&h=450&fit=crop&auto=format&q=85',
  // Dermatology — luminous skin, premium aesthetic medicine — NOT medical stock
  'Consultas':    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=450&fit=crop&auto=format&q=85',
  'Tratamientos': 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=450&fit=crop&auto=format&q=85',
  'Procedimientos':'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&h=450&fit=crop&auto=format&q=85',
  // Sports
  'Fútbol':       'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=600&h=450&fit=crop&auto=format&q=85',
  'Pádel':        'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=600&h=450&fit=crop&auto=format&q=85',
  'Tenis':        'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=600&h=450&fit=crop&auto=format&q=85',
}

// ── Service thumbnail — keyword matching ────────────────────────────────────
const SVC_KW: [string, string][] = [
  ['keratina',      'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=160&h=160&fit=crop&auto=format'],
  ['alisado',       'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=160&h=160&fit=crop&auto=format'],
  ['brushing',      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=160&h=160&fit=crop&auto=format'],
  ['color',         'https://images.unsplash.com/photo-1522337660859-02dc82f4c5b9?w=160&h=160&fit=crop&auto=format'],
  ['tintura',       'https://images.unsplash.com/photo-1522337660859-02dc82f4c5b9?w=160&h=160&fit=crop&auto=format'],
  ['mechas',        'https://images.unsplash.com/photo-1522337660859-02dc82f4c5b9?w=160&h=160&fit=crop&auto=format'],
  ['corte',         'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=160&h=160&fit=crop&auto=format'],
  ['semipermanente','https://images.unsplash.com/photo-1604654894610-df63bc536371?w=160&h=160&fit=crop&auto=format'],
  ['esculpidas',    'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=160&h=160&fit=crop&auto=format'],
  ['manicur',       'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=160&h=160&fit=crop&auto=format'],
  ['pedicur',       'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=160&h=160&fit=crop&auto=format'],
  ['masaje',        'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=160&h=160&fit=crop&auto=format'],
  ['drenaje',       'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=160&h=160&fit=crop&auto=format'],
  ['botox',         'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=160&h=160&fit=crop&auto=format'],
  ['toxina',        'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=160&h=160&fit=crop&auto=format'],
  ['hialur',        'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=160&h=160&fit=crop&auto=format'],
  ['relleno',       'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=160&h=160&fit=crop&auto=format'],
  ['peeling',       'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=160&h=160&fit=crop&auto=format'],
  ['laser',         'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=160&h=160&fit=crop&auto=format'],
  ['láser',         'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=160&h=160&fit=crop&auto=format'],
  ['bioestimul',    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=160&h=160&fit=crop&auto=format'],
  ['consulta',      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=160&h=160&fit=crop&auto=format'],
  ['rinoplastia',   'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=160&h=160&fit=crop&auto=format'],
  ['f-cell',        'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=160&h=160&fit=crop&auto=format'],
]

function svcThumb(name: string, catImg: string | null): string | null {
  const lc = name.toLowerCase()
  for (const [kw, url] of SVC_KW) if (lc.includes(kw)) return url
  return catImg
}

const INIT: BookingState = {
  step: 1, nombre: '', telefono: '', email: '', dni: '',
  obra_social: '', nro_socio: '', observaciones: '',
}

const STEPS = ['Servicio', 'Profesional', 'Fecha y hora', 'Confirmar']

// ── Hero image — editorial, changes per category if detected ───────────────
// Default: editorial hair & beauty (warm, intimate)
const HERO_DEFAULT = 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1600&h=900&fit=crop&auto=format&q=80'

export function PremiumBookingFlow({ org }: { org: Organization }) {
  const [state, setState]       = useState<BookingState>(INIT)
  const [completed, setCompleted] = useState(false)
  const [services, setServices]   = useState<Service[]>([])
  const [loadingSvc, setLoadingSvc] = useState(true)
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [hovCat, setHovCat]     = useState<string | null>(null)
  const [hovSvc, setHovSvc]     = useState<string | null>(null)
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

  useEffect(() => {
    if (state.step > 1) scrollToBooking()
  }, [state.step])

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

  // ── Completed ─────────────────────────────────────────────────────────────
  if (completed) return (
    <div style={{ minHeight: '100vh', backgroundColor: G.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative' }}>
      {/* Subtle bg texture */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${HERO_DEFAULT})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(24px)', opacity: 0.08, transform: 'scale(1.1)', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1, backgroundColor: G.card, border: `1px solid ${G.border}`, borderRadius: '20px', padding: '40px 32px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: G.goldFade, border: `1px solid ${G.goldBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <CheckCircle size={28} style={{ color: G.gold }} />
        </div>
        <div style={{ fontFamily: G.serif, fontSize: '26px', fontStyle: 'italic', fontWeight: 400, color: G.textPri, marginBottom: '8px' }}>Reserva confirmada</div>
        <p style={{ fontFamily: G.sans, fontSize: '13px', color: G.textSec, marginBottom: '28px', lineHeight: 1.65 }}>
          Tu reserva fue registrada. Te contactamos para confirmar.
        </p>
        <div style={{ backgroundColor: G.goldFade, border: `1px solid ${G.goldBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'left', marginBottom: '24px' }}>
          {[
            ['Servicio',    state.service?.name ?? ''],
            ['Profesional', state.professional?.full_name ?? ''],
            ['Fecha',       state.fecha ? format(parseISO(state.fecha), "EEEE d 'de' MMMM", { locale: es }) : ''],
            ['Hora',        state.hora ? `${state.hora}hs` : ''],
          ].filter(([, v]) => v).map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontFamily: G.sans, fontSize: '13px', textTransform: label === 'Fecha' ? 'capitalize' : 'none' }}>
              <span style={{ color: G.textMuted }}>{label}</span>
              <span style={{ color: G.textPri, fontWeight: 500 }}>{val}</span>
            </div>
          ))}
        </div>
        {whatsappNumber && (
          <a href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '10px', padding: '13px', fontFamily: G.sans, fontSize: '13px', fontWeight: 500, cursor: 'pointer', textDecoration: 'none', marginBottom: '10px' }}>
            <MessageCircle size={15} /> Confirmar por WhatsApp
          </a>
        )}
        <button onClick={() => { setState(INIT); setCompleted(false); setSelectedCat(null) }}
          style={{ width: '100%', backgroundColor: G.gold, color: G.dark, border: 'none', borderRadius: '10px', padding: '13px', fontFamily: G.sans, fontSize: '13px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em' }}>
          Reservar otro turno
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: G.dark }}>

      {/* ─────────── HERO ─────────── */}
      <div style={{ position: 'relative', height: '88vh', minHeight: '580px', maxHeight: '900px' }}>
        <img src={HERO_DEFAULT} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(11,11,11,0.2) 0%, rgba(11,11,11,0.5) 45%, rgba(11,11,11,0.94) 100%)' }} />
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', textAlign: 'center' }}>

          {logoUrl && (
            <img src={logoUrl} alt={org.name}
              style={{ width: '100px', height: '100px', objectFit: 'contain', backgroundColor: '#fff', borderRadius: '22px', padding: '10px', boxShadow: '0 16px 48px rgba(0,0,0,0.5)', marginBottom: '28px' }}
            />
          )}

          <div style={{ fontFamily: G.sans, fontSize: '10px', fontWeight: 400, letterSpacing: '0.35em', textTransform: 'uppercase', color: G.gold, marginBottom: '14px' }}>
            {org.tenant_type === 'estetica' ? 'Estética de Autor' : 'Peluquería de Autora'}
          </div>

          <h1 style={{ fontFamily: G.serif, fontSize: 'clamp(34px, 7vw, 54px)', fontWeight: 400, fontStyle: 'italic', color: '#fff', margin: '0 0 18px', lineHeight: 1.15, maxWidth: '540px' }}>
            {org.name}
          </h1>

          <p style={{ fontFamily: G.sans, fontSize: '15px', fontWeight: 300, color: 'rgba(255,255,255,0.58)', marginBottom: '44px', maxWidth: '320px', lineHeight: 1.65 }}>
            Reservá tu experiencia personalizada
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '52px' }}>
            <button onClick={scrollToBooking}
              style={{ backgroundColor: G.gold, color: G.dark, border: 'none', borderRadius: '8px', padding: '14px 36px', fontFamily: G.sans, fontWeight: 600, fontSize: '13px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Reservar Turno
            </button>
            {instagramHandle && (
              <a href={`https://instagram.com/${instagramHandle}`} target="_blank" rel="noopener noreferrer"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '8px', padding: '14px 28px', fontFamily: G.sans, fontWeight: 400, fontSize: '13px', letterSpacing: '0.04em', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Instagram size={14} /> Ver Instagram
              </a>
            )}
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {orgAddress && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(orgAddress)}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: G.sans, fontSize: '12px', color: 'rgba(255,255,255,0.38)', textDecoration: 'none' }}>
                <MapPin size={13} />{orgAddress}
              </a>
            )}
            {whatsappNumber && (
              <a href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: G.sans, fontSize: '12px', color: 'rgba(255,255,255,0.38)', textDecoration: 'none' }}>
                <MessageCircle size={13} />WhatsApp
              </a>
            )}
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: '28px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '1px', height: '36px', background: `linear-gradient(to bottom, transparent, ${G.gold})` }} />
        </div>
      </div>

      {/* ─────────── STEPS BAR (sticky) ─────────── */}
      <div ref={bookingRef} style={{ backgroundColor: '#0E0E0E', borderBottom: `1px solid ${G.border}`, position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {STEPS.map((label, i) => {
              const n        = i + 1
              const isActive = state.step === n
              const isDone   = state.step > n
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: G.sans, fontSize: '11px', fontWeight: 600, transition: 'all 0.25s', backgroundColor: isDone ? G.gold : 'transparent', border: isDone ? 'none' : isActive ? `1.5px solid ${G.gold}` : `1px solid rgba(255,255,255,0.18)`, color: isDone ? G.dark : isActive ? G.gold : G.textMuted }}>
                      {isDone ? '✓' : n}
                    </div>
                    <span style={{ fontFamily: G.sans, fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', color: isActive ? G.gold : G.textMuted, whiteSpace: 'nowrap' }}>
                      {label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ flex: 1, height: '1px', margin: '0 6px 18px', backgroundColor: isDone ? G.gold : G.border, transition: 'background-color 0.3s' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─────────── CONTENT ─────────── */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 20px 80px', position: 'relative' }}>

        {/* Subtle blurred texture behind content */}
        <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${HERO_DEFAULT})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(32px)', opacity: 0.06, transform: 'scale(1.1)', zIndex: 0, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── STEP 1: Services ── */}
        {state.step === 1 && (
          <div>
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontFamily: G.sans, fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: G.gold, marginBottom: '8px' }}>Paso 1</div>
              <h2 style={{ fontFamily: G.serif, fontSize: '28px', fontStyle: 'italic', fontWeight: 400, color: G.textPri, margin: 0 }}>
                {selectedCat ? `Servicios de ${selectedCat}` : '¿Qué servicio buscás?'}
              </h2>
            </div>

            {selectedCat && (
              <button onClick={() => setSelectedCat(null)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: G.sans, fontSize: '12px', color: G.gold, background: 'none', border: `1px solid ${G.goldBorder}`, borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', marginBottom: '20px' }}>
                <ChevronLeft size={14} /> {selectedCat}
              </button>
            )}

            {loadingSvc ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {[1,2,3,4].map(i => <div key={i} style={{ aspectRatio: '4/3', backgroundColor: G.card, borderRadius: '16px' }} />)}
              </div>
            ) : !selectedCat && categories.length > 1 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {categories.map(cat => {
                  const img   = CAT_IMG[cat] ?? null
                  const count = services.filter(s => s.category === cat).length
                  const isHov = hovCat === cat
                  return (
                    <button key={cat} onClick={() => setSelectedCat(cat)} onMouseEnter={() => setHovCat(cat)} onMouseLeave={() => setHovCat(null)}
                      style={{ position: 'relative', aspectRatio: '4/3', borderRadius: '16px', overflow: 'hidden', border: isHov ? `1px solid ${G.gold}` : `1px solid ${G.border}`, cursor: 'pointer', background: 'none', padding: 0, transition: 'border-color 0.2s, transform 0.2s', transform: isHov ? 'scale(1.02)' : 'scale(1)' }}>
                      {img
                        ? <img src={img} alt={cat} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: isHov ? 'scale(1.06)' : 'scale(1)', transition: 'transform 0.35s ease' }} />
                        : <div style={{ position: 'absolute', inset: 0, backgroundColor: G.card }} />
                      }
                      <div style={{ position: 'absolute', inset: 0, background: isHov ? 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.82) 100%)' : 'linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.72) 100%)', transition: 'background 0.2s' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px' }}>
                        <div style={{ fontFamily: G.serif, fontSize: '17px', fontStyle: 'italic', color: '#fff', marginBottom: '2px' }}>{cat}</div>
                        <div style={{ fontFamily: G.sans, fontSize: '11px', color: isHov ? G.gold : 'rgba(255,255,255,0.5)', transition: 'color 0.2s' }}>{count} {count === 1 ? 'opción' : 'opciones'}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredSvcs.map(svc => {
                  const thumb  = svcThumb(svc.name, selectedCat ? (CAT_IMG[selectedCat] ?? null) : null)
                  const isHov  = hovSvc === svc.id
                  return (
                    <button key={svc.id} onClick={() => handleServiceSelect(svc)} onMouseEnter={() => setHovSvc(svc.id)} onMouseLeave={() => setHovSvc(null)}
                      style={{ display: 'flex', alignItems: 'stretch', borderRadius: '14px', overflow: 'hidden', border: isHov ? `1px solid ${G.gold}` : `1px solid ${G.border}`, backgroundColor: isHov ? '#1C1C1C' : G.card, cursor: 'pointer', padding: 0, textAlign: 'left', transition: 'all 0.2s' }}>
                      {thumb && (
                        <div style={{ width: '80px', flexShrink: 0, overflow: 'hidden' }}>
                          <img src={thumb} alt={svc.name} style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: '80px' }} />
                        </div>
                      )}
                      <div style={{ flex: 1, padding: '14px 16px' }}>
                        <div style={{ fontFamily: G.sans, fontWeight: 500, fontSize: '14px', color: G.textPri, marginBottom: '3px' }}>{svc.name}</div>
                        {svc.description && <div style={{ fontFamily: G.sans, fontSize: '12px', color: G.textSec, lineHeight: 1.5, marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{svc.description}</div>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: G.sans, fontSize: '11px', color: G.textMuted }}><Clock size={11} />{svc.duration_minutes} min</span>
                          {svc.price != null && svc.price > 0 && <span style={{ fontFamily: G.sans, fontSize: '12px', fontWeight: 500, color: G.gold }}>${svc.price.toLocaleString('es-AR')}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px 0 4px', color: G.textMuted, flexShrink: 0, fontSize: '18px' }}>›</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Professional — fully dark ── */}
        {state.step === 2 && state.service && (
          <div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontFamily: G.sans, fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: G.gold, marginBottom: '8px' }}>Paso 2</div>
            </div>
            <ProfessionalSelector
              service={state.service}
              selected={state.professional}
              onSelect={p => update({ professional: p, fecha: undefined, hora: undefined })}
              onConfirm={() => update({ step: 3 })}
              onBack={() => update({ step: 1 })}
              accentColor={G.gold}
              tenantType={org.tenant_type ?? 'beauty'}
              darkMode={true}
            />
          </div>
        )}

        {/* ── STEP 3: Date / Time — fully dark ── */}
        {state.step === 3 && state.professional && (
          <div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontFamily: G.sans, fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: G.gold, marginBottom: '8px' }}>Paso 3</div>
            </div>
            <DateTimeSelector
              professional={state.professional}
              selectedDate={state.fecha}
              selectedTime={state.hora}
              serviceDurationMinutes={state.service?.duration_minutes ?? 30}
              onSelect={(fecha, hora) => update({ fecha, hora, step: 4 })}
              onBack={() => update({ step: 2 })}
              accentColor={G.gold}
              darkMode={true}
            />
          </div>
        )}

        {/* ── STEP 4: Confirm — fully dark ── */}
        {state.step === 4 && (
          <div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontFamily: G.sans, fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: G.gold, marginBottom: '8px' }}>Paso 4</div>
            </div>
            <BookingConfirm
              state={state}
              onChange={update}
              onBack={() => update({ step: 3 })}
              onComplete={() => setCompleted(true)}
              tenantType={org.tenant_type ?? 'beauty'}
              accentColor={G.gold}
              darkMode={true}
            />
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
