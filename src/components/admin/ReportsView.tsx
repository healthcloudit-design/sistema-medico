import { useEffect, useState } from 'react'
import {
  TrendingUp, Users, CalendarCheck, XCircle, Clock, Award,
  Download, Building2, BarChart2, LineChart as LineChartIcon
} from 'lucide-react'
import { subDays, startOfDay, endOfDay, format, eachDayOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend
} from 'recharts'
import { supabase } from '../../lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────
interface RawAppointment {
  status: string
  starts_at: string
  professionals: { full_name: string; organization_id?: string } | null
  services: { name: string } | null
  organizations: { id: string; name: string; primary_color?: string } | null
}
interface OrgStat   { id: string; name: string; color: string; total: number; completados: number; cancelados: number; noAsistio: number }
interface ProfStat  { name: string; total: number; completados: number; cancelados: number }
interface DayStat   { date: string; label: string; total: number; completados: number; cancelados: number }

type Vista = 'general' | 'centros' | 'comparativa' | 'tendencia'

const RANGE_OPTIONS = [
  { label: 'Hoy',   days: 0  },
  { label: '7d',    days: 7  },
  { label: '30d',   days: 30 },
  { label: '90d',   days: 90 },
]

const VISTA_OPTIONS: { key: Vista; label: string; icon: React.ElementType }[] = [
  { key: 'general',     label: 'General',      icon: BarChart2        },
  { key: 'centros',     label: 'Por centro',   icon: Building2        },
  { key: 'comparativa', label: 'Comparativa',  icon: Award            },
  { key: 'tendencia',   label: 'Tendencia',    icon: LineChartIcon    },
]

// ─── Main component ───────────────────────────────────────────────────────────
export function ReportsView() {
  const [range, setRange]     = useState(7)
  const [vista, setVista]     = useState<Vista>('general')
  const [rows, setRows]       = useState<RawAppointment[]>([])
  const [orgs, setOrgs]       = useState<{ id: string; name: string; primary_color?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrg, setSelectedOrg] = useState<string>('')

  const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })

  // Load organizations list once
  useEffect(() => {
    supabase.from('organizations').select('id, name, primary_color').eq('active', true).order('name')
      .then(({ data }) => {
        setOrgs(data ?? [])
        if (data && data.length > 0 && !selectedOrg) setSelectedOrg(data[0].id)
      })
  }, [])

  // Load appointments for range
  useEffect(() => {
    setLoading(true)
    const from = startOfDay(range === 0 ? new Date() : subDays(new Date(), range)).toISOString()
    const to   = endOfDay(new Date()).toISOString()
    supabase
      .from('appointments')
      .select('status, starts_at, professionals(full_name, organization_id), services(name), organizations(id, name, primary_color)')
      .gte('starts_at', from)
      .lte('starts_at', to)
      .then(({ data }) => { setRows((data ?? []) as unknown as RawAppointment[]); setLoading(false) })
  }, [range])

  // ── Derived data ──
  const total       = rows.length
  const completados = rows.filter(r => r.status === 'completado').length
  const cancelados  = rows.filter(r => r.status === 'cancelado').length
  const noAsistio   = rows.filter(r => r.status === 'no_asistio').length
  const asistencia  = total > 0 ? Math.round(((total - cancelados - noAsistio) / total) * 100) : 0
  const cancelRate  = total > 0 ? Math.round((cancelados / total) * 100) : 0

  // Por centro
  const orgStats: OrgStat[] = orgs.map(o => {
    const orgRows = rows.filter(r => r.organizations?.id === o.id)
    return {
      id: o.id, name: o.name, color: o.primary_color ?? '#0ea5e9',
      total:       orgRows.length,
      completados: orgRows.filter(r => r.status === 'completado').length,
      cancelados:  orgRows.filter(r => r.status === 'cancelado').length,
      noAsistio:   orgRows.filter(r => r.status === 'no_asistio').length,
    }
  }).sort((a, b) => b.total - a.total)

  // Por profesional (filtrado por org seleccionada en vista centros)
  const filteredByOrg = rows.filter(r => r.organizations?.id === selectedOrg)
  const profMap: Record<string, ProfStat> = {}
  filteredByOrg.forEach(r => {
    const name = r.professionals?.full_name ?? 'Sin asignar'
    if (!profMap[name]) profMap[name] = { name, total: 0, completados: 0, cancelados: 0 }
    profMap[name].total++
    if (r.status === 'completado') profMap[name].completados++
    if (r.status === 'cancelado')  profMap[name].cancelados++
  })
  const profStats = Object.values(profMap).sort((a, b) => b.total - a.total).slice(0, 8)

  // Tendencia diaria
  const rangeStart = range === 0 ? new Date() : subDays(new Date(), range)
  const days = eachDayOfInterval({ start: startOfDay(rangeStart), end: endOfDay(new Date()) })
  const dayStats: DayStat[] = days.map(d => {
    const ds   = format(d, 'yyyy-MM-dd')
    const dRows = rows.filter(r => r.starts_at.slice(0, 10) === ds)
    return {
      date:        ds,
      label:       format(d, range <= 7 ? 'EEE d' : 'd/M', { locale: es }),
      total:       dRows.length,
      completados: dRows.filter(r => r.status === 'completado').length,
      cancelados:  dRows.filter(r => r.status === 'cancelado').length,
    }
  })

  // Comparativa chart data
  const comparativaData = orgStats.filter(o => o.total > 0).map(o => ({
    name:        o.name.length > 14 ? o.name.slice(0, 14) + '…' : o.name,
    Turnos:      o.total,
    Completados: o.completados,
    Cancelados:  o.cancelados,
    color:       o.color,
  }))

  const rangeLabel = RANGE_OPTIONS.find(o => o.days === range)?.label ?? ''

  function handleExport() {
    const style = document.createElement('style')
    style.textContent = `
      @media print {
        @page { margin: 15mm; }
        body * { visibility: hidden !important; }
        #rpt-root, #rpt-root * { visibility: visible !important; }
        #rpt-root { position: fixed !important; inset: 0 !important; width: 100% !important; padding: 0 !important; }
        .no-print { display: none !important; }
      }
    `
    document.head.appendChild(style)
    window.print()
    setTimeout(() => document.head.removeChild(style), 1500)
  }

  return (
    <div id="rpt-root" className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-sm text-gray-400 mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap no-print">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {RANGE_OPTIONS.map(o => (
              <button key={o.days} onClick={() => setRange(o.days)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${range === o.days ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {o.label}
              </button>
            ))}
          </div>
          {!loading && (
            <button onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors">
              <Download className="w-4 h-4" /> PDF
            </button>
          )}
        </div>
      </div>

      {/* Vista tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 no-print">
        {VISTA_OPTIONS.map(v => {
          const Icon = v.icon
          return (
            <button key={v.key} onClick={() => setVista(v.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${vista === v.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon className="w-3.5 h-3.5" /> {v.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* ── GENERAL ── */}
          {vista === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard icon={CalendarCheck} label="Total turnos"  value={total}       color="sky"   />
                <KpiCard icon={TrendingUp}   label="Completados"    value={completados}  color="green" />
                <KpiCard icon={XCircle}      label="Cancelados"     value={cancelados}   color="red"   />
                <KpiCard icon={Users}        label="No asistieron"  value={noAsistio}    color="gray"  />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <RateCard label="Tasa asistencia"  pct={asistencia} bar="bg-green-500" text="text-green-600" />
                <RateCard label="Tasa cancelación" pct={cancelRate}  bar="bg-red-400"  text="text-red-500"   />
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-900 mb-4">Distribución por estado</h2>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Pendientes',  value: rows.filter(r=>r.status==='pendiente').length,   cls:'text-yellow-600 bg-yellow-50' },
                    { label: 'Confirmados', value: rows.filter(r=>r.status==='confirmado').length,  cls:'text-sky-600 bg-sky-50'       },
                    { label: 'En atención', value: rows.filter(r=>r.status==='en_atencion').length, cls:'text-purple-600 bg-purple-50' },
                    { label: 'Completados', value: completados,                                      cls:'text-green-600 bg-green-50'   },
                    { label: 'No asistió',  value: noAsistio,                                        cls:'text-orange-600 bg-orange-50' },
                    { label: 'Cancelados',  value: cancelados,                                       cls:'text-red-600 bg-red-50'       },
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl px-4 py-3 ${s.cls.split(' ')[1]}`}>
                      <div className={`text-2xl font-bold ${s.cls.split(' ')[0]}`}>{s.value}</div>
                      <div className="text-xs font-medium text-gray-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── POR CENTRO ── */}
          {vista === 'centros' && (
            <div className="space-y-4">
              {/* Org picker */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <label className="block text-xs font-medium text-gray-500 mb-2">Centro</label>
                <select value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>

              {/* KPIs del centro */}
              {(() => {
                const orgRow = orgStats.find(o => o.id === selectedOrg)
                if (!orgRow) return null
                const orgTotal = orgRow.total
                const orgAsis  = orgTotal > 0 ? Math.round(((orgTotal - orgRow.cancelados - orgRow.noAsistio) / orgTotal) * 100) : 0
                const orgCan   = orgTotal > 0 ? Math.round((orgRow.cancelados / orgTotal) * 100) : 0
                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <KpiCard icon={CalendarCheck} label="Turnos"       value={orgTotal}          color="sky"   />
                      <KpiCard icon={TrendingUp}    label="Completados"   value={orgRow.completados} color="green" />
                      <KpiCard icon={XCircle}       label="Cancelados"    value={orgRow.cancelados}  color="red"   />
                      <KpiCard icon={Users}         label="No asistieron" value={orgRow.noAsistio}   color="gray"  />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <RateCard label="Tasa asistencia"  pct={orgAsis} bar="bg-green-500" text="text-green-600" />
                      <RateCard label="Tasa cancelación" pct={orgCan}  bar="bg-red-400"  text="text-red-500"   />
                    </div>
                  </>
                )
              })()}

              {/* Top profesionales de ese centro */}
              {profStats.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                    <Award className="w-4 h-4 text-sky-500" />
                    <h2 className="font-semibold text-gray-900">Profesionales</h2>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {profStats.map((p, i) => {
                      const pct = filteredByOrg.length > 0 ? Math.round((p.total / filteredByOrg.length) * 100) : 0
                      return (
                        <div key={p.name} className="px-5 py-3 flex items-center gap-3">
                          <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900 truncate">{p.name}</span>
                              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                <span className="text-xs text-green-600">{p.completados}✓</span>
                                <span className="text-xs text-red-500">{p.cancelados}✗</span>
                                <span className="text-sm font-bold text-gray-700">{p.total}</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-sky-500 rounded-full" style={{ width: pct + '%' }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {profStats.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                  <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Sin turnos para este centro en el período</p>
                </div>
              )}
            </div>
          )}

          {/* ── COMPARATIVA ── */}
          {vista === 'comparativa' && (
            <div className="space-y-4">
              {comparativaData.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                  <p className="text-sm text-gray-400">Sin actividad en el período</p>
                </div>
              ) : (
                <>
                  {/* Ranking visual */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-50">
                      <h2 className="font-semibold text-gray-900">Ranking de centros · {rangeLabel}</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {orgStats.filter(o => o.total > 0).map((o, i) => {
                        const maxTotal = orgStats[0].total
                        const pct      = maxTotal > 0 ? Math.round((o.total / maxTotal) * 100) : 0
                        const asis     = o.total > 0 ? Math.round(((o.total - o.cancelados - o.noAsistio) / o.total) * 100) : 0
                        return (
                          <div key={o.id} className="px-5 py-4 flex items-center gap-3">
                            <span className="text-sm font-bold text-gray-400 w-5">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-gray-900 truncate">{o.name}</span>
                                <div className="flex items-center gap-3 ml-2 flex-shrink-0 text-xs">
                                  <span className="text-gray-500">{o.total} turnos</span>
                                  <span className="text-green-600 font-medium">{asis}% asist.</span>
                                  <span className="text-red-500 font-medium">{o.total > 0 ? Math.round((o.cancelados/o.total)*100) : 0}% cancel.</span>
                                </div>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: pct + '%', backgroundColor: o.color }} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Gráfico de barras agrupadas */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h2 className="font-semibold text-gray-900 mb-4">Turnos por centro</h2>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={comparativaData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="Turnos"      fill="#0ea5e9" radius={[4,4,0,0]} />
                        <Bar dataKey="Completados" fill="#22c55e" radius={[4,4,0,0]} />
                        <Bar dataKey="Cancelados"  fill="#f87171" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── TENDENCIA ── */}
          {vista === 'tendencia' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-900 mb-4">Turnos diarios · {rangeLabel}</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={dayStats} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="total"       stroke="#0ea5e9" strokeWidth={2} dot={false} name="Total"       />
                    <Line type="monotone" dataKey="completados" stroke="#22c55e" strokeWidth={2} dot={false} name="Completados" />
                    <Line type="monotone" dataKey="cancelados"  stroke="#f87171" strokeWidth={2} dot={false} name="Cancelados"  />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Tabla diaria */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50">
                  <h2 className="font-semibold text-gray-900">Detalle por día</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500">
                        <th className="text-left px-5 py-2.5 font-medium">Fecha</th>
                        <th className="text-right px-5 py-2.5 font-medium">Total</th>
                        <th className="text-right px-5 py-2.5 font-medium text-green-600">Completados</th>
                        <th className="text-right px-5 py-2.5 font-medium text-red-500">Cancelados</th>
                        <th className="text-right px-5 py-2.5 font-medium">Asistencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[...dayStats].reverse().map(d => {
                        const asis = d.total > 0 ? Math.round(((d.total - d.cancelados) / d.total) * 100) : 0
                        return (
                          <tr key={d.date} className="hover:bg-gray-50/50">
                            <td className="px-5 py-2.5 text-gray-700">{format(new Date(d.date + 'T12:00:00'), "EEEE d MMM", { locale: es })}</td>
                            <td className="px-5 py-2.5 text-right font-medium text-gray-900">{d.total}</td>
                            <td className="px-5 py-2.5 text-right text-green-600">{d.completados}</td>
                            <td className="px-5 py-2.5 text-right text-red-500">{d.cancelados}</td>
                            <td className="px-5 py-2.5 text-right">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${asis >= 80 ? 'bg-green-100 text-green-700' : asis >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                                {d.total > 0 ? asis + '%' : '—'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  const palette: Record<string, { bg: string; text: string; icon: string }> = {
    sky:   { bg: 'bg-sky-50',   text: 'text-sky-700',   icon: 'text-sky-500'   },
    green: { bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-500' },
    red:   { bg: 'bg-red-50',   text: 'text-red-700',   icon: 'text-red-500'   },
    gray:  { bg: 'bg-gray-50',  text: 'text-gray-700',  icon: 'text-gray-400'  },
  }
  const c = palette[color]
  return (
    <div className={`${c?.bg ?? ''} rounded-2xl p-5`}>
      <Icon className={`w-5 h-5 ${c?.icon ?? ''} mb-3`} />
      <div className={`text-3xl font-bold ${c?.text ?? ''}`}>{value}</div>
      <div className="text-xs font-medium text-gray-500 mt-1">{label}</div>
    </div>
  )
}

function RateCard({ label, pct, bar, text }: { label: string; pct: number; bar: string; text: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-sm text-gray-500 mb-2">{label}</p>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-bold ${text}`}>{pct}%</span>
        <span className="text-sm text-gray-400 mb-1">de los turnos</span>
      </div>
      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: pct + '%' }} />
      </div>
    </div>
  )
}
