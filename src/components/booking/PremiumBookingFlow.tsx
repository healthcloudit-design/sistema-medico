import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle, ChevronLeft, Clock, MapPin, MessageCircle, Instagram } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import type { BookingState, Organization, Professional, Service } from '../../types'
import { ProfessionalSelector } from './ProfessionalSelector'
import { DateTimeSelector } from './DateTimeSelector'
import { BookingConfirm } from './BookingConfirm'

// ── Design tokens ──────────────────────────────────────────────────────────
const G = {
  gold:      '#C9A96E',
  goldLight: '#E8D4A8',
  dark:      '#0B0B0B',
  card:      '#141414',
  cardHov:   '#1C1C1C',
  border:    'rgba(255,255,255,0.07)',
  borderGold:'rgba(201,169,110,0.3)',
  textPri:   '#FFFFFF',
  textSec:   'rgba(255,255,255,0.55)',
  textMuted: 'rgba(255,255,255,0.28)',
  serif:     "'Playfair Display', Georgia, serif",
  sans:      "'Inter', sans-serif",
}

// ── Category images ────────────────────────────────────────────────────────
const CAT_IMG: Record<string, string> = {
  'Peluquería': 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&h=450&fit=crop&auto=format',
  'Manicuría':  'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&h=450&fit=crop&auto=format',
  'Pedicuría':  'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=600&h=450&fit=crop&auto=format',
  'Manos':      'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&h=450&fit=crop&auto=format',
  'Masajes':    'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&h=450&fit=crop&auto=format',
  'Facial':     'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=450&fit=crop&auto=format',
  'Barbería':   'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&h=450&fit=crop&auto=format',
  'Nail Art':   'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&h=450&fit=crop&auto=format',
}

const SVC_KW: [string, string][] = [
  ['keratina',    'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=160&h=160&fit=crop&auto=format'],
  ['alisado',     'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=160&h=160&fit=crop&auto=format'],
  ['brushing',    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=160&h=160&fit=crop&auto=format'],
  ['color',       'https://images.unsplash.com/photo-1522337660859-02dc82f4c5b9?w=160&h=160&fit=crop&auto=format'],
  ['tintura',     'https://images.unsplash.com/photo-1522337660859-02dc82f4c5b9?w=160&h=160&fit=crop&auto=format'],
  ['mechas',      'https://images.unsplash.com/photo-1522337660859-02dc82f4c5b9?w=160&h=160&fit=crop&auto=format'],
  ['corte',       'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=160&h=160&fit=crop&auto=format'],
  ['semipermanente','https://images.unsplash.com/photo-1604654894610-df63bc536371?w=160&h=160&fit=crop&auto=format'],
  ['esculpidas',  'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=160&h=160&fit=crop&auto=format'],
  ['manicur',     'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=160&h=160&fit=crop&auto=format'],
  ['pedicur',     'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=160&h=160&fit=crop&auto=format'],
  ['masaje',      'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=160&h=160&fit=crop&auto=format'],
  ['drenaje',     'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=160&h=160&fit=crop&auto=format'],
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

// ── Component ──────────────────────────────────────────────────────────────
export function PremiumBookingFlow({ org }: { org: Organization }) {
  const [state, setState]     = useState<BookingState>(INIT)
  const [completed, setCompleted] = useState(false)
  const [services, setServices]   = useState<Service[]>([])
  const [loadingSvc, setLoadingSvc] = useState(true)
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [hovCat, setHovCat]   = useState<string | null>(null)
  const [hovSvc, setHovSvc]   = useState<string | null>(null)
  const bookingRef = useRef<HTMLDivElement>(null)

  const instagramHandle = org.instagram_handle?.replace(/^@/, '') ?? null
  const whatsappNumber  = org.whatsapp_number ?? null
  const orgAddress      = org.address ?? null
  const logoUrl         = org.logo_url ?? null

  // Fetch services
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

  // Select service — skip professional if only 1
  const handleServiceSelect = async (svc: Service) => {
    const { data } = await supabase
      .from('professional_services')
      .select('professionals(id, full_name, specialty, bio, avatar_url, active)')
      .eq('service_id', svc.id)

    const profs = (data ?? [])
      .map((r: any) => r.professionals as Professional)
      .filter(p => p?.active)

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

  const STEPS = ['Servicio', 'Profesional', 'Fecha y hora', 'Confirmar']

  // ── Completed ─────────────────────────────────────────────────────────────
  if (completed) return (
    <div style={{ minHeight: '100vh', backgroundColor: G.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ backgroundColor: G.card, border: `1px solid ${G.border}`, borderRadius: '20px', padding: '40px 32px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(201,169,110,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <CheckCircle style={{ width: '32px', height: '32px', color: G.gold }} />
        </div>
        <div style={{ fontFamily: G.serif, fontSize: '28px', fontStyle: 'italic', color: G.textPri, marginBottom: '8px' }}>Reserva confirmada</div>
        <p style={{ fontFamily: G.sans, fontSize: '14px', color: G.textSec, marginBottom: '28px', lineHeight: 1.6 }}>
          Tu reserva fue registrada. Te contactamos para confirmar.
        </p>
        <div style={{ backgroundColor: 'rgba(201,169,110,0.07)', border: `1px solid ${G.borderGold}`, borderRadius: '12px', padding: '16px', textAlign: 'left', marginBottom: '24px' }}>
          {[
            ['Servicio', state.service?.name],
            ['Fecha',    state.fecha ? format(parseISO(state.fecha), 'dd/MM/yyyy') : ''],
            ['Hora',     state.hora ? `${state.hora}hs` : ''],
          ].map(([label, val]) => val ? (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontFamily: G.sans, fontSize: '13px' }}>
              <span style={{ color: G.textMuted }}>{label}</span>
              <span style={{ color: G.textPri }}>{val}</span>
            </div>
          ) : null)}
        </div>
        <button
          onClick={() => { setState(INIT); setCompleted(false); setSelectedCat(null) }}
          style={{ width: '100%', backgroundColor: G.gold, color: G.dark, border: 'none', borderRadius: '10px', padding: '14px', fontFamily: G.sans, fontSize: '14px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em' }}
        >
          Reservar otro turno
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: G.dark }}>

      {/* ─────────── HERO ─────────── */}
      <div style={{ position: 'relative', height: '88vh', minHeight: '580px', maxHeight: '900px' }}>
        {/* bg image */}
        <img
          src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1600&h=900&fit=crop&auto=format&q=80"
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}
        />
        {/* overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(11,11,11,0.25) 0%, rgba(11,11,11,0.55) 50%, rgba(11,11,11,0.92) 100%)' }} />

        {/* content */}
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', textAlign: 'center' }}>

          {/* logo */}
          {logoUrl && (
            <div style={{ marginBottom: '28px' }}>
              <img
                src={logoUrl}
                alt={org.name}
                style={{ width: '96px', height: '96px', objectFit: 'contain', backgroundColor: '#fff', borderRadius: '22px', padding: '10px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}
              />
            </div>
          )}

          {/* eyebrow */}
          <div style={{ fontFamily: G.sans, fontSize: '10px', fontWeight: 400, letterSpacing: '0.35em', textTransform: 'uppercase', color: G.gold, marginBottom: '14px' }}>
            Peluquería de Autora
          </div>

          {/* name */}
          <h1 style={{ fontFamily: G.serif, fontSize: 'clamp(36px, 7vw, 56px)', fontWeight: 400, fontStyle: 'italic', color: '#fff', margin: '0 0 18px', lineHeight: 1.15, letterSpacing: '-0.01em', maxWidth: '560px' }}>
            {org.name}
          </h1>

          {/* tagline */}
          <p style={{ fontFamily: G.sans, fontSize: '15px', fontWeight: 300, color: 'rgba(255,255,255,0.62)', marginBottom: '44px', maxWidth: '340px', lineHeight: 1.65 }}>
            Reservá tu experiencia personalizada
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '52px' }}>
            <button
              onClick={scrollToBooking}
              style={{ backgroundColor: G.gold, color: G.dark, border: 'none', borderRadius: '8px', padding: '14px 36px', fontFamily: G.sans, fontWeight: 600, fontSize: '13px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Reservar Turno
            </button>
            {instagramHandle && (
              <a
                href={`https://instagram.com/${instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '14px 32px', fontFamily: G.sans, fontWeight: 400, fontSize: '13px', letterSpacing: '0.04em', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <Instagram size={14} /> Ver Instagram
              </a>
            )}
          </div>

          {/* meta info */}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {orgAddress && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(orgAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: G.sans, fontSize: '12px', color: 'rgba(255,255,255,0.42)', textDecoration: 'none' }}
              >
                <MapPin size={13} />{orgAddress}
              </a>
            )}
            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: G.sans, fontSize: '12px', color: 'rgba(255,255,255,0.42)', textDecoration: 'none' }}
              >
                <MessageCircle size={13} />WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* scroll hint */}
        <div style={{ position: 'absolute', bottom: '28px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '1px', height: '32px', background: `linear-gradient(to bottom, transparent, ${G.gold})` }} />
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
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: G.sans, fontSize: '11px', fontWeight: 600, transition: 'all 0.25s',
                      backgroundColor: isDone ? G.gold : 'transparent',
                      border: isDone ? 'none' : isActive ? `1.5px solid ${G.gold}` : `1px solid rgba(255,255,255,0.18)`,
                      color: isDone ? G.dark : isActive ? G.gold : G.textMuted,
                    }}>
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
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '36px 20px 80px' }}>

        {/* ── STEP 1: Service ── */}
        {state.step === 1 && (
          <div>
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontFamily: G.sans, fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: G.gold, marginBottom: '8px' }}>
                Paso 1
              </div>
              <h2 style={{ fontFamily: G.serif, fontSize: '28px', fontStyle: 'italic', fontWeight: 400, color: G.textPri, margin: 0 }}>
                {selectedCat ? `Servicios de ${selectedCat}` : '¿Qué servicio buscás?'}
              </h2>
            </div>

            {/* Back to categories */}
            {selectedCat && (
              <button
                onClick={() => setSelectedCat(null)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: G.sans, fontSize: '12px', color: G.gold, background: 'none', border: `1px solid ${G.borderGold}`, borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', marginBottom: '20px', letterSpacing: '0.04em' }}
              >
                <ChevronLeft size={14} /> {selectedCat}
              </button>
            )}

            {loadingSvc ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{ aspectRatio: '4/3', backgroundColor: G.card, borderRadius: '16px', animation: 'pulse 1.5s ease-in-out infinite' }} />
                ))}
              </div>
            ) : !selectedCat && categories.length > 1 ? (
              /* Category grid */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {categories.map(cat => {
                  const img    = CAT_IMG[cat] ?? null
                  const count  = services.filter(s => s.category === cat).length
                  const isHov  = hovCat === cat
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCat(cat)}
                      onMouseEnter={() => setHovCat(cat)}
                      onMouseLeave={() => setHovCat(null)}
                      style={{ position: 'relative', aspectRatio: '4/3', borderRadius: '16px', overflow: 'hidden', border: isHov ? `1px solid ${G.gold}` : `1px solid ${G.border}`, cursor: 'pointer', background: 'none', padding: 0, transition: 'border-color 0.2s', transform: isHov ? 'scale(1.02)' : 'scale(1)', transitionProperty: 'border-color, transform', transitionDuration: '0.2s' }}
                    >
                      {img ? (
                        <img src={img} alt={cat} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: isHov ? 'scale(1.06)' : 'scale(1)', transition: 'transform 0.35s ease' }} />
                      ) : (
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: G.card }} />
                      )}
                      <div style={{ position: 'absolute', inset: 0, background: isHov ? 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.8) 100%)' : 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.72) 100%)', transition: 'background 0.2s' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px' }}>
                        <div style={{ fontFamily: G.serif, fontSize: '17px', fontStyle: 'italic', color: '#fff', marginBottom: '2px' }}>{cat}</div>
                        <div style={{ fontFamily: G.sans, fontSize: '11px', color: isHov ? G.gold : 'rgba(255,255,255,0.55)', transition: 'color 0.2s' }}>
                          {count} {count === 1 ? 'opción' : 'opciones'}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              /* Service list */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredSvcs.map(svc => {
                  const thumb  = svcThumb(svc.name, selectedCat ? (CAT_IMG[selectedCat] ?? null) : null)
                  const isHov  = hovSvc === svc.id
                  return (
                    <button
                      key={svc.id}
                      onClick={() => handleServiceSelect(svc)}
                      onMouseEnter={() => setHovSvc(svc.id)}
                      onMouseLeave={() => setHovSvc(null)}
                      style={{
                        display: 'flex', alignItems: 'stretch', borderRadius: '14px', overflow: 'hidden', border: isHov ? `1px solid ${G.gold}` : `1px solid ${G.border}`, backgroundColor: isHov ? G.cardHov : G.card, cursor: 'pointer', padding: 0, textAlign: 'left', transition: 'all 0.2s',
                      }}
                    >
                      {thumb && (
                        <div style={{ width: '80px', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                          <img src={thumb} alt={svc.name} style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: '80px' }} />
                          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.15)' }} />
                        </div>
                      )}
                      <div style={{ flex: 1, padding: '14px 16px' }}>
                        <div style={{ fontFamily: G.sans, fontWeight: 500, fontSize: '14px', color: G.textPri, marginBottom: '3px' }}>{svc.name}</div>
                        {svc.description && (
                          <div style={{ fontFamily: G.sans, fontSize: '12px', color: G.textSec, lineHeight: 1.5, marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {svc.description}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: G.sans, fontSize: '11px', color: G.textMuted }}>
                            <Clock size={11} />{svc.duration_minutes} min
                          </span>
                          {svc.price != null && svc.price > 0 && (
                            <span style={{ fontFamily: G.sans, fontSize: '12px', fontWeight: 500, color: G.gold }}>
                              ${svc.price.toLocaleString('es-AR')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px 0 4px', color: G.textMuted, flexShrink: 0 }}>›</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Professional ── */}
        {state.step === 2 && state.service && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontFamily: G.sans, fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: G.gold, marginBottom: '8px' }}>Paso 2</div>
              <h2 style={{ fontFamily: G.serif, fontSize: '28px', fontStyle: 'italic', fontWeight: 400, color: G.textPri, margin: 0 }}>Elegí tu profesional</h2>
            </div>
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', overflow: 'hidden' }}>
              <ProfessionalSelector
                service={state.service}
                selected={state.professional}
                onSelect={p => update({ professional: p, fecha: undefined, hora: undefined })}
                onConfirm={() => update({ step: 3 })}
                onBack={() => update({ step: 1 })}
                accentColor={G.gold}
                tenantType={org.tenant_type ?? 'beauty'}
              />
            </div>
          </div>
        )}

        {/* ── STEP 3: Date / Time ── */}
        {state.step === 3 && state.professional && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontFamily: G.sans, fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: G.gold, marginBottom: '8px' }}>Paso 3</div>
              <h2 style={{ fontFamily: G.serif, fontSize: '28px', fontStyle: 'italic', fontWeight: 400, color: G.textPri, margin: 0 }}>Fecha y hora</h2>
            </div>
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', overflow: 'hidden' }}>
              <DateTimeSelector
                professional={state.professional}
                selectedDate={state.fecha}
                selectedTime={state.hora}
                serviceDurationMinutes={state.service?.duration_minutes ?? 30}
                onSelect={(fecha, hora) => update({ fecha, hora, step: 4 })}
                onBack={() => update({ step: state.professional && state.step === 3 ? 2 : 1 })}
                accentColor={G.gold}
              />
            </div>
          </div>
        )}

        {/* ── STEP 4: Confirm ── */}
        {state.step === 4 && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontFamily: G.sans, fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: G.gold, marginBottom: '8px' }}>Paso 4</div>
              <h2 style={{ fontFamily: G.serif, fontSize: '28px', fontStyle: 'italic', fontWeight: 400, color: G.textPri, margin: 0 }}>Tus datos</h2>
            </div>
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', overflow: 'hidden' }}>
              <BookingConfirm
                state={state}
                onChange={update}
                onBack={() => update({ step: 3 })}
                onComplete={() => setCompleted(true)}
                tenantType={org.tenant_type ?? 'beauty'}
                accentColor={G.gold}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
