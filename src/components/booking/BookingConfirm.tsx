import { useState } from 'react'
import { ChevronLeft, Calendar, Clock, UserCircle, Stethoscope } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import type { BookingState } from '../../types'
import { Button } from '../ui/Button'

interface Props {
  state: BookingState
  onChange: (partial: Partial<BookingState>) => void
  onBack: () => void
  onComplete: () => void
}

export function BookingConfirm({ state, onChange, onBack, onComplete }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!state.service || !state.professional || !state.fecha || !state.hora) return
    if (!state.nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!state.telefono.trim()) { setError('El teléfono es obligatorio'); return }
    if (state.obra_social.trim() && !state.nro_socio.trim()) {
      setError('Ingresá el número de socio / carnet de la obra social')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Construir TIMESTAMPTZ en Argentina (UTC-3)
      const startsAt = `${state.fecha}T${state.hora}:00-03:00`

      const { data: rpcResult, error: rpcError } = await supabase.rpc('reservar_turno', {
        p_professional_id:      state.professional.id,
        p_service_id:           state.service.id,
        p_starts_at:            startsAt,
        p_patient_name:         state.nombre,
        p_patient_phone:        state.telefono,
        p_patient_email:        state.email        || undefined,
        p_patient_obra_social:  state.obra_social  || undefined,
        p_patient_nro_socio:    state.nro_socio    || undefined,
        p_patient_notes:        state.observaciones || undefined,
      })

      if (rpcError) throw rpcError

      const result = rpcResult as { id?: string; status?: string; error?: string }

      if (result?.error === 'slot_taken') {
        setError('Ese horario ya fue reservado. Por favor elegí otro.')
        setLoading(false)
        return
      }
      if (result?.error) {
        throw new Error(result.error)
      }

      // Disparar email de confirmación si hay email y turno creado
      if (result?.id && state.email) {
        supabase.functions.invoke('send-confirmation', {
          body: {
            appointment_id:    result.id,
            patient_name:      state.nombre,
            patient_email:     state.email,
            professional_name: state.professional.full_name,
            service_name:      state.service.name,
            starts_at:         startsAt,
          },
        }).catch(() => {})
      }

      onComplete()
    } catch (err) {
      console.error(err)
      setError('Hubo un error al reservar el turno. Por favor intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const dateLabel = state.fecha ? format(parseISO(state.fecha), "EEEE d 'de' MMMM", { locale: es }) : ''
  const tieneObraSocial = state.obra_social.trim().length > 0

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-sky-600 bg-sky-50 hover:bg-sky-100 px-3 py-2 rounded-xl transition-colors mb-4">
        <ChevronLeft className="w-4 h-4" /> Volver
      </button>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Confirme su turno</h2>

      {/* Resumen del turno */}
      <div className="bg-sky-50 rounded-2xl p-4 mb-5 space-y-2.5">
        <div className="flex items-center gap-3 text-sm">
          <Stethoscope className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <span className="font-medium text-gray-900">{state.service?.name}</span>
          <span className="text-gray-400 text-xs">{state.service?.duration_minutes} min</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <UserCircle className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <span className="text-gray-900">{state.professional?.full_name}</span>
          {state.professional?.specialty && (
            <span className="text-gray-400 text-xs">{state.professional.specialty}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Calendar className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <span className="capitalize text-gray-900">{dateLabel}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Clock className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <span className="text-gray-900">{state.hora}hs</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Nombre y apellido <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={state.nombre}
            onChange={e => onChange({ nombre: e.target.value })}
            placeholder="Ej: María González"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Teléfono / WhatsApp <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={state.telefono}
            onChange={e => onChange({ telefono: e.target.value })}
            placeholder="Ej: +54 11 1234-5678"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Email <span className="text-gray-400 text-xs font-normal">(opcional)</span>
          </label>
          <input
            type="email"
            value={state.email}
            onChange={e => onChange({ email: e.target.value })}
            placeholder="Ej: maria@email.com"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Obra social <span className="text-gray-400 text-xs font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={state.obra_social}
            onChange={e => onChange({ obra_social: e.target.value, nro_socio: e.target.value ? state.nro_socio : '' })}
            placeholder="Ej: OSDE, Swiss Medical, PAMI..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
          />
        </div>

        {tieneObraSocial && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nº de socio / carnet <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={state.nro_socio}
              onChange={e => onChange({ nro_socio: e.target.value })}
              placeholder="Ej: 0012345678"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            />
            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
              ⏳ Tu turno quedará pendiente hasta verificar la cobertura.
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Observaciones <span className="text-gray-400 text-xs font-normal">(opcional)</span>
          </label>
          <textarea
            value={state.observaciones}
            onChange={e => onChange({ observaciones: e.target.value })}
            placeholder="¿Usa lentes? ¿Tiene alguna condición preexistente?"
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm resize-none"
          />
        </div>

        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

        <Button type="submit" loading={loading} size="lg" className="w-full !bg-sky-600 hover:!bg-sky-700">
          {tieneObraSocial ? 'Solicitar turno' : 'Confirmar turno'}
        </Button>
      </form>
    </div>
  )
}
