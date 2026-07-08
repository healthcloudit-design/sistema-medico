import { useEffect, useState } from 'react'
import {
  Calendar, CheckCircle, XCircle, Clock, TrendingUp,
  ArrowRight, Banknote, Activity,
} from 'lucide-react'
import { format, startOfWeek, endOfWeek, addDays, isSameDay, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import type { Appointment } from '../../types'
import { PA } from './AdminLayout'

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  confirmado:  { label: 'Confirmado',  color: '#166534', bg: '#f0fdf4', dot: '#22c55e' },
  pendiente:   { label: 'Pendiente',   color: '#d97706', bg: '#fffbeb', dot: '#f59e0b' },
  cancelado:   { label: 'Cancelado',   color: '#dc2626', bg: '#fef2f2', dot: '#ef4444' },
  no_asistio:  { label: 'No asistió',  color: '#6b7280', bg: '#f9fafb', dot: '#9ca3af' },
  completado:  { label: 'Completado',  color: '#2563eb', bg: '#eff6ff', dot: '#3b82f6' },
  en_atencion: { label: 'En atención', color: '#7c3aed', bg: '#f5f3ff', dot: '#8b5cf6' },
}

function toArgTime(iso: string) {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d  = new Date(ms)
  return `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')}`
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, accent, loading, sub }: {
  icon: React.ElementType; label: string; value: number | string
  accent: string; loading: boolean; sub?: string
}) {
  return (
    <div style={{ backgroundColor: PA.CARD, borderRadius: '12px', border: `1px solid ${PA.BORDER_LIGHT}`, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ width: '42px', height: '42px', borderRadius: '10px', flexShrink: 0, backgroundColor: `${accent}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} style={{ color: accent }} />
      </div>
      <div>
        {loading
          ? <div style={{ width: '40px', height: '26px', borderRadius: '6px', backgroundColor: '#f3f4f6', marginBottom: '4px' }} />
          : <div style={{ fontSize: '24px', fontWeight: 700, color: PA.TEXT, lineHeight: 1 }}>{value}</div>
        }
        <div style={{ fontSize: '12px', color: PA.TEXT_SEC, marginTop: '3px' }}>{label}</div>
        {sub && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{sub}</div>}
      </div>
    </div>
  )
}

// ── Weekly chart ──────────────────────────────────────────────────────────────
function WeekChart({ weekAppts }: { weekAppts: Appointment[] }) {
  const DAYS    = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
  const ws      = startOfWeek(new Date(), { weekStartsOn: 1 })
  const counts  = DAYS.map((_, i) => weekAppts.filter(a => isSameDay(parseISO(a.starts_at), addDays(ws, i)) && a.status !== 'cancelado').length)
  const max     = Math.max(...counts, 1)
  const todayI  = (new Date().getDay() + 6) % 7

  return (
    <div style={{ backgroundColor: PA.CARD, borderRadius: '12px', border: `1px solid ${PA.BORDER_LIGHT}`, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: PA.TEXT }}>Ocupación semanal</div>
          <div style={{ fontSize: '11px', color: PA.TEXT_SEC, marginTop: '2px' }}>
            Turnos activos por día · semana actual
          </div>
        </div>
        <Activity size={15} style={{ color: PA.TEXT_SEC, marginTop: '2px' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '80px' }}>
        {counts.map((n, i) => {
          const h   = Math.max((n / max) * 64, n > 0 ? 10 : 2)
          const act = i === todayI
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '10px', fontWeight: act ? 700 : 400, color: act ? PA.GOLD : (n > 0 ? PA.P600 : PA.TEXT_SEC) }}>{n > 0 ? n : ''}</span>
              <div style={{ width: '100%', borderRadius: '4px 4px 0 0', height: `${h}px`, backgroundColor: act ? PA.GOLD : (n > 0 ? PA.P600 : PA.BORDER_LIGHT), transition: 'height 0.3s ease' }} />
              <span style={{ fontSize: '10px', fontWeight: act ? 600 : 400, color: act ? PA.GOLD : PA.TEXT_SEC }}>{DAYS[i]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
interface Props {
  organizationId?: string | null
  isSuperAdmin?: boolean
}

export function Dashboard({ organizationId, isSuperAdmin }: Props) {
  const [appointments,  setAppts]  = useState<Appointment[]>([])
  const [weekAppts,     setWeek]   = useState<Appointment[]>([])
  const [loading, setLoading]      = useState(true)

  useEffect(() => {
    const today    = format(new Date(), 'yyyy-MM-dd')
    const dayStart = `${today}T00:00:00-03:00`
    const dayEnd   = `${today}T23:59:59-03:00`

    let q = supabase.from('appointments')
      .select('*, professionals(full_name,specialty), services(name,color), patients(full_name,phone)')
      .gte('starts_at', dayStart)
      .lte('starts_at', dayEnd)
      .order('starts_at')

    // scope to org for non-superadmin or when an org is selected
    if (organizationId && !isSuperAdmin) {
      q = q.eq('organization_id', organizationId)
    } else if (organizationId) {
      q = q.eq('organization_id', organizationId)
    }

    q.then(({ data }) => {
      setAppts((data ?? []).map((r: Record<string,unknown>) => ({
        ...r, professional: r.professionals, service: r.services, patient: r.patients,
      })) as Appointment[])
      setLoading(false)
    })
  }, [organizationId, isSuperAdmin])

  useEffect(() => {
    const ws   = startOfWeek(new Date(), { weekStartsOn: 1 })
    const we   = endOfWeek(new Date(),   { weekStartsOn: 1 })
    let q = supabase.from('appointments')
      .select('starts_at, status, organization_id')
      .gte('starts_at', ws.toISOString())
      .lte('starts_at', we.toISOString())
    if (organizationId) q = q.eq('organization_id', organizationId)
    q.then(({ data }) => setWeek((data ?? []) as any))
  }, [organizationId])

  const total       = appointments.length
  const confirmados = appointments.filter(a => a.status === 'confirmado').length
  const pendientes  = appointments.filter(a => a.status === 'pendiente').length
  const cancelados  = appointments.filter(a => a.status === 'cancelado').length
  const sinCobrar   = appointments.filter(a =>
    !a.payment_status || a.payment_status === 'pendiente_pago' || a.payment_status === 'pendiente'
  ).length

  const wkTotal     = weekAppts.filter(a => a.status !== 'cancelado').length
  const wkCancelados= weekAppts.filter(a => a.status === 'cancelado').length
  const occupancy   = Math.min(100, Math.round((wkTotal / Math.max(wkTotal + 10, 20)) * 100))

  const todayLabel  = format(new Date(), "EEEE d 'de' MMMM", { locale: es })

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{ width: '4px', height: '20px', borderRadius: '2px', background: `linear-gradient(to bottom, ${PA.GOLD}, ${PA.P600})`, flexShrink: 0 }} />
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: PA.TEXT, margin: 0 }}>Dashboard</h1>
        </div>
        <p style={{ fontSize: '13px', color: PA.TEXT_SEC, textTransform: 'capitalize', marginLeft: '12px', marginBottom: 0 }}>
          {todayLabel}{isSuperAdmin && !organizationId ? ' · Vista global' : ''}
        </p>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <StatCard icon={Calendar}    label="Turnos hoy"   value={total}       accent={PA.P600}   loading={loading}/>
        <StatCard icon={CheckCircle} label="Confirmados"  value={confirmados} accent="#16a34a"   loading={loading}/>
        <StatCard icon={Clock}       label="Pendientes"   value={pendientes}  accent="#d97706"   loading={loading}/>
        <StatCard icon={XCircle}     label="Cancelados"   value={cancelados}  accent="#dc2626"   loading={loading}/>
        <StatCard icon={Banknote}    label="Sin cobrar"   value={sinCobrar}   accent="#7c3aed"   loading={loading} sub="hoy"/>
        <StatCard icon={TrendingUp}  label="Ocupación"    value={`${occupancy}%`} accent={PA.GOLD} loading={loading} sub="esta semana"/>
      </div>

      {/* Weekly chart */}
      <WeekChart weekAppts={weekAppts}/>

      {/* Appointment list */}
      <div style={{ backgroundColor: PA.CARD, borderRadius: '12px', border: `1px solid ${PA.BORDER_LIGHT}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${PA.BORDER_LIGHT}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '14px', fontWeight: 600, color: PA.TEXT }}>Turnos de hoy</span>
            {!loading && <span style={{ fontSize: '12px', color: PA.TEXT_SEC, marginLeft: '8px' }}>{total} total</span>}
          </div>
          {wkCancelados > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '999px', padding: '3px 10px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#ef4444' }}/>
              {wkCancelados} cancelación{wkCancelados !== 1 ? 'es' : ''} esta semana
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[1,2,3,4].map(i => <div key={i} style={{ height: '52px', borderRadius: '8px', backgroundColor: '#f9fafb' }}/>)}
          </div>
        ) : appointments.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
              <Calendar size={20} style={{ color: '#9ca3af' }}/>
            </div>
            <p style={{ fontSize: '13px', color: PA.TEXT_SEC, margin: 0 }}>Sin turnos para hoy</p>
          </div>
        ) : (
          appointments.map((a, idx) => {
            const prof = a.professional as { full_name: string }|undefined
            const svc  = a.service      as { name: string }|undefined
            const cfg  = STATUS[a.status] ?? STATUS.pendiente
            const pay  = a.payment_status
            const payPending = !pay || pay === 'pendiente_pago' || pay === 'pendiente'
            return (
              <div key={a.id}
                style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 20px', borderBottom: idx < appointments.length-1 ? `1px solid ${PA.BORDER_LIGHT}` : 'none', transition: 'background-color 0.1s', cursor: 'default' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#f9fafb'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
              >
                <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: PA.TEXT, width: '42px', flexShrink: 0 }}>
                  {toArgTime(a.starts_at)}
                </div>
                <div style={{ width: '3px', height: '28px', borderRadius: '2px', backgroundColor: cfg.dot, flexShrink: 0 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: PA.TEXT }}>{a.patient_name}</div>
                  <div style={{ fontSize: '11px', color: PA.TEXT_SEC, marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[svc?.name, prof?.full_name].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '999px', backgroundColor: cfg.bg, color: cfg.color }}>
                    {cfg.label}
                  </span>
                  {payPending && (
                    <span style={{ fontSize: '10px', fontWeight: 500, padding: '1px 6px', borderRadius: '999px', backgroundColor: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>
                      Sin cobrar
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <button style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, color: PA.P600, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.8 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}>
          Ver todos los turnos <ArrowRight size={13}/>
        </button>
      </div>
    </div>
  )
}
