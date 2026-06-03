import { useState } from 'react'
import { ChevronLeft, Calendar, Clock, Building2, Stethoscope } from 'lucide-react'
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
    if (!state.servicio || !state.consultorio || !state.fecha || !state.hora) return
    if (!state.nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!state.telefono.trim()) { setError('El teléfono es obligatorio'); return }
    if (state.obra_social.trim() && !state.nro_socio.trim()) {
      setError('Ingresá el número de socio / carnet de la obra social')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Buscar o crear paciente por teléfono
      let pacienteId: string | undefined
      const { data: existing } = await supabase
        .from('pacientes')
        .select('id')
        .eq('telefono', state.telefono)
        .maybeSingle()

      if (existing) {
        pacienteId = (existing as { id: string }).id
        if (!pacienteId) throw new Error('ID de paciente inválido')
        await supabase.from('pacientes').update({
          nombre: state.nombre,
          email: state.email || null,
          obra_social: state.obra_social || null,
          nro_socio: state.nro_socio || null,
          observaciones: state.observaciones || null,
        }).eq('id', pacienteId)
      } else {
        const { data: nuevo, error: errPaciente } = await supabase
          .from('pacientes')
          .insert({
            nombre: state.nombre,
            telefono: state.telefono,
            email: state.email || null,
            obra_social: state.obra_social || null,
            nro_socio: state.nro_socio || null,
            observaciones: state.observaciones || null,
          })
          .select('id')
          .single()
        if (errPaciente) throw errPaciente
        pacienteId = (nuevo as { id: string } | null)?.id
        if (!pacienteId) throw new Error('No se pudo crear el paciente')
      }

      const estadoTurno = state.obra_social.trim() ? 'pendiente' : 'confirmado'

      const { data: rpcResult, error: rpcError } = await supabase.rpc('reservar_turno', {
        p_paciente_id: pacienteId,
        p_consultorio_id: state.consultorio.id,
        p_servicio_id: state.servicio.id,
        p_fecha: state.fecha,
        p_hora: state.hora,
        p_estado: estadoTurno,
      })

      if (rpcError) throw rpcError
      if ((rpcResult as { error?: string })?.error === 'slot_taken') {
        setError('Ese horario ya fue reservado por otra persona. Por favor elegí otro.')
        setLoading(false)
        return
      }

      const turnoId = (rpcResult as { id?: string })?.id
      if (turnoId && state.email) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirm-appointment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ turno_id: turnoId }),
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

      <div className="bg-sky-50 rounded-2xl p-4 mb-5 space-y-2.5">
        <div className="flex items-center gap-3 text-sm">
          <Stethoscope className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <span className="font-medium text-gray-900">{state.servicio?.icono} {state.servicio?.nombre}</span>
          <span className="text-gray-400 text-xs">{state.servicio?.duracion_minutos} min</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Building2 className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <span className="text-gray-900">{state.consultorio?.nombre}</span>
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
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
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
              ⏳ Tu turno quedará pendiente de confirmación hasta verificar la cobertura.
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
