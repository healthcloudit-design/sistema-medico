import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, startOfWeek, addDays, startOfDay, endOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Calendar, Search, LogOut, Clock, CheckCircle, XCircle,
  UserX, Users, LayoutList, CalendarX, UserPlus,
  Banknote, CreditCard, AlertCircle, Stethoscope,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useProfile'
import { PatientSearch } from '../components/shared/PatientSearch'
import { WeekCalendar } from '../components/shared/WeekCalendar'
import { RecepcionBloqueos } from '../components/recepcion/RecepcionBloqueos'
import { NuevoTurnoRecepcion } from '../components/recepcion/NuevoTurnoRecepcion'
import { SessionTreatmentsModal } from '../components/medico/SessionTreatmentsModal'
import type { User } from '@supabase/supabase-js'
import type { Appointment, AppointmentStatus } from '../types'

// ── Design tokens ──────────────────────────────────────────────────────────────
const P800 = '#0F2830'
const GOLD = '#C9A96E'

// ── Appointment status ─────────────────────────────────────────────────────────
const APPT_STATUS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  confirmado:  { label: 'Confirmado',  color: '#166534', bg: '#f0fdf4', dot: '#22c55e' },
  pendiente:   { label: 'Pendiente',   color: '#92400e', bg: '#fffbeb', dot: '#f59e0b' },
  cancelado:   { label: 'Cancelado',   color: '#991b1b', bg: '#fef2f2', dot: '#ef4444' },
  no_asistio:  { label: 'No asistió',  color: '#374151', bg: '#f9fafb', dot: '#9ca3af' },
  completado:  { label: 'Completado',  color: '#1e3a5f', bg: '#eff6ff', dot: '#3b82f6' },
  en_atencion: { label: 'En atención', color: '#4c1d95', bg: '#f5f3ff', dot: '#8b5cf6' },
}

// ── Payment status ─────────────────────────────────────────────────────────────
const PAY_STATUS: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  pendiente_pago: { label: 'Pendiente de pago', color: '#92400e', bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b' },
  pagado:         { label: 'Pagado',             color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', dot: '#22c55e' },
  parcial:        { label: 'Pago parcial',       color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6' },
  exento:         { label: 'Exento',             color: '#374151', bg: '#f9fafb', border: '#e5e7eb', dot: '#9ca3af' },
  pendiente:      { label: 'Sin info pago',      color: '#374151', bg: '#f9fafb', border: '#e5e7eb', dot: '#9ca3af' },
}

function toArgTime(iso: string) {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d  = new Date(ms)
  return `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')}`
}

function toArgDate(iso: string) {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d  = new Date(ms)
  return `${d.getUTCFullYear()}-${(d.getUTCMonth()+1).toString().padStart(2,'0')}-${d.getUTCDate().toString().padStart(2,'0')}`
}

function ApptBadge({ status }: { status: string }) {
  const s = APPT_STATUS[status] ?? APPT_STATUS.pendiente
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'2px 8px', borderRadius:'999px', fontSize:'11px', fontWeight:600, backgroundColor:s.bg, color:s.color }}>
      <span style={{ width:'5px', height:'5px', borderRadius:'50%', backgroundColor:s.dot }}/>
      {s.label}
    </span>
  )
}

function PayBadge({ status }: { status?: string | null }) {
  const s = PAY_STATUS[status ?? 'pendiente'] ?? PAY_STATUS.pendiente
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'2px 8px', borderRadius:'999px', fontSize:'11px', fontWeight:600, backgroundColor:s.bg, color:s.color, border:`1px solid ${s.border}` }}>
      <span style={{ width:'5px', height:'5px', borderRadius:'50%', backgroundColor:s.dot }}/>
      {s.label}
    </span>
  )
}

export function RecepcionPage() {
  const [user, setUser]           = useState<User | null>(null)
  const [authLoading, setAuthL]   = useState(true)
  const [appointments, setAppts]  = useState<Appointment[]>([])
  const [allAppts, setAllAppts]   = useState<Appointment[]>([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<'turnos'|'pacientes'|'bloqueos'|'nuevo'>('turnos')
  const [search, setSearch]       = useState('')
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0,10))
  const [selected, setSelected]   = useState<Appointment | null>(null)
  const [updating, setUpdating]   = useState(false)
  const [showTreat, setShowTreat] = useState(false)
  const [calView, setCalView]     = useState(false)
  const [currentWeek, setCurWeek] = useState(new Date())
  const navigate = useNavigate()

  const { profile, loading: profileLoading } = useProfile(user)

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session } }) => { setUser(session?.user ?? null); setAuthL(false) })
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_,s) => setUser(s?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user && !authLoading) { navigate('/', { replace:true }); return }
    if (!profile) return
    if (['admin','superadmin'].includes(profile.role)) navigate('/admin', { replace:true })
    if (profile.role === 'medico') navigate('/medico', { replace:true })
  }, [user, authLoading, profile])

  const load = async () => {
    setLoading(true)
    const from = `${dateFilter}T00:00:00-03:00`
    const to   = `${dateFilter}T23:59:59-03:00`
    const { data } = await supabase
      .from('appointments')
      .select('*, professionals(full_name,specialty,consultorio), services(name,color,duration_minutes), patients(full_name,phone,email,obra_social,nro_socio)')
      .gte('starts_at', from)
      .lte('starts_at', to)
      .order('starts_at')
    setAppts((data ?? []).map((r: Record<string,unknown>) => ({
      ...r, professional:r.professionals, service:r.services, patient:r.patients,
    })) as Appointment[])
    setLoading(false)
  }

  useEffect(() => { if (profile) load() }, [dateFilter, profile])

  useEffect(() => {
    if (!profile) return
    const ws  = startOfWeek(currentWeek, { weekStartsOn:1 })
    const from = startOfDay(ws).toISOString()
    const to   = endOfDay(addDays(ws, 27)).toISOString()
    supabase.from('appointments')
      .select('*, professionals(full_name), services(name,color,duration_minutes), patients(full_name)')
      .gte('starts_at', from).lte('starts_at', to).order('starts_at')
      .then(({ data }) => setAllAppts((data ?? []).map((r: Record<string,unknown>) => ({
        ...r, professional:r.professionals, service:r.services, patient:r.patients,
      })) as Appointment[]))
  }, [profile, currentWeek])

  const filtered = appointments.filter(a => {
    if (!search) return true
    return a.patient_name.toLowerCase().includes(search.toLowerCase()) ||
           (a.patient_phone ?? '').includes(search)
  })

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    setUpdating(true)
    await supabase.from('appointments').update({ status }).eq('id', id)
    setSelected(p => p ? { ...p, status } : null)
    setAppts(p => p.map(a => a.id===id ? { ...a, status } : a))
    setUpdating(false)
  }

  const updatePayment = async (id: string, payment_status: string) => {
    setUpdating(true)
    await supabase.from('appointments').update({ payment_status }).eq('id', id)
    setSelected(p => p ? { ...p, payment_status } : null)
    setAppts(p => p.map(a => a.id===id ? { ...a, payment_status } : a))
    setUpdating(false)
  }

  if (authLoading || profileLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor:GOLD }}/>
    </div>
  )

  const todayStr     = new Date().toISOString().slice(0,10)
  const isFilterToday = dateFilter === todayStr

  const TABS = [
    { id:'turnos',    icon:Calendar,  label:'Turnos'    },
    { id:'pacientes', icon:Users,     label:'Pacientes' },
    { id:'bloqueos',  icon:CalendarX, label:'Bloqueos'  },
    { id:'nuevo',     icon:UserPlus,  label:'Nuevo'     },
  ] as const

  return (
    <div className="min-h-screen" style={{ backgroundColor:'#EEF1F5' }}>

      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3"
        style={{ backgroundColor:P800, borderBottom:'1px solid rgba(255,255,255,0.06)', boxShadow:'0 1px 10px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center gap-2">
          <div style={{ display:'flex', alignItems:'baseline', gap:'4px', userSelect:'none' }}>
            <span style={{ fontWeight:800, fontSize:'15px', letterSpacing:'-0.03em', color:'#fff' }}>PRAXIS</span>
            <span style={{ fontWeight:300, fontSize:'13px', letterSpacing:'0.06em', color:GOLD }}>Agenda</span>
          </div>
          <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.3)', fontWeight:400 }}>· Recepción</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm hidden sm:block" style={{ color:'rgba(255,255,255,0.5)' }}>{profile?.full_name}</span>
          <button onClick={() => supabase.auth.signOut()}
            style={{ background:'none', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'6px 10px', color:'rgba(255,255,255,0.4)', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', fontSize:'12px' }}>
            <LogOut className="w-3.5 h-3.5"/> Salir
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">

        {/* Tab bar */}
        <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor:'rgba(0,0,0,0.06)' }}>
          {TABS.map(({ id, icon:Icon, label }) => {
            const active = tab === id
            return (
              <button key={id} onClick={() => setTab(id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ backgroundColor: active ? '#fff' : 'transparent', color: active ? '#111827' : '#6b7280', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                <Icon className="w-4 h-4"/>{label}
              </button>
            )
          })}
          {tab === 'turnos' && (
            <button onClick={() => setCalView(v => !v)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: calView ? '#fff' : 'transparent', color: calView ? P800 : '#6b7280', boxShadow: calView ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {calView ? <LayoutList className="w-4 h-4"/> : <Calendar className="w-4 h-4"/>}
            </button>
          )}
        </div>

        {tab === 'pacientes' && (
          <PatientSearch orgId={(profile as any)?.organization_id ?? null}/>
        )}

        {tab === 'turnos' && <>
          {calView ? (
            <WeekCalendar appointments={allAppts} currentWeek={currentWeek} onWeekChange={setCurWeek} onSelect={setSelected}/>
          ) : (
            <>
              {/* Stats */}
              {isFilterToday && (
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label:'Total',       count:filtered.length,                                         color:'#1e3a5f', bg:'#eff6ff' },
                    { label:'Confirmados', count:filtered.filter(a=>a.status==='confirmado').length,       color:'#166534', bg:'#f0fdf4' },
                    { label:'Pendientes',  count:filtered.filter(a=>a.status==='pendiente').length,        color:'#92400e', bg:'#fffbeb' },
                    { label:'Sin cobrar',  count:filtered.filter(a=>!a.payment_status||a.payment_status==='pendiente_pago'||a.payment_status==='pendiente').length, color:'#991b1b', bg:'#fef2f2' },
                  ].map(s => (
                    <div key={s.label} style={{ backgroundColor:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', padding:'12px', textAlign:'center', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                      <div style={{ fontSize:'22px', fontWeight:700, color:s.color }}>{s.count}</div>
                      <div style={{ fontSize:'10px', color:'#64748b', marginTop:'2px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-2"
                style={{ backgroundColor:'#fff', borderRadius:'14px', border:'1px solid #e2e8f0', padding:'14px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor:"#e2e8f0" }}/>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nombre o teléfono..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2"
                    style={{ borderColor:'#e2e8f0' }}/>
                </div>
              </div>

              {/* List */}
              <div style={{ backgroundColor:'#fff', borderRadius:'14px', border:'1px solid #e2e8f0', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                {loading ? (
                  <div className="p-4 space-y-3">
                    {[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor:'#f1f5f9' }}/>)}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="p-8 text-center" style={{ color:'#94a3b8' }}>
                    {search ? 'Sin resultados para esa búsqueda' : 'Sin turnos para este día'}
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor:'#f1f5f9' }}>
                    {filtered.map(a => {
                      const svc = a.service as { name:string }|undefined
                      const pay = PAY_STATUS[a.payment_status ?? 'pendiente'] ?? PAY_STATUS.pendiente
                      return (
                        <div key={a.id} onClick={() => setSelected(a)}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50">
                          <div className="flex items-center gap-1 w-12 flex-shrink-0">
                            <Clock className="w-3 h-3 text-gray-400"/>
                            <span className="text-xs font-mono text-gray-600">{toArgTime(a.starts_at)}</span>
                          </div>
                          <div style={{ width:'3px', height:'30px', borderRadius:'2px', flexShrink:0, backgroundColor:(APPT_STATUS[a.status]??APPT_STATUS.pendiente).dot }}/>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900">{a.patient_name}</div>
                            <div className="text-xs text-gray-400 truncate">{svc?.name}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <ApptBadge status={a.status}/>
                            <PayBadge status={a.payment_status}/>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </>}

        {tab === 'bloqueos' && (
          <RecepcionBloqueos organizationId={(profile as any)?.organization_id ?? ''}/>
        )}
        {tab === 'nuevo' && (
          <NuevoTurnoRecepcion organizationId={(profile as any)?.organization_id ?? ''}/>
        )}
      </main>

      {/* Appointment modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor:'rgba(11,30,36,0.6)', backdropFilter:'blur(4px)' }}
          onClick={e => { if (e.target===e.currentTarget) setSelected(null) }}>
          <div style={{ width:'100%', maxWidth:'460px', borderRadius:'18px', overflow:'hidden', backgroundColor:'#fff', boxShadow:'0 32px 72px rgba(0,0,0,0.22)' }}>

            {/* Modal header */}
            <div style={{ padding:'18px 20px', backgroundColor:P800, borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div style={{ fontSize:'15px', fontWeight:700, color:'#fff', marginBottom:'3px' }}>{selected.patient_name}</div>
                  <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)', textTransform:'capitalize' }}>
                    {format(parseISO(toArgDate(selected.starts_at)), "EEEE d 'de' MMMM", { locale:es })} · {toArgTime(selected.starts_at)}hs
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.35)', fontSize:'20px', lineHeight:1 }}>×</button>
              </div>
            </div>

            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'16px' }}>
              {(() => {
                const patient = selected.patient as { full_name:string; phone?:string; email?:string; obra_social?:string; nro_socio?:string }|undefined
                const service = selected.service as { name:string; duration_minutes?:number }|undefined
                const prof    = selected.professional as { full_name:string; specialty?:string; consultorio?:string|null }|undefined

                return (
                  <>
                    {/* Status badges */}
                    <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                      <ApptBadge status={selected.status}/>
                      <PayBadge status={selected.payment_status}/>
                    </div>

                    {/* Obra social alert */}
                    {selected.status === 'pendiente' && patient?.obra_social && (
                      <div style={{ backgroundColor:'#fffbeb', border:'1px solid #fde68a', borderRadius:'10px', padding:'12px 14px', display:'flex', gap:'8px' }}>
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5"/>
                        <div>
                          <div style={{ fontSize:'11px', fontWeight:700, color:'#92400e', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'2px' }}>Verificar cobertura</div>
                          <div style={{ fontSize:'13px', fontWeight:600, color:'#78350f' }}>{patient.obra_social}</div>
                          {patient.nro_socio && <div style={{ fontSize:'12px', color:'#92400e' }}>N° socio: <span style={{ fontFamily:'monospace', fontWeight:700 }}>{patient.nro_socio}</span></div>}
                        </div>
                      </div>
                    )}

                    {/* Info grid */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                      {[
                        ['Servicio',     service?.name ?? '—'],
                        ['Duración',     service?.duration_minutes ? `${service.duration_minutes} min` : '—'],
                        ['Profesional',  prof?.full_name ?? '—'],
                        ['Consultorio',  prof?.consultorio ?? '—'],
                        ['Teléfono',     selected.patient_phone ?? '—'],
                        ...(selected.patient_email ? [['Email', selected.patient_email]] as [string,string][] : []),
                        ...(patient?.obra_social && selected.status !== 'pendiente' ? [['Obra social', `${patient.obra_social}${patient.nro_socio ? ` · ${patient.nro_socio}` : ''}`]] as [string,string][] : []),
                      ].map(([label, value]) => (
                        <div key={label}>
                          <div style={{ fontSize:'10px', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'2px' }}>{label}</div>
                          <div style={{ fontSize:'13px', color:'#0f1923', fontWeight:500 }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* ── Payment status selector ── */}
                    <div style={{ backgroundColor:'#f8fafc', borderRadius:'12px', padding:'14px', border:'1px solid #e2e8f0' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'10px' }}>
                        <Banknote className="w-3.5 h-3.5" style={{ color:'#64748b' }}/>
                        <span style={{ fontSize:'11px', fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.08em' }}>Estado de cobro</span>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'6px' }}>
                        {Object.entries(PAY_STATUS).filter(([k]) => k !== 'pendiente').map(([key, cfg]) => {
                          const active = (selected.payment_status ?? 'pendiente_pago') === key
                          return (
                            <button key={key} onClick={() => updatePayment(selected.id, key)} disabled={updating}
                              style={{ display:'flex', alignItems:'center', gap:'7px', padding:'9px 11px', borderRadius:'9px', fontSize:'12px', fontWeight: active ? 600 : 400, border:`1.5px solid ${active ? cfg.border : '#e2e8f0'}`, backgroundColor: active ? cfg.bg : '#fff', color: active ? cfg.color : '#64748b', cursor:'pointer', transition:'all 0.12s', textAlign:'left' }}>
                              <span style={{ width:'7px', height:'7px', borderRadius:'50%', backgroundColor: active ? cfg.dot : '#cbd5e1', flexShrink:0 }}/>
                              {cfg.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* ── Appointment action buttons ── */}
                    <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                      {selected.status === 'pendiente' && (
                        <ActionBtn icon={CheckCircle} label="Confirmar" color="sky" onClick={() => updateStatus(selected.id,'confirmado')} loading={updating}/>
                      )}
                      {['confirmado','pendiente'].includes(selected.status) && (
                        <ActionBtn icon={CreditCard} label="Llamar" color="teal" onClick={() => updateStatus(selected.id,'en_atencion')} loading={updating}/>
                      )}
                      {selected.status === 'en_atencion' && (
                        <ActionBtn icon={CheckCircle} label="Completado" color="sky" onClick={() => updateStatus(selected.id,'completado')} loading={updating}/>
                      )}
                      {!['no_asistio','completado','cancelado'].includes(selected.status) && (
                        <ActionBtn icon={UserX} label="No asistió" color="gray" onClick={() => updateStatus(selected.id,'no_asistio')} loading={updating}/>
                      )}
                      {!['cancelado','completado'].includes(selected.status) && (
                        <ActionBtn icon={XCircle} label="Cancelar" color="red" onClick={() => updateStatus(selected.id,'cancelado')} loading={updating}/>
                      )}
                    </div>

                    {/* Treatments button */}
                    <button onClick={() => setShowTreat(true)}
                      style={{ display:'flex', alignItems:'center', gap:'6px', width:'100%', padding:'10px 14px', borderRadius:'10px', fontSize:'12px', fontWeight:500, backgroundColor:'#f5f3ff', color:'#7c3aed', border:'1px solid #e9d5ff', cursor:'pointer', marginTop:'2px' }}>
                      <Stethoscope className="w-4 h-4"/> Ver tratamientos realizados
                    </button>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Session treatments — read-only for recepción */}
      {selected && showTreat && (
        <SessionTreatmentsModal
          appointmentId={selected.id}
          organizationId={(profile as any)?.organization_id ?? ''}
          patientName={selected.patient_name}
          readOnly={true}
          onClose={() => setShowTreat(false)}
        />
      )}
    </div>
  )
}

function ActionBtn({ icon:Icon, label, color, onClick, loading }: {
  icon:React.ElementType; label:string; color:string; onClick:()=>void; loading:boolean
}) {
  const COLORS: Record<string,string> = {
    sky:  'background:#0369a1;color:#fff',
    teal: 'background:#0d9488;color:#fff',
    gray: 'background:#f1f5f9;color:#475569',
    red:  'background:#fef2f2;color:#dc2626',
  }
  const [bg, fg] = (COLORS[color] ?? COLORS.gray).split(';').map(p => p.split(':')[1])
  return (
    <button onClick={onClick} disabled={loading}
      style={{ display:'flex', alignItems:'center', gap:'6px', padding:'9px 14px', borderRadius:'10px', fontSize:'12px', fontWeight:500, backgroundColor:bg, color:fg, border:'none', cursor:'pointer', opacity: loading ? 0.6 : 1, transition:'opacity 0.15s' }}>
      <Icon className="w-4 h-4"/>{label}
    </button>
  )
}
