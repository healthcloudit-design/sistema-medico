import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, isToday, isTomorrow, startOfDay, endOfDay, addDays, startOfWeek, addWeeks } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, Clock, UserCircle, LogOut, Stethoscope, FileText, Users, LayoutList, CalendarX } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useProfile'
import { useOrgFeatures } from '../hooks/useOrgFeatures'
import { ClinicalRecordModal } from '../components/medico/ClinicalRecordModal'
import { PatientSearch } from '../components/shared/PatientSearch'
import { GreetingBanner } from '../components/shared/GreetingBanner'
import { WeekCalendar } from '../components/shared/WeekCalendar'
import { MiAgendaBloqueos } from '../components/medico/MiAgendaBloqueos'
import type { User } from '@supabase/supabase-js'
import type { Appointment } from '../types'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  confirmado:  { label: 'Confirmado',  className: 'bg-green-100 text-green-800' },
  pendiente:   { label: 'Pendiente',   className: 'bg-yellow-100 text-yellow-800' },
  cancelado:   { label: 'Cancelado',   className: 'bg-red-100 text-red-800' },
  no_asistio:  { label: 'No asistio',  className: 'bg-gray-100 text-gray-600' },
  completado:  { label: 'Completado',  className: 'bg-blue-100 text-blue-800' },
  en_atencion: { label: 'En atencion', className: 'bg-sky-100 text-sky-800' },
}

function toArgTime(iso: string) {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d = new Date(ms)
  return `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')}`
}

export function MedicoDashboard() {
  const [user, setUser]               = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loadingAppts, setLoadingAppts] = useState(true)
  const [selected, setSelected]       = useState<Appointment | null>(null)
  const [showHC, setShowHC]           = useState(false)
  const [tab, setTab]                 = useState<'agenda' | 'pacientes' | 'bloqueos'>('agenda')
  const [calendarView, setCalendarView] = useState(false)
  const [currentWeek, setCurrentWeek]   = useState(new Date())
  const navigate = useNavigate()

  const { profile, loading: profileLoading } = useProfile(user)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [tenantType, setTenantType] = useState<string>('medical')

  useEffect(() => {
    if (!profile?.professional_id) return
supabase
      .from('professionals')
      .select('organization_id, organizations(tenant_type)')
      .eq('id', profile.professional_id)
      .single()
      .then(({ data }) => {
        setOrgId(data?.organization_id ?? null)
        const tt = (data?.organizations as { tenant_type?: string } | null)?.tenant_type ?? 'medical'
        setTenantType(tt)
      })
  }, [profile?.professional_id])

  const { featureHc } = useOrgFeatures(orgId)
  const clientesLabel = tenantType === 'cancha' ? 'Reservas' : ['medical', 'estetica'].includes(tenantType) ? 'Pacientes' : 'Clientes'

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
    if (!user && !authLoading) { navigate("/", { replace: true }); return }
    if (!profile) return
    if (profile.role === 'admin' || profile.role === 'superadmin') navigate('/admin', { replace: true })
    if (profile.role === 'recepcion') navigate('/recepcion', { replace: true })
  }, [user, authLoading, profile])

  useEffect(() => {
    if (!profile?.professional_id) return
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const from = startOfDay(weekStart).toISOString()
    const to   = endOfDay(addDays(weekStart, 27)).toISOString() // 4 semanas
    supabase
      .from('appointments')
      .select('*, services(name, color, duration_minutes), patients(id, full_name, phone, email, obra_social)')
      .eq('professional_id', profile.professional_id)
      .gte('starts_at', from)
      .lte('starts_at', to)
      .not('status', 'eq', 'cancelado')
      .order('starts_at')
      .then(({ data }) => {
        setAppointments((data ?? []).map((r: Record<string, unknown>) => ({
          ...r, service: r.services, patient: r.patients,
        })) as Appointment[])
        setLoadingAppts(false)
      })
  }, [profile?.professional_id])

  // Realtime: escucha cambios en turnos de este profesional
  useEffect(() => {
    if (!profile?.professional_id) return
    const channel = supabase
      .channel(`medico-appts-${profile.professional_id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'appointments', filter: `professional_id=eq.${profile.professional_id}` },
        (payload) => {
          const updated = payload.new as any
          if (updated.status === 'cancelado') {
            setAppointments(prev => prev.filter(a => a.id !== updated.id))
            setSelected(prev => prev?.id === updated.id ? null : prev)
          } else {
            setAppointments(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a))
            setSelected(prev => prev?.id === updated.id ? { ...prev, ...updated } as any : prev)
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.professional_id])

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  const today    = appointments.filter(a => isToday(parseISO(a.starts_at)))
  const tomorrow = appointments.filter(a => isTomorrow(parseISO(a.starts_at)))
  const upcoming = appointments.filter(a => !isToday(parseISO(a.starts_at)) && !isTomorrow(parseISO(a.starts_at)))

  const changeStatus = async (id: string, newStatus: string) => {
    await supabase.from('appointments').update({ status: newStatus }).eq('id', id)
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus as any } : a))
    setSelected(prev => prev?.id === id ? { ...prev, status: newStatus as any } : prev)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-sky-600 rounded-lg flex items-center justify-center">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-gray-900 text-sm">TurnOS</span>
            <span className="text-xs text-gray-400 ml-2">Profesional</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 hidden sm:block">{profile?.full_name}</span>
          <button
            onClick={() => supabase.auth.signOut()}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setTab('agenda')}
            className={['flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors', tab === 'agenda' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'].join(' ')}
          >
            <Calendar className="w-4 h-4" /> Mi agenda
          </button>
          <button
            onClick={() => setTab('pacientes')}
            className={['flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors', tab === 'pacientes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'].join(' ')}
          >
            <Users className="w-4 h-4" /> {clientesLabel}
          </button>
          <button
            onClick={() => setTab('bloqueos')}
            className={['flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors', tab === 'bloqueos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'].join(' ')}
          >
            <CalendarX className="w-4 h-4" /> Bloqueos
          </button>
          {tab === 'agenda' && (
            <button
              onClick={() => setCalendarView(v => !v)}
              className={['flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors', calendarView ? 'bg-white text-sky-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'].join(' ')}
              title={calendarView ? 'Vista lista' : 'Vista calendario'}
            >
              {calendarView ? <LayoutList className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
            </button>
          )}
        </div>

        {tab === 'bloqueos' && profile?.professional_id && (
          <MiAgendaBloqueos professionalId={profile.professional_id} />
        )}

        {tab === 'pacientes' && (
          <PatientSearch orgId={orgId} professionalId={profile?.professional_id ?? null} />
        )}

        {tab === 'agenda' && <>
          <GreetingBanner
            userName={profile?.full_name}
            subtitle={`${today.length} turno${today.length !== 1 ? 's' : ''} para hoy`}
          />

          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Hoy"    value={today.length}       color="sky" />
            <StatCard label="Manana" value={tomorrow.length}    color="amber" />
            <StatCard label="Semana" value={appointments.length} color="purple" />
          </div>

          {calendarView ? (
            <WeekCalendar
              appointments={appointments}
              currentWeek={currentWeek}
              onWeekChange={setCurrentWeek}
              onSelect={setSelected}
            />
          ) : (<>
          <Section title="Hoy" empty={today.length === 0} emptyText="Sin turnos para hoy">
            {today.map(a => <AppointmentCard key={a.id} appt={a} onClick={() => setSelected(a)} />)}
          </Section>

          {tomorrow.length > 0 && (
            <Section title="Manana" empty={false}>
              {tomorrow.map(a => <AppointmentCard key={a.id} appt={a} onClick={() => setSelected(a)} />)}
            </Section>
          )}

          {upcoming.length > 0 && (
            <Section title="Proximos dias" empty={false}>
              {upcoming.map(a => <AppointmentCard key={a.id} appt={a} onClick={() => setSelected(a)} />)}
            </Section>
          )}
          </>)}
        </>}
      </main>

      {selected && showHC && profile?.professional_id && (
        <ClinicalRecordModal
          appointmentId={selected.id}
          patientId={(selected.patient as { id?: string } | undefined)?.id ?? null}
          professionalId={profile.professional_id}
          organizationId={selected.organization_id}
          patientName={selected.patient_name}
          specialty={(profile as any).specialty ?? null}
          onClose={() => setShowHC(false)}
        />
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Detalle del turno</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">x</button>
            </div>
            <div className="p-5 space-y-3">
              {(() => {
                const cfg     = STATUS_CONFIG[selected.status]
                const patient = selected.patient as { full_name: string; phone?: string; email?: string; obra_social?: string } | undefined
                const service = selected.service as { name: string; duration_minutes: number } | undefined
                return (
                  <>
                    <div className="flex items-center gap-2">
                      <span className={['text-xs font-medium px-2.5 py-1 rounded-full', cfg?.className].join(' ')}>{cfg?.label}</span>
                      <span className="text-sm text-gray-500">
                        {format(parseISO(selected.starts_at.slice(0,10)), "EEEE d 'de' MMMM", { locale: es })} - {toArgTime(selected.starts_at)}hs
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <InfoItem label="Paciente"  value={selected.patient_name} />
                      <InfoItem label="Telefono"  value={selected.patient_phone ?? '-'} />
                      <InfoItem label="Servicio"  value={service?.name ?? '-'} />
                      <InfoItem label="Duracion"  value={service ? `${service.duration_minutes} min` : '-'} />
                      {selected.patient_email && <InfoItem label="Email" value={selected.patient_email} />}
                      {patient?.obra_social && <InfoItem label="Obra social" value={patient.obra_social} />}
                    </div>
                    <div className="flex gap-2 mt-2">
                      {featureHc && (
                        <button
                          onClick={() => setShowHC(true)}
                          className="flex-1 flex items-center justify-center gap-2 border border-sky-200 text-sky-700 hover:bg-sky-50 py-3 rounded-2xl font-semibold text-sm transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          Historia clinica
                        </button>
                      )}
                      {(selected.status === 'confirmado' || selected.status === 'pendiente') && (
                        <button
                          onClick={() => changeStatus(selected.id, 'en_atencion')}
                          className="flex-1 bg-sky-500 hover:bg-sky-600 text-white py-3 rounded-2xl font-semibold text-sm transition-colors"
                        >
                          Llamar
                        </button>
                      )}
                      {selected.status === 'en_atencion' && (
                        <button
                          onClick={() => changeStatus(selected.id, 'completado')}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-2xl font-semibold text-sm transition-colors"
                        >
                          Completado
                        </button>
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

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    sky:    'bg-sky-50 text-sky-700',
    amber:  'bg-amber-50 text-amber-700',
    purple: 'bg-purple-50 text-purple-700',
  }
  return (
    <div className={['rounded-2xl p-4', colors[color]].join(' ')}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-0.5 opacity-70">{label}</div>
    </div>
  )
}

function Section({ title, children, empty, emptyText }: {
  title: string; children?: React.ReactNode; empty: boolean; emptyText?: string
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h2>
      {empty
        ? <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center text-gray-400 text-sm">{emptyText}</div>
        : <div className="space-y-2">{children}</div>
      }
    </div>
  )
}

function AppointmentCard({ appt, onClick }: { appt: Appointment; onClick: () => void }) {
  const service = appt.service as { name: string; color?: string } | undefined
  const cfg = STATUS_CONFIG[appt.status]
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-2 w-16 flex-shrink-0">
        <Clock className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-sm font-mono text-gray-700">{toArgTime(appt.starts_at)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <UserCircle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="font-medium text-gray-900 text-sm truncate">{appt.patient_name}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <Stethoscope className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-500 truncate">{service?.name}</span>
        </div>
      </div>
      <span className={['text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0', cfg?.className].join(' ')}>
        {cfg?.label}
      </span>
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
