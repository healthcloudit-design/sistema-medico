import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, isToday, isTomorrow, startOfDay, endOfDay, addDays, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, LogOut, FileText, Users, LayoutList, CalendarX, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useProfile'
import { useOrgFeatures } from '../hooks/useOrgFeatures'
import { ClinicalRecordModal } from '../components/medico/ClinicalRecordModal'
import { PatientSearch } from '../components/shared/PatientSearch'
import { WeekCalendar } from '../components/shared/WeekCalendar'
import { MiAgendaBloqueos } from '../components/medico/MiAgendaBloqueos'
import type { User } from '@supabase/supabase-js'
import type { Appointment } from '../types'

// ── PRAXIS Agenda tokens ─────────────────────────────────────────────────────
const P800      = '#0F2830'
const P600      = '#1A3F4E'
const GOLD      = '#C9A96E'
const GOLD_DIM  = '#C9A96E22'
const GOLD_BRD  = '#C9A96E55'
const T_HI      = '#FFFFFF'
const T_MED     = 'rgba(255,255,255,0.55)'
const T_LOW     = 'rgba(255,255,255,0.25)'
const SIDEBAR_BORDER = 'rgba(255,255,255,0.07)'
const BG        = '#F4F5F7'
const CARD      = '#FFFFFF'
const TEXT      = '#111827'
const TEXT_SEC  = '#6B7280'
const BORDER    = '#E5E7EB'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  confirmado:  { label: 'Confirmado',  color: '#16a34a', bg: '#f0fdf4' },
  pendiente:   { label: 'Pendiente',   color: '#d97706', bg: '#fffbeb' },
  cancelado:   { label: 'Cancelado',   color: '#dc2626', bg: '#fef2f2' },
  no_asistio:  { label: 'No asistió',  color: '#6b7280', bg: '#f9fafb' },
  completado:  { label: 'Completado',  color: '#2563eb', bg: '#eff6ff' },
  en_atencion: { label: 'En atención', color: '#7c3aed', bg: '#f5f3ff' },
}

function toArgTime(iso: string) {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d = new Date(ms)
  return `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')}`
}

function PraxisWordmark() {
  return (
    <div className="flex items-baseline gap-1 select-none">
      <span className="font-extrabold text-base tracking-tight text-white"
        style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '-0.02em' }}>PRAXIS</span>
      <span className="font-light text-sm tracking-wide" style={{ color: GOLD, fontFamily: "'Inter', sans-serif" }}>Agenda</span>
    </div>
  )
}

export function MedicoDashboard() {
  const [user, setUser]                 = useState<User | null>(null)
  const [authLoading, setAuthLoading]   = useState(true)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [, setLoadingAppts] = useState(true)
  const [selected, setSelected]         = useState<Appointment | null>(null)
  const [showHC, setShowHC]             = useState(false)
  const [tab, setTab]                   = useState<'agenda' | 'pacientes' | 'bloqueos'>('agenda')
  const [calendarView, setCalendarView] = useState(false)
  const [currentWeek, setCurrentWeek]   = useState(new Date())
  const navigate = useNavigate()

  const { profile, loading: profileLoading } = useProfile(user)
  const [orgId, setOrgId]           = useState<string | null>(null)
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
    if (!user && !authLoading) { navigate('/', { replace: true }); return }
    if (!profile) return
    if (profile.role === 'admin' || profile.role === 'superadmin') navigate('/admin', { replace: true })
    if (profile.role === 'recepcion') navigate('/recepcion', { replace: true })
  }, [user, authLoading, profile])

  useEffect(() => {
    if (!profile?.professional_id) return
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const from = startOfDay(weekStart).toISOString()
    const to   = endOfDay(addDays(weekStart, 27)).toISOString()
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

  useEffect(() => {
    if (!profile?.professional_id) return
    const channel = supabase
      .channel(`medico-appts-${profile.professional_id}`)
      .on('postgres_changes',
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
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.professional_id])

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: P800 }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: GOLD }} />
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

  // ── Tab config ──────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'agenda',    icon: Calendar,  label: 'Mi agenda' },
    { id: 'pacientes', icon: Users,     label: clientesLabel },
    { id: 'bloqueos',  icon: CalendarX, label: 'Bloqueos' },
  ] as const

  return (
    <div className="min-h-screen" style={{ backgroundColor: BG }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: P800, borderBottom: `1px solid ${SIDEBAR_BORDER}`, boxShadow: '0 1px 8px rgba(0,0,0,0.2)' }}>
        <PraxisWordmark />
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-medium" style={{ color: T_HI }}>{profile?.full_name}</div>
            <div className="text-xs" style={{ color: T_LOW }}>Profesional</div>
          </div>
          <button onClick={() => supabase.auth.signOut()}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T_MED }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239,68,68,0.15)'; (e.currentTarget as HTMLElement).style.color = '#f87171' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = T_MED }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 pb-10 space-y-5">

        {/* ── Stat row (agenda only) ── */}
        {tab === 'agenda' && (
          <div className="grid grid-cols-3 gap-3 pt-1">
            <MiniStat label="Hoy"     value={today.length}        accent={P600} />
            <MiniStat label="Mañana"  value={tomorrow.length}     accent="#92400e" />
            <MiniStat label="Próximos" value={appointments.length} accent="#4c1d95" />
          </div>
        )}

        {/* ── Tab bar ── */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: '#E4E7EB' }}>
          {TABS.map(({ id, icon: Icon, label }) => {
            const isActive = tab === id
            return (
              <button key={id}
                onClick={() => setTab(id as any)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: isActive ? CARD : 'transparent',
                  color: isActive ? TEXT : TEXT_SEC,
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  border: 'none', cursor: 'pointer',
                }}>
                <Icon size={14} />
                {label}
              </button>
            )
          })}
          {tab === 'agenda' && (
            <button
              onClick={() => setCalendarView(v => !v)}
              className="flex items-center justify-center px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: calendarView ? CARD : 'transparent',
                color: calendarView ? P600 : TEXT_SEC,
                boxShadow: calendarView ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                border: 'none', cursor: 'pointer',
              }}
              title={calendarView ? 'Vista lista' : 'Vista calendario'}
            >
              {calendarView ? <LayoutList size={14} /> : <Calendar size={14} />}
            </button>
          )}
        </div>

        {/* ── Content ── */}
        {tab === 'bloqueos' && profile?.professional_id && (
          <MiAgendaBloqueos professionalId={profile.professional_id} />
        )}

        {tab === 'pacientes' && (
          <PatientSearch orgId={orgId} professionalId={profile?.professional_id ?? null} />
        )}

        {tab === 'agenda' && (
          <>
            {calendarView ? (
              <WeekCalendar
                appointments={appointments}
                currentWeek={currentWeek}
                onWeekChange={setCurrentWeek}
                onSelect={setSelected}
              />
            ) : (
              <>
                <AgendaSection title="Hoy" empty={today.length === 0} emptyText="Sin turnos para hoy">
                  {today.map(a => <ApptCard key={a.id} appt={a} onClick={() => setSelected(a)} />)}
                </AgendaSection>
                {tomorrow.length > 0 && (
                  <AgendaSection title="Mañana" empty={false}>
                    {tomorrow.map(a => <ApptCard key={a.id} appt={a} onClick={() => setSelected(a)} />)}
                  </AgendaSection>
                )}
                {upcoming.length > 0 && (
                  <AgendaSection title="Próximos días" empty={false}>
                    {upcoming.map(a => <ApptCard key={a.id} appt={a} onClick={() => setSelected(a)} />)}
                  </AgendaSection>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* ── Clinical record modal ── */}
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

      {/* ── Appointment detail drawer ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ backgroundColor: CARD, boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: P800 }}>
              <span className="text-sm font-semibold" style={{ color: T_HI }}>Detalle del turno</span>
              <button onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: T_MED, fontSize: '18px', lineHeight: 1 }}>
                ×
              </button>
            </div>

            {(() => {
              const cfg     = STATUS_CONFIG[selected.status]
              const patient = selected.patient as { full_name: string; phone?: string; email?: string; obra_social?: string } | undefined
              const service = selected.service as { name: string; duration_minutes: number } | undefined
              return (
                <div className="p-5 space-y-4">
                  {/* Status + time */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: cfg?.bg, color: cfg?.color }}>
                      {cfg?.label}
                    </span>
                    <span className="text-sm" style={{ color: TEXT_SEC }}>
                      {format(parseISO(selected.starts_at.slice(0,10)), "EEEE d 'de' MMMM", { locale: es })} · {toArgTime(selected.starts_at)}hs
                    </span>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow label="Paciente"   value={selected.patient_name} />
                    <InfoRow label="Teléfono"   value={selected.patient_phone ?? '-'} />
                    <InfoRow label="Servicio"   value={service?.name ?? '-'} />
                    <InfoRow label="Duración"   value={service ? `${service.duration_minutes} min` : '-'} />
                    {selected.patient_email && <InfoRow label="Email" value={selected.patient_email} />}
                    {patient?.obra_social     && <InfoRow label="Obra social" value={patient.obra_social} />}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    {featureHc && (
                      <button onClick={() => setShowHC(true)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all"
                        style={{ border: `1px solid ${BORDER}`, color: P600, backgroundColor: 'transparent' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#f0f4f5'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                      >
                        <FileText size={15} /> Historia clínica
                      </button>
                    )}
                    {(selected.status === 'confirmado' || selected.status === 'pendiente') && (
                      <button onClick={() => changeStatus(selected.id, 'en_atencion')}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all"
                        style={{ backgroundColor: P600, border: 'none', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = P800}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = P600}
                      >
                        Llamar
                      </button>
                    )}
                    {selected.status === 'en_atencion' && (
                      <button onClick={() => changeStatus(selected.id, 'completado')}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all"
                        style={{ backgroundColor: '#16a34a', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#15803d'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#16a34a'}
                      >
                        Completado
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function MiniStat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl p-3.5" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
      <div className="text-2xl font-bold" style={{ color: accent }}>{value}</div>
      <div className="text-xs font-medium mt-0.5" style={{ color: TEXT_SEC }}>{label}</div>
    </div>
  )
}

function AgendaSection({ title, children, empty, emptyText }: {
  title: string; children?: React.ReactNode; empty: boolean; emptyText?: string
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: TEXT_SEC }}>
          {title}
        </h2>
      </div>
      {empty
        ? (
          <div className="rounded-xl p-5 text-center text-sm" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, color: TEXT_SEC }}>
            {emptyText}
          </div>
        )
        : <div className="space-y-2">{children}</div>
      }
    </div>
  )
}

function ApptCard({ appt, onClick }: { appt: Appointment; onClick: () => void }) {
  const service = appt.service as { name: string; color?: string } | undefined
  const cfg = STATUS_CONFIG[appt.status]
  return (
    <button onClick={onClick} className="w-full text-left rounded-xl p-4 flex items-center gap-3 transition-all"
      style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'}
    >
      {/* Status dot */}
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg?.color }} />
      {/* Time */}
      <div className="text-sm font-mono font-semibold w-11 flex-shrink-0" style={{ color: TEXT }}>
        {toArgTime(appt.starts_at)}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: TEXT }}>{appt.patient_name}</div>
        {service?.name && (
          <div className="text-xs truncate mt-0.5" style={{ color: TEXT_SEC }}>{service.name}</div>
        )}
      </div>
      {/* Badge */}
      <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: cfg?.bg, color: cfg?.color }}>
        {cfg?.label}
      </span>
      <ChevronRight size={14} style={{ color: TEXT_SEC, flexShrink: 0 }} />
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs mb-0.5" style={{ color: TEXT_SEC }}>{label}</div>
      <div className="text-sm font-medium" style={{ color: TEXT }}>{value}</div>
    </div>
  )
}
