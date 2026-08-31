import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ObrasSocialesCarousel } from '../components/booking/ObrasSocialesCarousel'

interface Appointment {
  id: string
  patient_name: string
  starts_at: string
  status: string
  professional?: { full_name: string; consultorio?: string | null; avatar_url?: string | null }
}

interface Org {
  id: string
  name: string
  logo_url?: string | null
}

function DoctorIcon({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      className="text-sky-300"
    >
      <circle cx="12" cy="7.5" r="3.6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 21v-1.6a5 5 0 0 1 5-5h.6M19 21v-1.6a5 5 0 0 0-5-5h-.6"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M9.6 10.2v2.6a2.4 2.4 0 0 0 4.8 0v-2.6"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      />
      <circle cx="16.2" cy="15.4" r="0.9" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function ProfessionalAvatar({ url, size = 32 }: { url?: string | null; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 bg-sky-950 border border-sky-400/30 overflow-hidden"
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <DoctorIcon size={size * 0.62} />
      )}
    </div>
  )
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
  const [soundReady, setSoundReady] = useState(false)

  // Solo Bicentenario, por ahora, muestra carrusel de obras sociales + sonido de campana.
  const isBicentenario = slug === 'bicentenario'

  // Refs para evitar "stale closure" dentro del callback de realtime:
  // - audioCtxRef: el AudioContext, creado recién cuando el usuario toca para activar el sonido.
  // - lastCurrentIdRef: id del último paciente "en atención" anunciado, para disparar el
  //   destello y la campana solo cuando REALMENTE cambia (no en cada refresco de realtime).
  const audioCtxRef      = useRef<AudioContext | null>(null)
  const lastCurrentIdRef = useRef<string | null>(null)

  // Campana sintetizada con Web Audio (sin archivo de audio). Dos tonos tipo "ding-dong".
  const playChime = () => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    try {
      const now = ctx.currentTime
      const notes = [
        { f: 987.77, t: 0 },     // Si5
        { f: 659.25, t: 0.22 },  // Mi5
      ]
      notes.forEach(({ f, t }) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = f
        osc.connect(gain)
        gain.connect(ctx.destination)
        const start = now + t
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(0.45, start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.1)
        osc.start(start)
        osc.stop(start + 1.15)
      })
    } catch {
      /* si el navegador bloquea el audio, no rompemos la pantalla */
    }
  }

  // Desbloqueo del audio: los navegadores no dejan sonar nada hasta que hubo una interacción
  // del usuario. Este toque único crea el AudioContext y suena una campana de prueba.
  const enableSound = () => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      audioCtxRef.current = ctx
      if (ctx.state === 'suspended') ctx.resume()
      setSoundReady(true)
      playChime()
    } catch {
      setSoundReady(true)
    }
  }

  // Cargar org
  useEffect(() => {
    if (!slug) return
    supabase
      .from('organizations')
      .select('id, name, logo_url')
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
      .select('id, patient_name, starts_at, status, professionals(full_name, consultorio, avatar_url)')
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

    // Destello + campana SOLO cuando cambia el paciente en atención (no en cada refresco).
    const newId = inAttention?.id ?? null
    if (inAttention && newId !== lastCurrentIdRef.current) {
      setFlash(true)
      setTimeout(() => setFlash(false), 3000)
      playChime()
    }
    lastCurrentIdRef.current = newId

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

      {/* Overlay de un toque para activar el sonido (solo Bicentenario, una vez por sesión) */}
      {isBicentenario && !soundReady && (
        <div
          onClick={enableSound}
          className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer"
          style={{ backgroundColor: 'rgba(3,7,18,0.92)' }}
        >
          <div className="text-center px-6">
            <div className="text-7xl mb-6">🔔</div>
            <p className="text-white text-3xl font-semibold mb-2">Tocá para activar el sonido</p>
            <p className="text-gray-400 text-lg">El llamador sonará cada vez que se llame a un paciente</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-10 py-5 border-b border-white/10">
        <div className="flex items-center gap-4 min-w-0">
          {org.logo_url && (
            <img
              src={org.logo_url}
              alt=""
              className="h-14 w-14 rounded-xl object-cover bg-white/5 border border-white/10 flex-shrink-0"
            />
          )}
          <h1 className="text-3xl font-bold text-white tracking-wide truncate">{org.name}</h1>
        </div>
        <div className="text-3xl font-mono font-light text-sky-400 flex-shrink-0">
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
                <div className="mt-8 flex flex-col items-center">
                  <div className="flex items-center gap-4">
                    <ProfessionalAvatar url={current.professional.avatar_url} size={56} />
                    <p className="text-sky-300/80 text-3xl font-medium">{current.professional.full_name}</p>
                  </div>
                  {current.professional.consultorio && (
                    <span className="mt-3 text-sky-400 font-bold uppercase tracking-widest text-5xl">
                      Consultorio {current.professional.consultorio}
                    </span>
                  )}
                </div>
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
                      <div className="flex items-center gap-2 mt-1 min-w-0">
                        <ProfessionalAvatar url={appt.professional.avatar_url} size={20} />
                        <p className="text-gray-500 text-sm truncate">
                          {appt.professional.full_name}
                          {appt.professional.consultorio && ` · Consultorio ${appt.professional.consultorio}`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Carrusel de obras sociales (solo Bicentenario) */}
      {isBicentenario && (
        <div className="px-8 pt-3 pb-4 border-t border-white/10">
          <ObrasSocialesCarousel />
        </div>
      )}

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
