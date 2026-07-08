import { useEffect, useState } from 'react'
import { Calendar, CheckCircle, XCircle, Clock, TrendingUp, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import type { Appointment } from '../../types'
import { PA } from './AdminLayout'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  confirmado: { label: 'Confirmado', color: '#16a34a', bg: '#f0fdf4' },
  pendiente:  { label: 'Pendiente',  color: '#d97706', bg: '#fffbeb' },
  cancelado:  { label: 'Cancelado',  color: '#dc2626', bg: '#fef2f2' },
  no_asistio: { label: 'No asistió', color: '#6b7280', bg: '#f9fafb' },
  completado: { label: 'Completado', color: '#2563eb', bg: '#eff6ff' },
  en_atencion:{ label: 'En atención', color: '#7c3aed', bg: '#f5f3ff' },
}

function toArgTime(iso: string) {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d = new Date(ms)
  return `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')}`
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, accent, loading }: {
  icon: React.ElementType; label: string; value: number; accent: string; loading: boolean
}) {
  return (
    <div style={{
      backgroundColor: PA.CARD, borderRadius: '12px',
      border: `1px solid ${PA.BORDER_LIGHT}`, padding: '20px 22px',
      display: 'flex', alignItems: 'center', gap: '14px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{
        width: '42px', height: '42px', borderRadius: '10px', flexShrink: 0,
        backgroundColor: `${accent}14`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={20} style={{ color: accent }} />
      </div>
      <div>
        {loading ? (
          <div style={{ width: '40px', height: '28px', borderRadius: '6px', backgroundColor: '#f3f4f6', marginBottom: '4px' }} />
        ) : (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '26px', fontWeight: 700, color: PA.TEXT, lineHeight: 1 }}>
            {value}
          </div>
        )}
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: PA.TEXT_SEC, marginTop: '3px', fontWeight: 400 }}>
          {label}
        </div>
      </div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
      <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: '15px', fontWeight: 600, color: PA.TEXT, margin: 0 }}>
        {title}
      </h2>
      {sub && <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: PA.TEXT_SEC }}>{sub}</span>}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export function Dashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [stats, setStats] = useState({ total: 0, confirmados: 0, cancelados: 0, pendientes: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today    = format(new Date(), 'yyyy-MM-dd')
    const dayStart = `${today}T00:00:00-03:00`
    const dayEnd   = `${today}T23:59:59-03:00`

    supabase.from('appointments')
      .select('*, professionals(full_name, specialty), services(name, color), patients(full_name, phone)')
      .gte('starts_at', dayStart)
      .lte('starts_at', dayEnd)
      .order('starts_at')
      .then(({ data }) => {
        const appts = (data ?? []).map((r: Record<string, unknown>) => ({
          ...r,
          professional: r.professionals,
          service:      r.services,
          patient:      r.patients,
        })) as Appointment[]
        setAppointments(appts)
        setStats({
          total:       appts.length,
          confirmados: appts.filter(a => a.status === 'confirmado').length,
          cancelados:  appts.filter(a => a.status === 'cancelado').length,
          pendientes:  appts.filter(a => a.status === 'pendiente').length,
        })
        setLoading(false)
      })
  }, [])

  const todayLabel = format(new Date(), "EEEE d 'de' MMMM", { locale: es })

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{
            width: '4px', height: '20px', borderRadius: '2px',
            background: `linear-gradient(to bottom, ${PA.GOLD}, ${PA.P600})`,
            flexShrink: 0,
          }} />
          <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: '20px', fontWeight: 700, color: PA.TEXT, margin: 0 }}>
            Dashboard
          </h1>
        </div>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: PA.TEXT_SEC, textTransform: 'capitalize', marginLeft: '12px' }}>
          {todayLabel}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        <StatCard icon={Calendar}    label="Turnos hoy"  value={stats.total}       accent={PA.P600}    loading={loading} />
        <StatCard icon={CheckCircle} label="Confirmados" value={stats.confirmados}  accent="#16a34a"    loading={loading} />
        <StatCard icon={Clock}       label="Pendientes"  value={stats.pendientes}   accent="#d97706"    loading={loading} />
        <StatCard icon={XCircle}     label="Cancelados"  value={stats.cancelados}   accent="#dc2626"    loading={loading} />
      </div>

      {/* Appointment table */}
      <div style={{ backgroundColor: PA.CARD, borderRadius: '12px', border: `1px solid ${PA.BORDER_LIGHT}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${PA.BORDER_LIGHT}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <SectionHeader title="Turnos de hoy" sub={`${stats.total} total`} />
        </div>

        {loading ? (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ height: '56px', borderRadius: '8px', backgroundColor: '#f9fafb', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div style={{ padding: '56px 20px', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <Calendar size={22} style={{ color: '#9ca3af' }} />
            </div>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', color: PA.TEXT_SEC, margin: 0 }}>
              Sin turnos para hoy
            </p>
          </div>
        ) : (
          <div>
            {appointments.map((a, idx) => {
              const professional = a.professional as { full_name: string; specialty?: string } | undefined
              const service      = a.service      as { name: string } | undefined
              const cfg          = STATUS[a.status] ?? STATUS.pendiente

              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  padding: '13px 20px',
                  borderBottom: idx < appointments.length - 1 ? `1px solid ${PA.BORDER_LIGHT}` : 'none',
                  transition: 'background-color 0.12s',
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#f9fafb'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                >
                  {/* Time */}
                  <div style={{
                    fontFamily: "'Inter', sans-serif", fontSize: '13px',
                    fontWeight: 600, color: PA.TEXT, letterSpacing: '0.01em',
                    width: '42px', flexShrink: 0,
                  }}>
                    {toArgTime(a.starts_at)}
                  </div>

                  {/* Status dot */}
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    backgroundColor: cfg.color, flexShrink: 0,
                  }} />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 500, color: PA.TEXT }}>
                      {a.patient_name}
                    </div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: PA.TEXT_SEC, marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[service?.name, professional?.full_name].filter(Boolean).join(' · ')}
                    </div>
                  </div>

                  {/* Status badge */}
                  <span style={{
                    fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 500,
                    padding: '3px 10px', borderRadius: '999px', flexShrink: 0,
                    backgroundColor: cfg.bg, color: cfg.color,
                  }}>
                    {cfg.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick stats row — for later extension */}
      <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <button
          onClick={() => {/* navigate to appointments */}}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 500,
            color: PA.P600, background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px 0', opacity: 0.8,
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
        >
          Ver todos los turnos <ArrowRight size={13} />
        </button>
      </div>
    </div>
  )
}
