import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, Clock, UserCircle, Stethoscope, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'

type PageState = 'loading' | 'found' | 'already_cancelled' | 'not_found' | 'confirming' | 'cancelled' | 'error'

function toArgTime(iso: string): string {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d = new Date(ms)
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`
}

function toArgDate(iso: string): string {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1).toString().padStart(2, '0')}-${d.getUTCDate().toString().padStart(2, '0')}`
}

interface AppointmentData {
  id: string
  patient_name: string
  starts_at: string
  status: string
  cancellation_token: string
  professionals: { full_name: string; specialty: string | null } | null
  services: { name: string } | null
}

export function CancelPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [state, setState] = useState<PageState>('loading')
  const [appointment, setAppointment] = useState<AppointmentData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) { setState('not_found'); return }

    supabase
      .from('appointments')
      .select('id, patient_name, starts_at, status, cancellation_token, professionals(full_name, specialty), services(name)')
      .eq('cancellation_token', token)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setState('not_found'); return }
        const appt = data as unknown as AppointmentData
        setAppointment(appt)
        if (appt.status === 'cancelado') {
          setState('already_cancelled')
        } else {
          setState('found')
        }
      })
  }, [token])

  const handleCancel = async () => {
    if (!appointment) return
    setLoading(true)
    setState('confirming')

    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelado' })
      .eq('cancellation_token', token)
      .eq('id', appointment.id)

    if (error) {
      setState('error')
    } else {
      setState('cancelled')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-sky-600 px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-lg">PRAXIS Agenda</span>
          </div>
        </div>

        <div className="p-6">

          {/* Loading */}
          {state === 'loading' && (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Not found */}
          {state === 'not_found' && (
            <div className="text-center py-6">
              <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Link inválido</h2>
              <p className="text-sm text-gray-500">No encontramos el turno asociado a este link.</p>
            </div>
          )}

          {/* Already cancelled */}
          {state === 'already_cancelled' && (
            <div className="text-center py-6">
              <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Turno ya cancelado</h2>
              <p className="text-sm text-gray-500">Este turno ya fue cancelado anteriormente.</p>
            </div>
          )}

          {/* Found — confirm cancellation */}
          {(state === 'found' || state === 'confirming') && appointment && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Cancelar turno</h2>
              <p className="text-sm text-gray-500 mb-5">¿Confirmás que querés cancelar el siguiente turno?</p>

              <div className="bg-sky-50 rounded-2xl p-4 mb-6 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <UserCircle className="w-4 h-4 text-sky-500 flex-shrink-0" />
                  <span className="font-medium text-gray-900">{appointment.patient_name}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Stethoscope className="w-4 h-4 text-sky-500 flex-shrink-0" />
                  <span className="text-gray-700">{appointment.services?.name}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <UserCircle className="w-4 h-4 text-sky-500 flex-shrink-0" />
                  <span className="text-gray-700">{appointment.professionals?.full_name}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-sky-500 flex-shrink-0" />
                  <span className="text-gray-700 capitalize">
                    {format(parseISO(toArgDate(appointment.starts_at)), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-sky-500 flex-shrink-0" />
                  <span className="text-gray-700">{toArgTime(appointment.starts_at)}hs</span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="w-full bg-red-500 hover:bg-red-600 text-white py-3.5 rounded-2xl font-semibold transition-colors disabled:opacity-50"
                >
                  {loading ? 'Cancelando...' : 'Sí, cancelar mi turno'}
                </button>
                <p className="text-xs text-gray-400 text-center">
                  Si fue un error, comunicate con el centro para reprogramar.
                </p>
              </div>
            </>
          )}

          {/* Cancelled successfully */}
          {state === 'cancelled' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Turno cancelado</h2>
              <p className="text-sm text-gray-500">
                Tu turno fue cancelado correctamente. Si querés reprogramar, podés hacerlo desde el inicio.
              </p>
              <a
                href="/"
                className="inline-block mt-5 bg-sky-600 text-white px-6 py-3 rounded-2xl font-semibold text-sm hover:bg-sky-700 transition-colors"
              >
                Reservar nuevo turno
              </a>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="text-center py-6">
              <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Error al cancelar</h2>
              <p className="text-sm text-gray-500">Hubo un problema. Por favor comunicate con el centro.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
