import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, Search, LogOut, Clock, CheckCircle, XCircle, UserX } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useProfile'
import type { User } from '@supabase/supabase-js'
import type { Appointment, AppointmentStatus } from '../types'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  confirmado: { label: 'Confirmado', className: 'bg-green-100 text-green-800' },
  pendiente:  { label: 'Pendiente',  className: 'bg-yellow-100 text-yellow-800' },
  cancelado:  { label: 'Cancelado',  className: 'bg-red-100 text-red-800' },
  no_asistio: { label: 'No asistió', className: 'bg-gray-100 text-gray-600' },
  completado: { label: 'Completado', className: 'bg-blue-100 text-blue-800' },
}

function toArgTime(iso: string) {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d = new Date(ms)
  return `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')}`
}

function toArgDate(iso: string) {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${(d.getUTCMonth()+1).toString().padStart(2,'0')}-${d.getUTCDate().toString().padStart(2,'0')}`
}

export function RecepcionPage() {
  const [user, setUser]             = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0,10))
  const [selected, setSelected]     = useState<Appointment | null>(null)
  const [updating, setUpdating]     = useState(false)
  const navigate = useNavigate()

  const { profile, loading: profileLoading } = useProfile(user)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user && !authLoading) { navigate('/', { replace: true }); return }
    if (!profile) return
    if (['admin','superadmin'].includes(profile.role)) navigate('/admin', { replace: true })
    if (profile.role === 'medico') navigate('/medico', { replace: true })
  }, [user, authLoading, profile])

  const load = async () => {
    setLoading(true)
    const from = `${dateFilter}T00:00:00-03:00`
    const to   = `${dateFilter}T23:59:59-03:00`
    const { data } = await supabase
      .from('appointments')
      .select('*, professionals(full_name, specialty), services(name, color), patients(full_name, phone, email, obra_social, nro_socio)')
      .gte('starts_at', from)
      .lte('starts_at', to)
      .order('starts_at')
    setAppointments((data ?? []).map((r: Record<string, unknown>) => ({
      ...r, professional: r.professionals, service: r.services, patient: r.patients,
    })) as Appointment[])
    setLoading(false)
  }

  useEffect(() => { if (profile) load() }, [dateFilter, profile])

  const filtered = appointments.filter(a => {
    if (!search) return true
    return a.patient_name.toLowerCase().includes(search.toLowerCase()) ||
           (a.patient_phone ?? '').includes(search)
  })

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    setUpdating(true)
    await supabase.from('appointments').update({ status }).eq('id', id)
    setSelected(prev => prev ? { ...prev, status } : null)
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    setUpdating(false)
  }

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const todayStr = new Date().toISOString().slice(0,10)
  const isFilterToday = dateFilter === todayStr

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-gray-900 text-sm">TurnOS</span>
            <span className="text-xs text-gray-400 ml-2">Recepción</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 hidden sm:block">{profile?.full_name}</span>
          <button onClick={() => supabase.auth.signOut()} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">

        {/* Stats del día */}
        {isFilterToday && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total',      count: filtered.length,                          color: 'sky' },
              { label: 'Confirmados', count: filtered.filter(a => a.status==='confirmado').length, color: 'green' },
              { label: 'Pendientes', count: filtered.filter(a => a.status==='pendiente').length,  color: 'amber' },
              { label: 'Cancelados', count: filtered.filter(a => a.status==='cancelado').length,  color: 'red' },
            ].map(s => (
              <div key={s.label} className={`bg-white rounded-2xl border border-gray-100 p-3 text-center`}>
                <div className="text-xl font-bold text-gray-900">{s.count}</div>
                <div className="text-xs text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o teléfono..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-5 space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              {search ? 'Sin resultados para esa búsqueda' : 'Sin turnos para este día'}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(a => {
                const prof    = a.professional as { full_name: string } | undefined
                const service = a.service      as { name: string }      | undefined
                const cfg = STATUS_CONFIG[a.status]
                return (
                  <div
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50/50 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 w-14 flex-shrink-0">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs font-mono text-gray-600">{toArgTime(a.starts_at)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">{a.patient_name}</div>
                      <div className="text-xs text-gray-400 truncate">{service?.name} · {prof?.full_name}</div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${cfg?.className}`}>
                      {cfg?.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal detalle */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Detalle del turno</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-4">
              {(() => {
                const cfg     = STATUS_CONFIG[selected.status]
                const patient = selected.patient as { full_name: string; phone?: string; email?: string; obra_social?: string; nro_socio?: string } | undefined
                const service = selected.service as { name: string } | undefined
                const prof    = selected.professional as { full_name: string; specialty?: string } | undefined
                const isPendiente = selected.status === 'pendiente'
                return (
                  <>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg?.className}`}>{cfg?.label}</span>
                      <span className="text-sm text-gray-500">
                        {format(parseISO(toArgDate(selected.starts_at)), "dd/MM/yy")} · {toArgTime(selected.starts_at)}hs
                      </span>
                    </div>

                    {isPendiente && patient?.obra_social && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Verificar cobertura</p>
                        <p className="text-sm font-medium text-amber-900">{patient.obra_social}</p>
                        {patient.nro_socio && <p className="text-sm text-amber-700">N° socio: <span className="font-mono font-semibold">{patient.nro_socio}</span></p>}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <InfoItem label="Paciente"    value={selected.patient_name} />
                      <InfoItem label="Teléfono"    value={selected.patient_phone ?? '—'} />
                      <InfoItem label="Servicio"    value={service?.name ?? '—'} />
                      <InfoItem label="Profesional" value={prof?.full_name ?? '—'} />
                      {selected.patient_email && <InfoItem label="Email" value={selected.patient_email} />}
                      {patient?.obra_social && !isPendiente && (
                        <InfoItem label="Obra social" value={`${patient.obra_social}${patient.nro_socio ? ` – ${patient.nro_socio}` : ''}`} />
                      )}
                    </div>

                    <div className="flex gap-2 flex-wrap pt-1">
                      {selected.status === 'pendiente' && (
                        <ActionBtn icon={CheckCircle} label="Confirmar" color="sky"
                          onClick={() => updateStatus(selected.id, 'confirmado')} loading={updating} />
                      )}
                      {selected.status === 'confirmado' && (
                        <ActionBtn icon={CheckCircle} label="Completado" color="sky"
                          onClick={() => updateStatus(selected.id, 'completado')} loading={updating} />
                      )}
                      {!['no_asistio','completado','cancelado'].includes(selected.status) && (
                        <ActionBtn icon={UserX} label="No asistió" color="gray"
                          onClick={() => updateStatus(selected.id, 'no_asistio')} loading={updating} />
                      )}
                      {!['cancelado','completado'].includes(selected.status) && (
                        <ActionBtn icon={XCircle} label="Cancelar" color="red"
                          onClick={() => updateStatus(selected.id, 'cancelado')} loading={updating} />
                      )}
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="text-sm font-medium text-gray-900">{value}</div>
    </div>
  )
}

function ActionBtn({ icon: Icon, label, color, onClick, loading }: {
  icon: React.ElementType; label: string; color: string; onClick: () => void; loading: boolean
}) {
  const colors: Record<string, string> = {
    sky:  'bg-sky-600 hover:bg-sky-700 text-white',
    gray: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
    red:  'bg-red-100 hover:bg-red-200 text-red-700',
  }
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${colors[color]}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}
