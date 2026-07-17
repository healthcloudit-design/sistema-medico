import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Appointment {
  id: string
  patient_name: string
  starts_at: string
  status: string
  professional?: { full_name: string; consultorio?: string | null }
}

interface Org {
  id: string
  name: string
}

function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span>
      {time.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}

export function WaitingRoomScreen() {
  const { slug } = useParams<{ slug: string }>()
  const [org, setOrg]             = useState<Org | null>(null)
  const [current, setCurrent]     = useState<Appointment | null>(null)
  const [queue, setQueue]         = useState<Appointment[]>([])
  const [flash, setFlash]         = useState(false)
  const [notFound, setNotFound]   = useState(false)

  // Cargar org
  useEffect(() => {
    if (!slug) return
    supabase
      .from('organizations')
      .select('id, name')
      .eq('slug', slug)
      .eq('active', true)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); return }
        setOrg(data as Org)
      })
  }, [slug])

  // Cargar turnos del día
  const loadAppointments = async (orgId: string) => {
    const today = new Date()
    const from  = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    const to    = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString()

    const { data } = await supabase
      .from('appointments')
      .select('id, patient_name, starts_at, status, professionals(full_name, consultorio)')
      .eq('organization_id', orgId)
      .gte('starts_at', from)
      .lte('starts_at', to)
      .in('status', ['confirmado', 'pendiente', 'en_atencion'])
      .order('starts_at')

    const appts = (data ?? []).map((a: any) => ({
      ...a,
      professional: a.professionals,
    })) as Appointment[]

    const inAttention = appts.find(a => a.status === 'en_atencion') ?? null
    const waiting     = appts.filter(a => a.status !== 'en_atencion')

    // Flash cuando cambia el que está en atención
    if (inAttention?.id !== current?.id && inAttention) {
      setFlash(true)
      setTimeout(() => setFlash(false), 3000)
    }

    setCurrent(inAttention)
    setQueue(waiting)
  }

  useEffect(() => {
    if (!org) return
    loadAppointments(org.id)

    // Realtime
    const channel = supabase
      .channel(`waitingroom-${org.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `organization_id=eq.${org.id}` },
        () => loadAppointments(org.id)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [org])

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <p className="text-2xl opacity-50">Centro no encontrado</p>
      </div>
    )
  }

  if (!org) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col select-none">

      {/* Header */}
      <div className="flex items-center justify-between px-10 py-5 border-b border-white/10">
        <h1 className="text-2xl font-bold text-white tracking-wide">{org.name}</h1>
        <div className="text-3xl font-mono font-light text-sky-400">
          <Clock />
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-0">

        {/* Panel izquierdo: en atención */}
        <div className={`lg:w-1/2 flex flex-col items-center justify-center p-10 transition-all duration-700
          ${flash ? 'bg-sky-600' : current ? 'bg-sky-900/60' : 'bg-gray-800/40'}`}>
          {current ? (
            <>
              <p className="text-sky-300 text-lg font-medium uppercase tracking-widest mb-4">
                En atención
              </p>
              <p className={`text-center font-bold leading-tight transition-all duration-500
                ${current.patient_name.length > 20 ? 'text-5xl' : 'text-6xl'}`}>
                {current.patient_name}
              </p>
              {current.professional && (
                <p className="mt-6 text-sky-300/70 text-xl text-center">
                  {current.professional.full_name}
                  {current.professional.consultorio && (
                    <span className="block mt-1 text-sky-400 font-bold uppercase tracking-widest text-2xl">
                      Consultorio {current.professional.consultorio}
                    </span>
                  )}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sky-300/40 text-2xl font-medium uppercase tracking-widest mb-3">
                En atención
              </p>
              <p className="text-gray-500 text-3xl font-light">—</p>
            </>
          )}
        </div>

        {/* Divisor vertical */}
        <div className="hidden lg:block w-px bg-white/10" />

        {/* Panel derecho: cola de espera */}
        <div className="lg:w-1/2 flex flex-col p-8 overflow-hidden">
          <p className="text-gray-400 text-sm font-medium uppercase tracking-widest mb-5">
            A continuación
          </p>
          {queue.length === 0 ? (
            <p className="text-gray-600 text-xl font-light mt-4">Sin turnos pendientes</p>
          ) : (
            <div className="space-y-3 overflow-y-auto">
              {queue.slice(0, 8).map((appt, i) => (
                <div
                  key={appt.id}
                  className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all
                    ${i === 0 ? 'bg-white/10 border border-white/20' : 'bg-white/5'}`}
                >
                  <span className={`text-2xl font-bold w-8 text-center
                    ${i === 0 ? 'text-sky-400' : 'text-gray-600'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${i === 0 ? 'text-white text-xl' : 'text-gray-300 text-lg'}`}>
                      {appt.patient_name}
                    </p>
                    {appt.professional && (
                      <p className="text-gray-500 text-sm truncate">
                        {appt.professional.full_name}
                        {appt.professional.consultorio && ` · Consultorio ${appt.professional.consultorio}`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Footer */}
      <div className="px-10 py-3 border-t border-white/10 flex items-center justify-between">
        <p className="text-gray-600 text-sm">PRAXIS Agenda</p>
        <p className="text-gray-600 text-sm">
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

    </div>
  )
}
