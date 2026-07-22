import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, Calendar, UserCircle, Stethoscope, Sparkles, PawPrint, Scissors, Dumbbell, MapPin, MessageCircle, Instagram } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { alpha } from '../../lib/color'
import type { BookingState, Organization, TenantType } from '../../types'
import { ServiceSelector } from './ServiceSelector'
import { ProfessionalSelector } from './ProfessionalSelector'
import { DateTimeSelector } from './DateTimeSelector'
import { BookingConfirm } from './BookingConfirm'
import { PremiumBookingFlow } from './PremiumBookingFlow'

const STEPS_MEDICAL = [
  { label: 'Servicio',     icon: Stethoscope },
  { label: 'Profesional',  icon: UserCircle },
  { label: 'Fecha y hora', icon: Calendar },
  { label: 'Confirmar',    icon: CheckCircle },
]
const STEPS_BEAUTY = [
  { label: 'Servicio',     icon: Scissors },
  { label: 'Profesional',  icon: UserCircle },
  { label: 'Fecha y hora', icon: Calendar },
  { label: 'Confirmar',    icon: CheckCircle },
]
const STEPS_ESTETICA = [
  { label: 'Servicio',     icon: Sparkles },
  { label: 'Profesional',  icon: UserCircle },
  { label: 'Fecha y hora', icon: Calendar },
  { label: 'Confirmar',    icon: CheckCircle },
]
const STEPS_PET = [
  { label: 'Servicio',     icon: PawPrint },
  { label: 'Profesional',  icon: UserCircle },
  { label: 'Fecha y hora', icon: Calendar },
  { label: 'Confirmar',    icon: CheckCircle },
]
const STEPS_CANCHA = [
  { label: 'Deporte',      icon: Dumbbell },
  { label: 'Cancha',       icon: UserCircle },
  { label: 'Fecha y hora', icon: Calendar },
  { label: 'Confirmar',    icon: CheckCircle },
]

function getSteps(tenantType: TenantType) {
  if (tenantType === 'beauty')    return STEPS_BEAUTY
  if (tenantType === 'estetica')  return STEPS_ESTETICA
  if (tenantType === 'petshop' || tenantType === 'veterinary') return STEPS_PET
  if (tenantType === 'cancha')    return STEPS_CANCHA
  return STEPS_MEDICAL
}

function getSuccessMessage(tenantType: TenantType) {
  if (tenantType === 'beauty' || tenantType === 'estetica') return 'Tu reserva fue registrada. Te vamos a contactar para confirmar.'
  if (tenantType === 'petshop' || tenantType === 'veterinary') return 'La reserva para tu mascota fue registrada. Te contactaremos para confirmar.'
  if (tenantType === 'cancha') return 'Tu cancha fue reservada. Te esperamos!'
  return 'Su turno fue registrado con exito. Lo contactaremos para confirmar.'
}

function getSuccessTitle(tenantType: TenantType) {
  if (tenantType === 'cancha') return 'Cancha reservada!'
  if (tenantType === 'beauty' || tenantType === 'estetica') return 'Reserva confirmada!'
  if (tenantType === 'petshop' || tenantType === 'veterinary') return 'Turno registrado!'
  return 'Turno reservado!'
}

function getProfesionalLabel(tenantType: TenantType) {
  if (tenantType === 'cancha') return 'Cancha'
  if (tenantType === 'beauty' || tenantType === 'estetica') return 'Con'
  if (tenantType === 'petshop' || tenantType === 'veterinary') return 'Veterinario/a'
  return 'Profesional'
}

const INITIAL_STATE: BookingState = {
  step: 1, nombre: '', telefono: '', email: '', dni: '',
  obra_social: '', nro_socio: '', observaciones: '',
}

export function BookingFlow() {
  const { slug } = useParams<{ slug?: string }>()
  const [state, setState]             = useState<BookingState>(INITIAL_STATE)
  const [completed, setCompleted]     = useState(false)
  const [org, setOrg]                 = useState<Organization | null>(null)
  const [orgLoading, setOrgLoading]   = useState(true)
  const [orgNotFound, setOrgNotFound] = useState(false)

  useEffect(() => {
    setOrgLoading(true); setOrgNotFound(false)
    const base = supabase.from('organizations').select('*').eq('active', true)
    const run  = slug ? base.eq('slug', slug).single() : base.order('created_at').limit(1).single()
    run.then(({ data, error }) => {
      if (error || !data) setOrgNotFound(true)
      else setOrg(data as Organization)
      setOrgLoading(false)
    })
  }, [slug])

  const update = (partial: Partial<BookingState>) => setState(prev => ({ ...prev, ...partial }))
  const next   = () => update({ step: Math.min(state.step + 1, 4) as BookingState['step'] })
  const back   = () => update({ step: Math.max(state.step - 1, 1) as BookingState['step'] })

  if (orgLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (orgNotFound || !org) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">404</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Centro no encontrado</h2>
        <p className="text-gray-500 text-sm">No existe un centro con esa URL.</p>
      </div>
    </div>
  )

  const tenantType       = org.tenant_type ?? 'medical'
  const accentColor      = org.primary_color ?? '#0ea5e9'
  const logoUrl          = org.logo_url ?? null
  const whatsappNumber   = org.whatsapp_number ?? null
  const instagramHandle  = org.instagram_handle ?? null
  const orgAddress       = org.address ?? null
  const STEPS            = getSteps(tenantType)

  // Beauty, estética, petshop, veterinary y cancha usan la experiencia premium
  if (tenantType === 'beauty' || tenantType === 'estetica' || tenantType === 'medical'
   || tenantType === 'petshop' || tenantType === 'veterinary' || tenantType === 'cancha') {
    return <PremiumBookingFlow org={org} />
  }

  if (completed) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
             style={{ backgroundColor: alpha(accentColor, 0.12) }}>
          <CheckCircle className="w-8 h-8" style={{ color: accentColor }} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{getSuccessTitle(tenantType)}</h2>
        <p className="text-gray-500 text-sm mb-5">{getSuccessMessage(tenantType)}</p>
        <div className="rounded-xl p-4 text-left space-y-2 text-sm text-gray-600 mb-6"
             style={{ backgroundColor: alpha(accentColor, 0.07) }}>
          <div><span className="font-medium">Servicio:</span> {state.service?.name}</div>
          <div><span className="font-medium">{getProfesionalLabel(tenantType)}:</span> {state.professional?.full_name}</div>
          <div><span className="font-medium">Fecha:</span> {state.fecha ? format(parseISO(state.fecha), 'dd/MM/yy') : ''}</div>
          <div><span className="font-medium">Hora:</span> {state.hora}hs</div>
        </div>
        <button
          onClick={() => { setState(INITIAL_STATE); setCompleted(false) }}
          className="w-full text-white py-3 rounded-xl font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: accentColor }}
        >
          Reservar otro turno
        </button>
        <p className="mt-3 text-gray-400 text-sm">Ya podes cerrar esta ventana.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50" style={{ ['--accent' as string]: accentColor }}>

      {/* ── Brand header (scrollable) ── */}
      <div style={{ backgroundColor: accentColor }}>
        <div className="bg-gradient-to-b from-transparent to-black/20">
          <div className="max-w-2xl mx-auto px-4 pt-10 pb-8 flex flex-col items-center">

            {/* Logo */}
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={org.name}
                className="w-28 h-28 rounded-2xl object-contain bg-white shadow-xl p-0.5 mb-4"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-white/20 flex items-center justify-center mb-4 shadow-lg">
                <span className="text-white text-4xl font-bold">{org.name.charAt(0)}</span>
              </div>
            )}

            {/* Name */}
            <h1 className="text-2xl font-bold text-white text-center drop-shadow">{org.name}</h1>
            <p className="text-white/70 text-sm text-center mt-1">
              Reservar turno online
            </p>

            {/* Social links */}
            {(orgAddress || whatsappNumber || instagramHandle) && (
              <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
                {orgAddress && (
                  <a
                    href={'https://maps.google.com/?q=' + encodeURIComponent(orgAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full transition-all"
                  >
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate max-w-[160px]">{orgAddress}</span>
                  </a>
                )}
                {whatsappNumber && (
                  <a
                    href={'https://wa.me/' + whatsappNumber.replace(/\D/g, '')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-white font-medium bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition-all"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />WhatsApp
                  </a>
                )}
                {instagramHandle && (
                  <a
                    href={'https://instagram.com/' + instagramHandle.replace(/^@/, '')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-white font-medium bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition-all"
                  >
                    <Instagram className="w-3.5 h-3.5" />@{instagramHandle.replace(/^@/, '')}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Steps bar (sticky) ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {STEPS.map((step, i) => {
              const stepNum  = (i + 1) as BookingState['step']
              const isActive = state.step === stepNum
              const isDone   = state.step > stepNum
              const Icon     = step.icon
              return (
                <div key={i} className="flex flex-col items-center flex-1">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                    style={
                      isDone   ? { backgroundColor: accentColor, color: '#fff' } :
                      isActive ? { backgroundColor: alpha(accentColor, 0.15), color: accentColor, outline: `2px solid ${accentColor}`, outlineOffset: '2px' } :
                                 { backgroundColor: '#f3f4f6', color: '#9ca3af' }
                    }
                  >
                    {isDone ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span
                    className="text-xs mt-1 hidden sm:block"
                    style={isActive ? { color: accentColor, fontWeight: 500 } : { color: '#9ca3af' }}
                  >
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {state.step === 1 && (
          <ServiceSelector
            selected={state.service}
            onSelect={async s => {
              const { data } = await supabase
                .from('professional_services')
                .select('professionals(id, full_name, specialty, bio, avatar_url, active)')
                .eq('service_id', s.id)
              const profs = (data ?? []).map((r: any) => r.professionals).filter((p: any) => p?.active)
              if (profs.length === 1) {
                update({ service: s, professional: profs[0], fecha: undefined, hora: undefined, step: 3 })
              } else {
                update({ service: s, professional: undefined, fecha: undefined, hora: undefined }); next()
              }
            }}
            orgId={org.id}
            tenantType={tenantType}
            accentColor={accentColor}
          />
        )}
        {state.step === 2 && state.service && (
          <ProfessionalSelector
            service={state.service}
            selected={state.professional}
            onSelect={p => update({ professional: p, fecha: undefined, hora: undefined })}
            onConfirm={next}
            onBack={back}
            accentColor={accentColor}
            tenantType={tenantType}
          />
        )}
        {state.step === 3 && state.professional && (
          <DateTimeSelector
            professional={state.professional}
            selectedDate={state.fecha}
            selectedTime={state.hora}
            serviceDurationMinutes={state.service?.duration_minutes ?? 30}
            onSelect={(fecha, hora) => { update({ fecha, hora }); next() }}
            onBack={back}
            accentColor={accentColor}
          />
        )}
        {state.step === 4 && (
          <BookingConfirm
            state={state}
            onChange={update}
            onBack={back}
            onComplete={() => setCompleted(true)}
            tenantType={tenantType}
            accentColor={accentColor}
          />
        )}
      </div>
    </div>
  )
}
