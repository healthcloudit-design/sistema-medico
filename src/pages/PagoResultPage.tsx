import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, Clock, UserCircle, Stethoscope, CheckCircle, Clock3, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Outcome = 'exitoso' | 'fallido' | 'pendiente'

interface AppointmentData {
  id: string
  patient_name: string
  starts_at: string
  professionals: { full_name: string } | null
  services: { name: string } | null
}

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

const COPY: Record<Outcome, { icon: JSX.Element; iconBg: string; title: string; body: string }> = {
  exitoso: {
    icon: <CheckCircle className="w-8 h-8 text-green-600" />,
    iconBg: 'bg-green-100',
    title: '¡Seña confirmada!',
    body: 'Recibimos tu pago y tu turno quedó reservado. Te va a llegar una confirmación por email o WhatsApp.',
  },
  pendiente: {
    icon: <Clock3 className="w-8 h-8 text-amber-600" />,
    iconBg: 'bg-amber-100',
    title: 'Pago en proceso',
    body: 'Tu pago está siendo procesado. En cuanto se confirme vas a recibir un aviso y tu turno quedará reservado.',
  },
  fallido: {
    icon: <XCircle className="w-8 h-8 text-red-600" />,
    iconBg: 'bg-red-100',
    title: 'No se pudo procesar el pago',
    body: 'Tu turno todavía no quedó confirmado. Podés volver a intentar el pago o comunicarte con nosotros.',
  },
}

export function PagoResultPage({ outcome }: { outcome: Outcome }) {
  const [searchParams] = useSearchParams()
  const appointmentId = searchParams.get('appointment_id')
  const [appointment, setAppointment] = useState<AppointmentData | null>(null)

  useEffect(() => {
    if (!appointmentId) return
    supabase
      .from('appointments')
      .select('id, patient_name, starts_at, professionals(full_name), services(name)')
      .eq('id', appointmentId)
      .single()
      .then(({ data }) => setAppointment((data as unknown as AppointmentData) ?? null))
  }, [appointmentId])

  const copy = COPY[outcome]

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md overflow-hidden">
        <div className="bg-sky-600 px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-lg">PRAXIS Agenda</span>
          </div>
        </div>

        <div className="p-6 text-center py-8">
          <div className={`w-16 h-16 ${copy.iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
            {copy.icon}
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{copy.title}</h2>
          <p className="text-sm text-gray-500 mb-6">{copy.body}</p>

          {appointment && (
            <div className="bg-sky-50 rounded-2xl p-4 text-left space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <UserCircle className="w-4 h-4 text-sky-500 flex-shrink-0" />
                <span className="font-medium text-gray-900">{appointment.patient_name}</span>
              </div>
              {appointment.services?.name && (
                <div className="flex items-center gap-3 text-sm">
                  <Stethoscope className="w-4 h-4 text-sky-500 flex-shrink-0" />
                  <span className="text-gray-700">{appointment.services.name}</span>
                </div>
              )}
              {appointment.professionals?.full_name && (
                <div className="flex items-center gap-3 text-sm">
                  <UserCircle className="w-4 h-4 text-sky-500 flex-shrink-0" />
                  <span className="text-gray-700">{appointment.professionals.full_name}</span>
                </div>
              )}
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
          )}

          <a
            href="/"
            className="inline-block mt-6 bg-sky-600 text-white px-6 py-3 rounded-2xl font-semibold text-sm hover:bg-sky-700 transition-colors"
          >
            Volver al inicio
          </a>
        </div>
      </div>
    </div>
  )
}
