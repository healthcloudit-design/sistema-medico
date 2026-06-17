import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, Calendar, UserCircle, Stethoscope, Sparkles } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import type { BookingState, Organization } from '../../types'
import { ServiceSelector } from './ServiceSelector'
import { ProfessionalSelector } from './ProfessionalSelector'
import { DateTimeSelector } from './DateTimeSelector'
import { BookingConfirm } from './BookingConfirm'

const STEPS_MEDICAL = [
  { label: 'Servicio',     icon: Stethoscope },
  { label: 'Profesional',  icon: UserCircle },
  { label: 'Fecha y hora', icon: Calendar },
  { label: 'Confirmar',    icon: CheckCircle },
]

const STEPS_BEAUTY = [
  { label: 'Servicio',     icon: Sparkles },
  { label: 'Profesional',  icon: UserCircle },
  { label: 'Fecha y hora', icon: Calendar },
  { label: 'Confirmar',    icon: CheckCircle },
]

const INITIAL_STATE: BookingState = {
  step: 1,
  nombre: '',
  telefono: '',
  email: '',
  obra_social: '',
  nro_socio: '',
  observaciones: '',
}

export function BookingFlow() {
  const { slug } = useParams<{ slug?: string }>()
  const [state, setState]       = useState<BookingState>(INITIAL_STATE)
  const [completed, setCompleted] = useState(false)
  const [org, setOrg]           = useState<Organization | null>(null)
  const [orgLoading, setOrgLoading] = useState(true)
  const [orgNotFound, setOrgNotFound] = useState(false)

  useEffect(() => {
    setOrgLoading(true)
    setOrgNotFound(false)

    const base = supabase.from('organizations').select('*').eq('active', true)
    const run = slug ? base.eq('slug', slug).single() : base.order('created_at').limit(1).single()

    run.then(({ data, error }) => {
      if (error || !data) {
        setOrgNotFound(true)
      } else {
        setOrg(data as Organization)
      }
      setOrgLoading(false)
    })
  }, [slug])

  const update = (partial: Partial<BookingState>) => setState(prev => ({ ...prev, ...partial }))
  const next   = () => update({ step: Math.min(state.step + 1, 4) as BookingState['step'] })
  const back   = () => update({ step: Math.max(state.step - 1, 1) as BookingState['step'] })

  if (orgLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (orgNotFound || !org) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">404</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Centro no encontrado</h2>
          <p className="text-gray-500 text-sm">
            No existe un centro con esa URL. Verifique la direccion e intente de nuevo.
          </p>
        </div>
      </div>
    )
  }

  const isBeauty = org.tenant_type === 'beauty'
  const STEPS = isBeauty ? STEPS_BEAUTY : STEPS_MEDICAL

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Turno reservado!</h2>
          <p className="text-gray-500 text-sm mb-5">
            {isBeauty
              ? 'Tu reserva fue registrada. Te vamos a contactar para confirmar.'
              : 'Su turno fue registrado con exito. Lo contactaremos para confirmar.'}
          </p>
          <div className="bg-sky-50 rounded-xl p-4 text-left space-y-2 text-sm text-gray-600 mb-6">
            <div><span className="font-medium">Servicio:</span> {state.service?.name}</div>
            <div><span className="font-medium">Profesional:</span> {state.professional?.full_name}</div>
            <div><span className="font-medium">Fecha:</span> {state.fecha ? format(parseISO(state.fecha), 'dd/MM/yy') : ''}</div>
            <div><span className="font-medium">Hora:</span> {state.hora}hs</div>
          </div>
          <button
            onClick={() => { setState(INITIAL_STATE); setCompleted(false) }}
            className="w-full bg-sky-600 text-white py-3 rounded-xl font-medium hover:bg-sky-700 transition-colors"
          >
            Reservar otro turno
          </button>
          <p className="mt-3 text-gray-400 text-sm text-center">Ya podes cerrar esta ventana.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-white">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900 text-center mb-1">{org.name}</h1>
          <p className="text-sm text-gray-400 text-center mb-3">Reservar turno online</p>
          <div className="flex items-center justify-between">
            {STEPS.map((step, i) => {
              const stepNum = (i + 1) as BookingState['step']
              const isActive = state.step === stepNum
              const isDone   = state.step > stepNum
              const Icon     = step.icon
              return (
                <div key={i} className="flex flex-col items-center flex-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all
                    ${isDone ? 'bg-sky-600 text-white' : isActive ? 'bg-sky-100 text-sky-700 ring-2 ring-sky-500' : 'bg-gray-100 text-gray-400'}`}>
                    {isDone ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-xs mt-1 hidden sm:block ${isActive ? 'text-sky-700 font-medium' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {state.step === 1 && (
          <ServiceSelector
            selected={state.service}
            onSelect={s => { update({ service: s, professional: undefined, fecha: undefined, hora: undefined }); next() }}
            orgId={org.id}
            tenantType={org.tenant_type}
          />
        )}
        {state.step === 2 && state.service && (
          <ProfessionalSelector
            service={state.service}
            selected={state.professional}
            onSelect={p => update({ professional: p, fecha: undefined, hora: undefined })}
            onConfirm={next}
            onBack={back}
          />
        )}
        {state.step === 3 && state.professional && (
          <DateTimeSelector
            professional={state.professional}
            selectedDate={state.fecha}
            selectedTime={state.hora}
            onSelect={(fecha, hora) => { update({ fecha, hora }); next() }}
            onBack={back}
          />
        )}
        {state.step === 4 && (
          <BookingConfirm
            state={state}
            onChange={update}
            onBack={back}
            onComplete={() => setCompleted(true)}
            tenantType={org.tenant_type}
          />
        )}
      </div>
    </div>
  )
}
