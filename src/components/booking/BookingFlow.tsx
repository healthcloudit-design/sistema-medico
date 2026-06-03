import { useState } from 'react'
import { CheckCircle, Calendar, Building2, Stethoscope } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { BookingState } from '../../types'
import { ServiceSelector } from './ServiceSelector'
import { ConsultorioSelector } from './ConsultorioSelector'
import { DateTimeSelector } from './DateTimeSelector'
import { BookingConfirm } from './BookingConfirm'

const STEPS = [
  { label: 'Servicio',    icon: Stethoscope },
  { label: 'Consultorio', icon: Building2 },
  { label: 'Fecha y hora', icon: Calendar },
  { label: 'Confirmar',   icon: CheckCircle },
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
  const [state, setState] = useState<BookingState>(INITIAL_STATE)
  const [completed, setCompleted] = useState(false)

  const update = (partial: Partial<BookingState>) => setState(prev => ({ ...prev, ...partial }))
  const next = () => update({ step: Math.min(state.step + 1, 4) as BookingState['step'] })
  const back = () => update({ step: Math.max(state.step - 1, 1) as BookingState['step'] })

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Turno reservado!</h2>
          <p className="text-gray-500 text-sm mb-5">
            Su turno fue registrado con éxito. Lo contactaremos para confirmar.
          </p>
          <div className="bg-sky-50 rounded-xl p-4 text-left space-y-2 text-sm text-gray-600 mb-6">
            <div><span className="font-medium">Servicio:</span> {state.servicio?.icono} {state.servicio?.nombre}</div>
            <div><span className="font-medium">Consultorio:</span> {state.consultorio?.nombre}</div>
            <div><span className="font-medium">Fecha:</span> {state.fecha ? format(parseISO(state.fecha), 'dd/MM/yy') : ''}</div>
            <div><span className="font-medium">Hora:</span> {state.hora}hs</div>
          </div>
          <button
            onClick={() => { setState(INITIAL_STATE); setCompleted(false) }}
            className="w-full bg-sky-600 text-white py-3 rounded-xl font-medium hover:bg-sky-700 transition-colors"
          >
            Reservar otro turno
          </button>
          <button
            onClick={() => window.close()}
            className="w-full mt-3 text-gray-400 text-sm hover:text-gray-600 transition-colors"
          >
            Listo, cerrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900 text-center mb-4">Reservar turno</h1>
          <div className="flex items-center justify-between">
            {STEPS.map((step, i) => {
              const stepNum = (i + 1) as BookingState['step']
              const isActive = state.step === stepNum
              const isDone = state.step > stepNum
              const Icon = step.icon
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

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {state.step === 1 && (
          <ServiceSelector
            selected={state.servicio}
            onSelect={s => { update({ servicio: s, consultorio: undefined, fecha: undefined, hora: undefined }); next() }}
          />
        )}
        {state.step === 2 && state.servicio && (
          <ConsultorioSelector
            servicio={state.servicio}
            selected={state.consultorio}
            onSelect={c => update({ consultorio: c, fecha: undefined, hora: undefined })}
            onConfirm={next}
            onBack={back}
          />
        )}
        {state.step === 3 && state.consultorio && (
          <DateTimeSelector
            consultorio={state.consultorio}
            selectedDate={state.fecha}
            selectedTime={state.hora}
            onSelect={(fecha, hora) => { update({ fecha, hora }); next() }}
            onBack={back}
          />
        )}
        {state.step === 4 && (
          <BookingConfirm state={state} onChange={update} onBack={back} onComplete={() => setCompleted(true)} />
        )}
      </div>
    </div>
  )
}
