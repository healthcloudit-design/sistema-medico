import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  format, parseISO, isToday, isTomorrow, isSameDay,
  startOfDay, endOfDay, addDays, startOfWeek, endOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import {
  LayoutDashboard, Calendar, Users, LogOut, FileText,
  CalendarX, ChevronRight, Search, MessageCircle,
  CheckCircle, AlertCircle, TrendingUp, Menu, X, ArrowRight,
  Lock, Clock, Activity, CalendarClock, UserX, XCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useProfile'
import { useOrgFeatures } from '../hooks/useOrgFeatures'
import { SessionTreatmentsModal } from '../components/medico/SessionTreatmentsModal'
import { ClinicalRecordModal } from '../components/medico/ClinicalRecordModal'
import { PatientSearch } from '../components/shared/PatientSearch'
import { WeekCalendar } from '../components/shared/WeekCalendar'
import { RescheduleModal } from '../components/shared/RescheduleModal'
import { MiAgendaBloqueos } from '../components/medico/MiAgendaBloqueos'
import { MiHorarios } from '../components/medico/MiHorarios'
import type { User } from '@supabase/supabase-js'
import type { Appointment } from '../types'

// ── Design tokens ─────────────────────────────────────────────────────────────
const P900    = '#0B1E24'
const P800    = '#0F2830'
const P600    = '#1A3F4E'
const GOLD    = '#C9A96E'
const GOLD_DIM= '#C9A96E18'
const GOLD_BD = '#C9A96E44'
const BG      = '#EEF1F5'
const CARD    = '#FFFFFF'
const CARD2   = '#F8FAFB'
const TEXT    = '#0F1923'
const T2      = '#475569'
const T3      = '#94A3B8'
const BD      = '#E2E8F0'
const BD2     = '#CBD5E1'

const ST: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  confirmado:  { label: 'Confirmado',  color: '#166534', bg: '#F0FDF4', dot: '#22C55E' },
  pendiente:   { label: 'Pendiente',   color: '#92400E', bg: '#FFFBEB', dot: '#F59E0B' },
  cancelado:   { label: 'Cancelado',   color: '#991B1B', bg: '#FEF2F2', dot: '#EF4444' },
  no_asistio:  { label: 'No asistió',  color: '#374151', bg: '#F9FAFB', dot: '#9CA3AF' },
  completado:  { label: 'Completado',  color: '#1E3A5F', bg: '#EFF6FF', dot: '#3B82F6' },
  en_atencion: { label: 'En atención', color: '#4C1D95', bg: '#F5F3FF', dot: '#8B5CF6' },
}

type View = 'dashboard' | 'agenda' | 'pacientes' | 'bloqueos'

function argTime(iso: string) {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d  = new Date(ms)
  return `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')}`
}

// ── Wordmark ──────────────────────────────────────────────────────────────────
function Wordmark() {
  return (
    <div style={{ display:'flex', alignItems:'baseline', gap:'4px', userSelect:'none' }}>
      <span style={{ fontFamily:"'Inter',sans-serif", fontWeight:800, fontSize:'15px', letterSpacing:'-0.03em', color:'#fff' }}>PRAXIS</span>
      <span style={{ fontFamily:"'Inter',sans-serif", fontWeight:300, fontSize:'13px', letterSpacing:'0.06em', color:GOLD }}>Agenda</span>
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────
function Badge({ status }: { status: string }) {
  const s = ST[status] ?? ST.pendiente
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'2px 8px', borderRadius:'999px', fontSize:'10px', fontWeight:600, backgroundColor:s.bg, color:s.color, whiteSpace:'nowrap' }}>
      <span style={{ width:'5px', height:'5px', borderRadius:'50%', backgroundColor:s.dot }} />{s.label}
    </span>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id:'dashboard',     icon:LayoutDashboard, label:'Inicio'    },
  { id:'agenda',        icon:Calendar,        label:'Mi agenda' },
  { id:'pacientes',     icon:Users,           label:'Pacientes' },
  { id:'bloqueos',      icon:CalendarX,       label:'Disponibilidad' },
] as const

function Sidebar({ view, go, profile, logout, close }: {
  view:View; go:(v:View)=>void; profile:any; logout:()=>void; close?:()=>void
}) {
  const initials = profile?.full_name?.split(' ').map((n:string)=>n[0]).slice(0,2).join('') ?? '?'
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', backgroundColor:P800 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 16px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <Wordmark />
        {close && <button onClick={close} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.35)', padding:'2px' }}><X size={15}/></button>}
      </div>
      <nav style={{ flex:1, padding:'10px 8px', display:'flex', flexDirection:'column', gap:'2px' }}>
        {NAV_ITEMS.map(({ id, icon:Icon, label }) => {
          const active = view === id
          return (
            <button key={id} onClick={() => { go(id); close?.() }}
              style={{ display:'flex', alignItems:'center', gap:'10px', width:'100%', padding:'9px 12px', borderRadius:'8px', fontSize:'13px', fontWeight: active ? 500 : 400, border: active ? `1px solid ${GOLD_BD}` : '1px solid transparent', backgroundColor: active ? GOLD_DIM : 'transparent', color: active ? GOLD : 'rgba(255,255,255,0.5)', cursor:'pointer', textAlign:'left', transition:'all 0.12s' }}
              onMouseEnter={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.backgroundColor='rgba(255,255,255,0.06)'; el.style.color='#fff' } }}
              onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.backgroundColor='transparent'; el.style.color='rgba(255,255,255,0.5)' } }}
            >
              <Icon size={14} style={{ flexShrink:0 }}/>
              <span style={{ flex:1 }}>{label}</span>
              {active && <ChevronRight size={11} style={{ opacity:0.4 }}/>}
            </button>
          )
        })}
      </nav>
      <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
          <div style={{ width:'32px', height:'32px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:700, backgroundColor:GOLD_DIM, color:GOLD, border:`1px solid ${GOLD_BD}`, flexShrink:0 }}>{initials}</div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:'12px', fontWeight:500, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'120px' }}>{profile?.full_name ?? '—'}</div>
            <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.3)' }}>Profesional</div>
          </div>
        </div>
        <button onClick={logout}
          style={{ display:'flex', alignItems:'center', gap:'6px', width:'100%', padding:'7px 10px', borderRadius:'7px', fontSize:'11px', fontWeight:500, backgroundColor:'transparent', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.35)', cursor:'pointer', transition:'all 0.12s' }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor='rgba(239,68,68,0.12)'; el.style.borderColor='#fca5a5'; el.style.color='#f87171' }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor='transparent'; el.style.borderColor='rgba(255,255,255,0.08)'; el.style.color='rgba(255,255,255,0.35)' }}
        ><LogOut size={12}/> Cerrar sesión</button>
      </div>
    </div>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────
function Metric({ icon:Icon, label, value, sub, accent=P600, loading=false }: {
  icon:React.ElementType; label:string; value:string|number; sub?:string; accent?:string; loading?:boolean
}) {
  return (
    <div style={{ backgroundColor:CARD, borderRadius:'12px', padding:'16px', border:`1px solid ${BD}`, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ width:'36px', height:'36px', borderRadius:'9px', display:'flex', alignItems:'center', justifyContent:'center', backgroundColor:`${accent}12`, marginBottom:'14px' }}>
        <Icon size={16} style={{ color:accent }}/>
      </div>
      {loading
        ? <div style={{ width:'44px', height:'28px', borderRadius:'6px', backgroundColor:BG, marginBottom:'4px' }}/>
        : <div style={{ fontSize:'26px', fontWeight:700, color:TEXT, lineHeight:1, marginBottom:'3px' }}>{value}</div>
      }
      <div style={{ fontSize:'12px', fontWeight:500, color:T2 }}>{label}</div>
      {sub && <div style={{ fontSize:'11px', color:T3, marginTop:'2px' }}>{sub}</div>}
    </div>
  )
}

// ── Weekly bar chart (inline SVG) ─────────────────────────────────────────────
function WeekChart({ appointments }: { appointments:Appointment[] }) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn:1 })
  const DAYS = ['Lun','Mar','Mié','Jue','Vie','Sáb']
  const counts = DAYS.map((_,i) => appointments.filter(a => isSameDay(parseISO(a.starts_at), addDays(weekStart,i)) && a.status !== 'cancelado').length)
  const max    = Math.max(...counts, 1)
  const todayI = (new Date().getDay() + 6) % 7

  return (
    <div style={{ backgroundColor:CARD, borderRadius:'12px', padding:'18px 20px', border:`1px solid ${BD}`, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'16px' }}>
        <div>
          <div style={{ fontSize:'13px', fontWeight:600, color:TEXT }}>Ocupación semanal</div>
          <div style={{ fontSize:'11px', color:T3, marginTop:'2px' }}>Turnos confirmados por día</div>
        </div>
        <Activity size={15} style={{ color:T3, marginTop:'2px' }}/>
      </div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:'6px', height:'72px' }}>
        {counts.map((n, i) => {
          const h   = Math.max((n / max) * 56, n > 0 ? 8 : 2)
          const act = i === todayI
          return (
            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', height:'100%', justifyContent:'flex-end' }}>
              <span style={{ fontSize:'10px', fontWeight:act ? 700 : 400, color: act ? GOLD : (n > 0 ? P600 : T3) }}>{n > 0 ? n : ''}</span>
              <div style={{ width:'100%', borderRadius:'4px 4px 0 0', height:`${h}px`, backgroundColor: act ? GOLD : (n > 0 ? P600 : BD), transition:'height 0.3s ease' }}/>
              <span style={{ fontSize:'10px', fontWeight: act ? 600 : 400, color: act ? GOLD : T3 }}>{DAYS[i]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Appointment card (timeline style) ────────────────────────────────────────
function ApptCard({ appt, onClick }: { appt:Appointment; onClick:()=>void }) {
  const svc = appt.service as { name:string; duration_minutes?:number }|undefined
  const s   = ST[appt.status] ?? ST.pendiente
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display:'flex', gap:'12px', padding:'13px 14px', borderRadius:'10px', border:`1px solid ${hov ? BD2 : BD}`, backgroundColor: hov ? '#F8FAFC' : CARD, cursor:'pointer', transition:'all 0.12s', boxShadow: hov ? '0 4px 12px rgba(0,0,0,0.07)' : '0 1px 2px rgba(0,0,0,0.03)' }}>
      <div style={{ textAlign:'center', width:'38px', flexShrink:0 }}>
        <div style={{ fontSize:'12px', fontWeight:700, color:TEXT, fontFamily:'monospace' }}>{argTime(appt.starts_at)}</div>
        {svc?.duration_minutes && <div style={{ fontSize:'10px', color:T3, marginTop:'2px' }}>{svc.duration_minutes}′</div>}
      </div>
      <div style={{ width:'2px', borderRadius:'2px', backgroundColor:s.dot, flexShrink:0, alignSelf:'stretch' }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', marginBottom:'3px' }}>
          <span style={{ fontSize:'13px', fontWeight:600, color:TEXT, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{appt.patient_name}</span>
          <Badge status={appt.status}/>
        </div>
        <div style={{ fontSize:'12px', color:T2 }}>{svc?.name ?? 'Consulta'}</div>
        {appt.patient_phone && <div style={{ fontSize:'11px', color:T3, marginTop:'3px' }}>{appt.patient_phone}</div>}
      </div>
      <ChevronRight size={14} style={{ color:T3, alignSelf:'center', flexShrink:0 }}/>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function Empty({ go }: { go:(v:View)=>void }) {
  return (
    <div style={{ textAlign:'center', padding:'36px 20px', borderRadius:'12px', border:`1.5px dashed ${BD2}`, backgroundColor:CARD2 }}>
      <div style={{ width:'44px', height:'44px', borderRadius:'12px', backgroundColor:`${P600}0D`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
        <Calendar size={20} style={{ color:P600 }}/>
      </div>
      <h3 style={{ fontSize:'14px', fontWeight:600, color:TEXT, margin:'0 0 6px' }}>Sin turnos para hoy</h3>
      <p style={{ fontSize:'12px', color:T2, maxWidth:'240px', margin:'0 auto 20px', lineHeight:1.65 }}>
        No tenés turnos programados. Revisá la agenda, creá uno nuevo o bloqueá horarios no disponibles.
      </p>
      <div style={{ display:'flex', gap:'8px', justifyContent:'center', flexWrap:'wrap' }}>
        <button onClick={() => go('agenda')} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'8px 14px', borderRadius:'8px', fontSize:'12px', fontWeight:500, backgroundColor:P600, color:'#fff', border:'none', cursor:'pointer' }}><Calendar size={12}/> Ver agenda</button>
        <button onClick={() => go('bloqueos')} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'8px 14px', borderRadius:'8px', fontSize:'12px', fontWeight:500, backgroundColor:'transparent', color:T2, border:`1px solid ${BD}`, cursor:'pointer' }}><Lock size={12}/> Bloquear horario</button>
      </div>
    </div>
  )
}

// ── Section block ─────────────────────────────────────────────────────────────
function Section({ title, count, empty, children }: { title:string; count:number; empty?:string; children?:React.ReactNode }) {
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
        <div style={{ width:'3px', height:'13px', borderRadius:'2px', backgroundColor:GOLD }}/>
        <span style={{ fontSize:'11px', fontWeight:600, color:T2, textTransform:'uppercase', letterSpacing:'0.09em' }}>{title}</span>
        <span style={{ fontSize:'11px', color:T3 }}>({count})</span>
      </div>
      {count === 0
        ? <div style={{ padding:'14px', borderRadius:'10px', textAlign:'center', fontSize:'12px', color:T3, backgroundColor:CARD2, border:`1px solid ${BD}` }}>{empty}</div>
        : <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>{children}</div>
      }
    </div>
  )
}

// ── Right panel ───────────────────────────────────────────────────────────────
function RightPanel({ appointments, onSelect, go }: {
  appointments:Appointment[]; onSelect:(a:Appointment)=>void; go:(v:View)=>void
}) {
  const now   = new Date()
  const next  = appointments.filter(a => parseISO(a.starts_at) > now && a.status !== 'cancelado').sort((a,b) => parseISO(a.starts_at).getTime() - parseISO(b.starts_at).getTime())[0]
  const soon  = appointments.filter(a => parseISO(a.starts_at) > now && a.status !== 'cancelado').sort((a,b) => parseISO(a.starts_at).getTime() - parseISO(b.starts_at).getTime()).slice(1,5)
  const cxls  = appointments.filter(a => a.status === 'cancelado').length

  const QUICK = [
    { icon:Calendar, label:'Agenda completa',  action:() => go('agenda') },
    { icon:Users,    label:'Buscar paciente',  action:() => go('pacientes') },
    { icon:Lock,     label:'Bloquear horario', action:() => go('bloqueos') },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
      {/* Quick actions */}
      <div style={{ backgroundColor:CARD, borderRadius:'12px', padding:'16px', border:`1px solid ${BD}` }}>
        <div style={{ fontSize:'10px', fontWeight:700, color:T3, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:'10px' }}>Acciones rápidas</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
          {QUICK.map(({ icon:Icon, label, action }) => (
            <button key={label} onClick={action}
              style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px', borderRadius:'8px', border:`1px solid ${BD}`, backgroundColor:'transparent', fontSize:'12px', fontWeight:500, color:T2, cursor:'pointer', textAlign:'left', transition:'all 0.12s' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor=`${P600}08`; el.style.borderColor=`${P600}30`; el.style.color=P600 }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor='transparent'; el.style.borderColor=BD; el.style.color=T2 }}
            ><Icon size={13}/>{label}</button>
          ))}
        </div>
      </div>

      {/* Next appointment */}
      {next && (
        <div style={{ backgroundColor:CARD, borderRadius:'12px', padding:'16px', border:`1px solid ${BD}` }}>
          <div style={{ fontSize:'10px', fontWeight:700, color:T3, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:'10px' }}>Próximo turno</div>
          <div style={{ backgroundColor:`${P600}08`, borderRadius:'9px', padding:'12px', border:`1px solid ${P600}1A`, marginBottom:'10px' }}>
            <div style={{ fontSize:'11px', color:T3, marginBottom:'4px' }}>
              {isToday(parseISO(next.starts_at)) ? 'Hoy' : isTomorrow(parseISO(next.starts_at)) ? 'Mañana' : format(parseISO(next.starts_at), 'EEE d MMM', { locale:es })}
              {' · '}{argTime(next.starts_at)}hs
            </div>
            <div style={{ fontSize:'13px', fontWeight:700, color:TEXT, marginBottom:'2px' }}>{next.patient_name}</div>
            <div style={{ fontSize:'12px', color:T2 }}>{(next.service as { name:string }|undefined)?.name ?? 'Consulta'}</div>
          </div>
          <button onClick={() => onSelect(next)}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', width:'100%', padding:'9px', borderRadius:'9px', fontSize:'12px', fontWeight:600, backgroundColor:P600, color:'#fff', border:'none', cursor:'pointer' }}>
            Ver detalle <ChevronRight size={13}/>
          </button>
        </div>
      )}

      {/* Upcoming list */}
      {soon.length > 0 && (
        <div style={{ backgroundColor:CARD, borderRadius:'12px', padding:'16px', border:`1px solid ${BD}` }}>
          <div style={{ fontSize:'10px', fontWeight:700, color:T3, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:'10px' }}>Próximos turnos</div>
          <div style={{ display:'flex', flexDirection:'column' }}>
            {soon.map(a => {
              const svc = a.service as { name:string }|undefined
              return (
                <button key={a.id} onClick={() => onSelect(a)}
                  style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 4px', border:'none', borderBottom:`1px solid ${BD}`, backgroundColor:'transparent', cursor:'pointer', textAlign:'left' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor='#F8FAFC'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor='transparent'}
                >
                  <div style={{ width:'6px', height:'6px', borderRadius:'50%', backgroundColor:(ST[a.status]??ST.pendiente).dot, flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'12px', fontWeight:500, color:TEXT, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.patient_name}</div>
                    <div style={{ fontSize:'10px', color:T3 }}>
                      {isToday(parseISO(a.starts_at)) ? 'Hoy' : isTomorrow(parseISO(a.starts_at)) ? 'Mañana' : format(parseISO(a.starts_at),'d MMM',{locale:es})} · {argTime(a.starts_at)}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Cancellation alert */}
      {cxls > 0 && (
        <div style={{ borderRadius:'10px', padding:'12px 14px', backgroundColor:'#FFFBEB', border:'1px solid #FDE68A', display:'flex', gap:'10px' }}>
          <AlertCircle size={14} style={{ color:'#D97706', flexShrink:0, marginTop:'1px' }}/>
          <div>
            <div style={{ fontSize:'12px', fontWeight:600, color:'#92400E' }}>{cxls} cancelación{cxls!==1?'es':''} esta semana</div>
            <div style={{ fontSize:'11px', color:'#B45309', marginTop:'2px' }}>Contactá a esos pacientes para reprogramar.</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Appointment detail modal ──────────────────────────────────────────────────
function ApptModal({ appt, onClose, onStatus, featureHc, onShowHC, onShowST, onRescheduled }: {
  appt:Appointment; onClose:()=>void;
  onStatus:(id:string,s:string)=>void;
  featureHc:boolean; onShowHC:()=>void; onShowST:()=>void
  onRescheduled:()=>void
}) {
  const s     = ST[appt.status] ?? ST.pendiente
  const svc   = appt.service as { name:string; duration_minutes?:number }|undefined
  const pat   = appt.patient as { obra_social?:string }|undefined
  const esHoy = isToday(parseISO(appt.starts_at))
  const [showReschedule, setShowReschedule] = useState(false)

  const INFO = [
    ['Servicio',   svc?.name ?? '—'],
    ['Duración',   svc?.duration_minutes ? `${svc.duration_minutes} min` : '—'],
    ['Teléfono',   appt.patient_phone ?? '—'],
    ['Email',      appt.patient_email ?? '—'],
    ...(pat?.obra_social ? [['Obra social', pat.obra_social]] : []),
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor:'rgba(11,30,36,0.65)', backdropFilter:'blur(4px)' }}
      onClick={e => { if (e.target===e.currentTarget) onClose() }}>
      <div style={{ width:'100%', maxWidth:'440px', borderRadius:'18px', overflow:'hidden', backgroundColor:CARD, boxShadow:'0 32px 72px rgba(0,0,0,0.22)' }}>
        {/* Header */}
        <div style={{ padding:'18px 20px', backgroundColor:P800, borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
            <div>
              <div style={{ fontSize:'15px', fontWeight:700, color:'#fff', marginBottom:'3px' }}>{appt.patient_name}</div>
              <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.45)', textTransform:'capitalize' }}>
                {format(parseISO(appt.starts_at.slice(0,10)), "EEEE d 'de' MMMM", { locale:es })} · {argTime(appt.starts_at)}hs
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
              <Badge status={appt.status}/>
              <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.35)', fontSize:'20px', lineHeight:1, padding:'0 2px' }}>×</button>
            </div>
          </div>
        </div>

        {/* Info */}
        <div style={{ padding:'20px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'20px' }}>
            {INFO.map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize:'10px', fontWeight:700, color:T3, textTransform:'uppercase', letterSpacing:'0.09em', marginBottom:'3px' }}>{label}</div>
                <div style={{ fontSize:'13px', color:TEXT }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Primary action */}
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {(appt.status==='confirmado'||appt.status==='pendiente') && (
              esHoy ? (
                <button onClick={() => onStatus(appt.id,'en_atencion')}
                  style={{ width:'100%', padding:'12px', borderRadius:'10px', fontSize:'13px', fontWeight:600, backgroundColor:P600, color:'#fff', border:'none', cursor:'pointer' }}>
                  Llamar paciente
                </button>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:'7px', width:'100%', padding:'12px', borderRadius:'10px', fontSize:'12px', fontWeight:500, backgroundColor:'#FEF2F2', color:'#B91C1C', border:'1px solid #FECACA' }}>
                  <AlertCircle size={14} style={{ flexShrink:0 }}/>
                  Acción no permitida — la fecha del turno no es la de hoy
                </div>
              )
            )}
            {appt.status==='en_atencion' && (
              <button onClick={() => onStatus(appt.id,'completado')}
                style={{ width:'100%', padding:'12px', borderRadius:'10px', fontSize:'13px', fontWeight:600, backgroundColor:'#16a34a', color:'#fff', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'7px' }}>
                <CheckCircle size={15}/> Marcar como atendido
              </button>
            )}

            {/* Secondary */}
            <div style={{ display:'flex', gap:'8px' }}>
              {featureHc && (
                <button onClick={onShowHC}
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', padding:'10px', borderRadius:'10px', fontSize:'12px', fontWeight:500, backgroundColor:'transparent', color:T2, border:`1px solid ${BD}`, cursor:'pointer' }}>
                  <FileText size={13}/> Historia clínica
                </button>
              )}
              <button onClick={onShowST}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', padding:'10px', borderRadius:'10px', fontSize:'12px', fontWeight:500, backgroundColor:'#f5f3ff', color:'#7c3aed', border:'1px solid #e9d5ff', cursor:'pointer' }}>
                <Activity size={13}/> Sesión
              </button>
              {appt.patient_phone && (
                <a href={`https://wa.me/${appt.patient_phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', padding:'10px', borderRadius:'10px', fontSize:'12px', fontWeight:500, backgroundColor:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', textDecoration:'none' }}>
                  <MessageCircle size={13}/> WhatsApp
                </a>
              )}
            </div>

            {(appt.status==='confirmado'||appt.status==='pendiente') && (
              <button onClick={() => setShowReschedule(true)}
                style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', borderRadius:'10px', fontSize:'12px', fontWeight:500, backgroundColor:'#eef2ff', color:'#4338ca', border:'1px solid #e0e7ff', cursor:'pointer' }}>
                <CalendarClock size={14}/> Reprogramar turno
              </button>
            )}

            {/* No asistió: misma condición que "Llamar paciente" (solo el día del turno).
                Cancelar: disponible siempre, sin importar la fecha. */}
            <div style={{ display:'flex', gap:'8px' }}>
              {!['no_asistio','completado','cancelado'].includes(appt.status) && esHoy && (
                <button onClick={() => onStatus(appt.id,'no_asistio')}
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', padding:'10px', borderRadius:'10px', fontSize:'12px', fontWeight:500, backgroundColor:'#F9FAFB', color:'#374151', border:'1px solid #E5E7EB', cursor:'pointer' }}>
                  <UserX size={13}/> No asistió
                </button>
              )}
              {!['cancelado','completado'].includes(appt.status) && (
                <button onClick={() => { if (confirm('¿Cancelar este turno?')) onStatus(appt.id,'cancelado') }}
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', padding:'10px', borderRadius:'10px', fontSize:'12px', fontWeight:500, backgroundColor:'#FEF2F2', color:'#B91C1C', border:'1px solid #FECACA', cursor:'pointer' }}>
                  <XCircle size={13}/> Cancelar turno
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showReschedule && (
        <RescheduleModal
          appointmentId={appt.id}
          professionalId={appt.professional_id}
          serviceDurationMinutes={svc?.duration_minutes ?? 30}
          serviceId={appt.service_id}
          currentStartsAt={appt.starts_at}
          onClose={() => setShowReschedule(false)}
          onRescheduled={() => { setShowReschedule(false); onRescheduled() }}
        />
      )}
    </div>
  )
}


// ── Service donut chart (inline SVG) ─────────────────────────────────────────
const DONUT_PALETTE = [
  '#1A3F4E','#C9A96E','#3B82F6','#10B981','#8B5CF6',
  '#F59E0B','#EF4444','#06B6D4','#EC4899','#6366F1',
]

function ServiceDonut({ appointments }: { appointments: Appointment[] }) {
  const active = appointments.filter(a => a.status !== 'cancelado')
  if (active.length === 0) return null

  // Aggregate by service name
  const map: Record<string, number> = {}
  active.forEach(a => {
    const name = (a.service as { name: string } | undefined)?.name ?? 'Consulta'
    map[name] = (map[name] ?? 0) + 1
  })

  const entries = Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8) // max 8 slices for readability

  const total  = entries.reduce((s, [, v]) => s + v, 0)
  const R      = 52   // outer radius
  const r      = 30   // inner radius
  const cx     = 64
  const cy     = 64
  const SIZE   = 128

  // Build SVG arcs
  let startAngle = -Math.PI / 2
  const arcs = entries.map(([name, count], i) => {
    const pct   = count / total
    const angle = pct * 2 * Math.PI
    const end   = startAngle + angle
    const large = angle > Math.PI ? 1 : 0
    const x1o = cx + R * Math.cos(startAngle)
    const y1o = cy + R * Math.sin(startAngle)
    const x2o = cx + R * Math.cos(end)
    const y2o = cy + R * Math.sin(end)
    const x1i = cx + r * Math.cos(end)
    const y1i = cy + r * Math.sin(end)
    const x2i = cx + r * Math.cos(startAngle)
    const y2i = cy + r * Math.sin(startAngle)
    const d   = `M ${x1o} ${y1o} A ${R} ${R} 0 ${large} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${r} ${r} 0 ${large} 0 ${x2i} ${y2i} Z`
    const arc = { d, color: DONUT_PALETTE[i % DONUT_PALETTE.length], name, count, pct }
    startAngle = end
    return arc
  })

  const [hovered, setHovered] = React.useState<string | null>(null)

  return (
    <div style={{ backgroundColor: CARD, borderRadius: '12px', padding: '18px 20px', border: `1px solid ${BD}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: TEXT }}>Distribución de servicios</div>
          <div style={{ fontSize: '11px', color: T3, marginTop: '2px' }}>Semana actual · {total} turno{total !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        {/* SVG donut */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ overflow: 'visible' }}>
            {arcs.map((arc, i) => (
              <path
                key={arc.name}
                d={arc.d}
                fill={arc.color}
                opacity={hovered === null || hovered === arc.name ? 1 : 0.25}
                style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                onMouseEnter={() => setHovered(arc.name)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
            {/* Center label */}
            <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: '18px', fontWeight: 700, fill: TEXT, fontFamily: 'Inter, sans-serif' }}>
              {hovered
                ? `${Math.round((arcs.find(a => a.name === hovered)?.pct ?? 0) * 100)}%`
                : total
              }
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" style={{ fontSize: '9px', fill: T3, fontFamily: 'Inter, sans-serif' }}>
              {hovered ? arcs.find(a => a.name === hovered)?.name.slice(0, 10) : 'turnos'}
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px' }}>
          {arcs.map(arc => (
            <div key={arc.name}
              onMouseEnter={() => setHovered(arc.name)}
              onMouseLeave={() => setHovered(null)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default', opacity: hovered === null || hovered === arc.name ? 1 : 0.4, transition: 'opacity 0.15s' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: arc.color, flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: TEXT, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{arc.name}</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: T2, flexShrink: 0 }}>
                {Math.round(arc.pct * 100)}%
              </span>
              <span style={{ fontSize: '10px', color: T3, flexShrink: 0 }}>({arc.count})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Dashboard view ────────────────────────────────────────────────────────────
function DashView({ appointments, today, tomorrow, loading, go, onSelect, profile }: {
  appointments:Appointment[]; today:Appointment[]; tomorrow:Appointment[];
  loading:boolean; go:(v:View)=>void; onSelect:(a:Appointment)=>void; profile:any
}) {
  const now       = new Date()
  const wkStart   = startOfWeek(now, { weekStartsOn:1 })
  const wkEnd     = endOfWeek(now, { weekStartsOn:1 })
  const wkAppts   = appointments.filter(a => { const d=parseISO(a.starts_at); return d>=wkStart && d<=wkEnd && a.status!=='cancelado' })
  const pending   = appointments.filter(a => a.status==='pendiente').length
  const nextAppt  = appointments.filter(a => parseISO(a.starts_at)>now && a.status!=='cancelado').sort((a,b)=>parseISO(a.starts_at).getTime()-parseISO(b.starts_at).getTime())[0]
  const occupancy = Math.min(100, Math.round((wkAppts.length / Math.max(wkAppts.length+8, 20)) * 100))
  const greeting  = now.getHours() < 13 ? 'Buenos días' : now.getHours() < 20 ? 'Buenas tardes' : 'Buenas noches'
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Profesional'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'18px' }}>

      {/* Welcome banner */}
      <div style={{ borderRadius:'14px', padding:'22px 26px', background:`linear-gradient(130deg, ${P900} 0%, ${P600} 100%)`, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'-24px', right:'-24px', width:'130px', height:'130px', borderRadius:'50%', backgroundColor:'rgba(255,255,255,0.04)' }}/>
        <div style={{ position:'absolute', bottom:'-20px', right:'80px', width:'70px', height:'70px', borderRadius:'50%', backgroundColor:'rgba(255,255,255,0.03)' }}/>
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ fontSize:'11px', fontWeight:500, color:`${GOLD}BB`, marginBottom:'4px', letterSpacing:'0.04em' }}>{greeting}</div>
          <div style={{ fontSize:'22px', fontWeight:700, color:'#fff', marginBottom:'6px', lineHeight:1.2 }}>{firstName}</div>
          <div style={{ fontSize:'13px', color:'rgba(255,255,255,0.55)', marginBottom:'18px' }}>
            {wkAppts.length > 0
              ? `${wkAppts.length} turno${wkAppts.length!==1?'s':''} esta semana${nextAppt ? ` · próximo: ${argTime(nextAppt.starts_at)}hs` : ''}`
              : 'Sin turnos programados esta semana'}
          </div>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            <button onClick={() => go('agenda')}
              style={{ display:'flex', alignItems:'center', gap:'6px', padding:'9px 18px', borderRadius:'8px', fontSize:'12px', fontWeight:600, backgroundColor:GOLD, color:P900, border:'none', cursor:'pointer' }}>
              Ver agenda completa <ArrowRight size={12}/>
            </button>
            <button onClick={() => go('pacientes')}
              style={{ display:'flex', alignItems:'center', gap:'6px', padding:'9px 16px', borderRadius:'8px', fontSize:'12px', fontWeight:500, backgroundColor:'rgba(255,255,255,0.1)', color:'#fff', border:'1px solid rgba(255,255,255,0.15)', cursor:'pointer' }}>
              <Search size={12}/> Buscar paciente
            </button>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px,1fr))', gap:'10px' }}>
        <Metric icon={Calendar}    label="Turnos hoy"   value={today.length}         sub={today.length===0?'Sin actividad':undefined}    accent={P600}    loading={loading}/>
        <Metric icon={Clock}       label="Esta semana"  value={wkAppts.length}        sub="turnos programados"                            accent={P600}    loading={loading}/>
        <Metric icon={AlertCircle} label="Pendientes"   value={pending}               sub={pending>0?'Requieren atención':'Al día'}        accent="#D97706" loading={loading}/>
        <Metric icon={TrendingUp}  label="Ocupación"    value={`${occupancy}%`}       sub="de agenda semanal"                             accent={GOLD}    loading={loading}/>
      </div>

      {/* Today's agenda */}
      <div style={{ backgroundColor:CARD, borderRadius:'12px', border:`1px solid ${BD}`, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:`1px solid ${BD}` }}>
          <div>
            <div style={{ fontSize:'13px', fontWeight:600, color:TEXT }}>Agenda de hoy</div>
            <div style={{ fontSize:'11px', color:T3, marginTop:'1px', textTransform:'capitalize' }}>
              {format(now, "EEEE d 'de' MMMM", { locale:es })}
            </div>
          </div>
          <button onClick={() => go('agenda')} style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', fontWeight:500, color:P600, background:'none', border:'none', cursor:'pointer' }}>
            Ver todo <ArrowRight size={12}/>
          </button>
        </div>
        <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:'8px' }}>
          {loading
            ? [1,2,3].map(i => <div key={i} style={{ height:'64px', borderRadius:'9px', backgroundColor:BG, border:`1px solid ${BD}` }}/>)
            : today.length === 0
              ? <Empty go={go}/>
              : today.map(a => <ApptCard key={a.id} appt={a} onClick={() => onSelect(a)}/>)
          }
        </div>
      </div>

      {/* Weekly chart */}
      <WeekChart appointments={appointments}/>

      {/* Service donut */}
      <ServiceDonut appointments={wkAppts}/>

      {/* Tomorrow preview */}
      {tomorrow.length > 0 && (
        <div style={{ backgroundColor:CARD, borderRadius:'12px', border:`1px solid ${BD}`, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:`1px solid ${BD}` }}>
            <div style={{ fontSize:'13px', fontWeight:600, color:TEXT }}>Mañana</div>
            <span style={{ fontSize:'11px', color:T3 }}>{tomorrow.length} turno{tomorrow.length!==1?'s':''}</span>
          </div>
          <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:'8px' }}>
            {tomorrow.slice(0,3).map(a => <ApptCard key={a.id} appt={a} onClick={() => onSelect(a)}/>)}
            {tomorrow.length > 3 && (
              <button onClick={() => go('agenda')} style={{ fontSize:'12px', color:P600, background:'none', border:'none', cursor:'pointer', padding:'8px', textAlign:'center' }}>
                +{tomorrow.length-3} más — Ver agenda completa
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Agenda view ───────────────────────────────────────────────────────────────
function AgendaView({ appointments, today, tomorrow, upcoming, loading, onSelect, calendar, setCalendar, week, setWeek }: {
  appointments:Appointment[]; today:Appointment[]; tomorrow:Appointment[]; upcoming:Appointment[];
  loading:boolean; onSelect:(a:Appointment)=>void;
  calendar:boolean; setCalendar:(v:boolean)=>void;
  week:Date; setWeek:(d:Date)=>void
}) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <h2 style={{ fontSize:'16px', fontWeight:700, color:TEXT, margin:0 }}>Mi agenda</h2>
        <div style={{ display:'flex', gap:'5px' }}>
          {(['Lista','Calendario'] as const).map((lbl,i) => {
            const active = (i===1) === calendar
            return (
              <button key={lbl} onClick={() => setCalendar(i===1)}
                style={{ padding:'6px 12px', borderRadius:'8px', fontSize:'12px', fontWeight:500, backgroundColor: active ? P600 : 'transparent', color: active ? '#fff' : T2, border:`1px solid ${active ? P600 : BD}`, cursor:'pointer' }}>
                {lbl}
              </button>
            )
          })}
        </div>
      </div>
      {calendar
        ? <WeekCalendar appointments={appointments} currentWeek={week} onWeekChange={setWeek} onSelect={onSelect}/>
        : (
          <>
            <Section title="Hoy" count={today.length} empty="Sin turnos para hoy">
              {today.map(a => <ApptCard key={a.id} appt={a} onClick={() => onSelect(a)}/>)}
            </Section>
            {tomorrow.length > 0 && (
              <Section title="Mañana" count={tomorrow.length}>
                {tomorrow.map(a => <ApptCard key={a.id} appt={a} onClick={() => onSelect(a)}/>)}
              </Section>
            )}
            {upcoming.length > 0 && (
              <Section title="Próximos días" count={upcoming.length}>
                {upcoming.map(a => <ApptCard key={a.id} appt={a} onClick={() => onSelect(a)}/>)}
              </Section>
            )}
          </>
        )
      }
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function MedicoDashboard() {
  const [user, setUser]       = useState<User|null>(null)
  const [authLoading, setAL]  = useState(true)
  const [appointments, setAppts] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSel]    = useState<Appointment|null>(null)
  const [showHC, setShowHC]   = useState(false)
  const [showST, setShowST]   = useState(false)
  const [view, setView]       = useState<View>('dashboard')
  const [calendar, setCal]    = useState(false)
  const [week, setWeek]       = useState(new Date())
  const [drawer, setDrawer]   = useState(false)
  const navigate = useNavigate()

  const { profile, loading:profileLoading } = useProfile(user)
  const [orgId, setOrgId]   = useState<string|null>(null)
  const [tenant, setTenant] = useState('medical')
  const [consultorio, setConsultorio] = useState<string|null>(null)

  useEffect(() => {
    if (!profile?.professional_id) return
    supabase.from('professionals').select('organization_id, consultorio, organizations(tenant_type)').eq('id', profile.professional_id).single()
      .then(({ data }) => {
        setOrgId(data?.organization_id ?? null)
        setTenant((data?.organizations as any)?.tenant_type ?? 'medical')
        setConsultorio(data?.consultorio ?? null)
      })
  }, [profile?.professional_id])

  const { featureHc } = useOrgFeatures(orgId)

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session } }) => { setUser(session?.user ?? null); setAL(false) })
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_,s) => setUser(s?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user && !authLoading) { navigate('/', { replace:true }); return }
    if (!profile) return
    if (['admin','superadmin'].includes(profile.role)) navigate('/admin', { replace:true })
    if (profile.role === 'recepcion') navigate('/recepcion', { replace:true })
  }, [user, authLoading, profile])

  const loadAppts = async () => {
    if (!profile?.professional_id) return
    const wkStart = startOfWeek(new Date(), { weekStartsOn:1 })
    const { data } = await supabase.from('appointments')
      .select('*, services(name, color, duration_minutes), patients(id, full_name, phone, email, obra_social)')
      .eq('professional_id', profile.professional_id)
      .gte('starts_at', startOfDay(wkStart).toISOString())
      .lte('starts_at', endOfDay(addDays(wkStart, 27)).toISOString())
      .order('starts_at')
    const fresh = (data ?? []).map((r:any) => ({ ...r, service:r.services, patient:r.patients })) as Appointment[]
    setAppts(fresh)
    setLoading(false)
    // Si hay un turno abierto en el modal, lo actualiza con los datos frescos
    // (o lo cierra si ya no existe / fue cancelado por otro lado).
    setSel(p => {
      if (!p) return p
      const match = fresh.find(a => a.id === p.id)
      return match ?? null
    })
  }

  useEffect(() => { loadAppts() }, [profile?.professional_id])

  useEffect(() => {
    if (!profile?.professional_id) return
    // Escucha inserciones, actualizaciones y bajas de turnos de este profesional.
    // Se vuelve a pedir la lista completa (con relaciones) en cada cambio: así un turno
    // nuevo cargado desde otro dispositivo aparece solo, sin recargar la página.
    const ch = supabase.channel(`medico-${profile.professional_id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'appointments', filter:`professional_id=eq.${profile.professional_id}` },
        () => { loadAppts() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile?.professional_id])

  if (authLoading || profileLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor:P800 }}>
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor:GOLD }}/>
    </div>
  )
  if (!user) return null

  const active   = appointments.filter(a => a.status !== 'cancelado')
  const today    = active.filter(a => isToday(parseISO(a.starts_at)))
  const tomorrow = active.filter(a => isTomorrow(parseISO(a.starts_at)))
  const upcoming = active.filter(a => !isToday(parseISO(a.starts_at)) && !isTomorrow(parseISO(a.starts_at)))
  const logout   = () => supabase.auth.signOut()
  const go       = (v: View) => { setView(v); setDrawer(false) }

  const changeStatus = async (id:string, status:string) => {
    await supabase.from('appointments').update({ status }).eq('id', id)
    setAppts(p => p.map(a => a.id===id ? { ...a, status:status as any } : a))
    setSel(p => p?.id===id ? { ...p, status:status as any } : p)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor:BG }}>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-[220px] z-20" style={{ boxShadow:'2px 0 16px rgba(0,0,0,0.14)' }}>
        <Sidebar view={view} go={go} profile={profile} logout={logout}/>
      </aside>

      {/* ── Mobile overlay + drawer ── */}
      {drawer && <div className="fixed inset-0 z-30 lg:hidden" style={{ backgroundColor:'rgba(0,0,0,0.5)' }} onClick={() => setDrawer(false)}/>}
      <aside className="fixed inset-y-0 left-0 w-[260px] z-40 lg:hidden"
        style={{ transform: drawer ? 'translateX(0)' : 'translateX(-100%)', transition:'transform 0.25s cubic-bezier(0.4,0,0.2,1)', boxShadow:'4px 0 24px rgba(0,0,0,0.25)' }}>
        <Sidebar view={view} go={go} profile={profile} logout={logout} close={() => setDrawer(false)}/>
      </aside>

      {/* ── Content ── */}
      <div className="lg:pl-[220px]">

        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-10 flex items-center justify-between px-4 py-3"
          style={{ backgroundColor:P800, borderBottom:'1px solid rgba(255,255,255,0.06)', boxShadow:'0 1px 10px rgba(0,0,0,0.2)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setDrawer(true)} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.5)', padding:'2px' }}><Menu size={20}/></button>
            <Wordmark/>
          </div>
          <div style={{ fontSize:'11px', fontWeight:500, color:'rgba(255,255,255,0.6)' }}>{profile?.full_name?.split(' ')[0]}</div>
        </header>

        {/* Desktop header */}
        <header className="hidden lg:flex sticky top-0 z-10 items-center justify-between px-7 py-3"
          style={{ backgroundColor:CARD, borderBottom:`1px solid ${BD}`, boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
          <div>
            <div style={{ fontSize:'13px', fontWeight:600, color:TEXT }}>{profile?.full_name ?? '—'}</div>
            <div style={{ fontSize:'11px', color:T3, textTransform:'capitalize' }}>
              {format(new Date(), "EEEE d 'de' MMMM", { locale:es })} · Profesional
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'5px 12px', borderRadius:'999px', backgroundColor:'#f0fdf4', border:'1px solid #bbf7d0' }}>
              <span style={{ width:'7px', height:'7px', borderRadius:'50%', backgroundColor:'#22c55e' }}/>
              <span style={{ fontSize:'11px', fontWeight:500, color:'#166534' }}>
                {consultorio ? `Consultorio ${consultorio}` : 'Consultorio activo'}
              </span>
            </div>
            <button onClick={logout}
              style={{ display:'flex', alignItems:'center', gap:'6px', padding:'7px 14px', borderRadius:'8px', border:`1px solid ${BD}`, backgroundColor:'transparent', fontSize:'12px', fontWeight:500, color:T2, cursor:'pointer' }}
              onMouseEnter={e => { const el=e.currentTarget as HTMLElement; el.style.borderColor='#fca5a5'; el.style.color='#dc2626'; el.style.backgroundColor='#fef2f2' }}
              onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.borderColor=BD; el.style.color=T2; el.style.backgroundColor='transparent' }}>
              <LogOut size={13}/> Salir
            </button>
          </div>
        </header>

        {/* Main grid (content + right panel) */}
        <div className="xl:grid xl:grid-cols-[1fr_272px]" style={{ minHeight:'calc(100vh - 56px)' }}>

          {/* Content */}
          <main style={{ padding:'22px 22px 96px', maxWidth:'860px' }}>
            {view === 'dashboard' && (
              <DashView appointments={appointments} today={today} tomorrow={tomorrow} loading={loading} go={go} onSelect={setSel} profile={profile}/>
            )}
            {view === 'agenda' && (
              <AgendaView appointments={appointments} today={today} tomorrow={tomorrow} upcoming={upcoming} loading={loading} onSelect={setSel} calendar={calendar} setCalendar={setCal} week={week} setWeek={setWeek}/>
            )}
            {view === 'pacientes' && (
              <div>
                <h2 style={{ fontSize:'16px', fontWeight:700, color:TEXT, margin:'0 0 20px' }}>
                  {tenant === 'cancha' ? 'Reservas' : ['medical','estetica'].includes(tenant) ? 'Pacientes' : 'Clientes'}
                </h2>
                <PatientSearch orgId={orgId} professionalId={profile?.professional_id ?? null}/>
              </div>
            )}
            {view === 'bloqueos' && profile?.professional_id && (
              <div>
                <h2 style={{ fontSize:'16px', fontWeight:700, color:TEXT, margin:'0 0 20px' }}>Disponibilidad</h2>
                <MiHorarios professionalId={profile.professional_id}/>
                <h3 style={{ fontSize:'13px', fontWeight:700, color:T2, textTransform:'uppercase', letterSpacing:'0.06em', margin:'24px 0 12px' }}>Bloqueos puntuales</h3>
                <MiAgendaBloqueos professionalId={profile.professional_id}/>
              </div>
            )}
          </main>

          {/* Right panel — xl+ only */}
          <aside className="hidden xl:block border-l py-5 px-4 overflow-y-auto"
            style={{ borderColor:BD, backgroundColor:'#F8FAFB', minHeight:'100%' }}>
            <RightPanel appointments={appointments} onSelect={setSel} go={go}/>
          </aside>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 flex items-center justify-around px-1 py-1.5"
        style={{ backgroundColor:CARD, borderTop:`1px solid ${BD}`, boxShadow:'0 -4px 20px rgba(0,0,0,0.08)' }}>
        {NAV_ITEMS.map(({ id, icon:Icon, label }) => {
          const active = view === id
          return (
            <button key={id} onClick={() => go(id as View)}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', padding:'6px 10px', borderRadius:'10px', backgroundColor: active ? `${P600}10` : 'transparent', border:'none', cursor:'pointer' }}>
              <Icon size={19} style={{ color: active ? P600 : T3 }}/>
              <span style={{ fontSize:'9px', fontWeight: active ? 600 : 400, color: active ? P600 : T3 }}>{label.split(' ')[0]}</span>
            </button>
          )
        })}
      </nav>

      {/* Modals */}
      {selected && !showHC && (
        <ApptModal appt={selected} onClose={() => setSel(null)} onStatus={changeStatus} featureHc={featureHc} onShowHC={() => setShowHC(true)} onShowST={() => setShowST(true)} onRescheduled={() => setSel(null)}/>
      )}
      {selected && showHC && profile?.professional_id && (
        <ClinicalRecordModal
          appointmentId={selected.id}
          patientId={(selected.patient as any)?.id ?? null}
          professionalId={profile.professional_id}
          organizationId={selected.organization_id}
          patientName={selected.patient_name}
          specialty={(profile as any).specialty ?? null}
          onClose={() => setShowHC(false)}
        />
      )}
      {selected && showST && (
        <SessionTreatmentsModal
          appointmentId={selected.id}
          organizationId={selected.organization_id}
          patientName={selected.patient_name}
          readOnly={false}
          onClose={() => setShowST(false)}
        />
      )}
    </div>
  )
}
