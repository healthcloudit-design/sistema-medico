import { useEffect, useRef, useState } from 'react'
import { TrendingUp, Users, CalendarCheck, XCircle, Clock, Award, Download } from 'lucide-react'
import { subDays, startOfDay, endOfDay } from 'date-fns'
import { supabase } from '../../lib/supabase'

interface Stats {
  total: number
  confirmados: number
  cancelados: number
  noAsistio: number
  completados: number
  enAtencion: number
  pendientes: number
}

interface ProfStat  { name: string; total: number; completados: number }
interface ServiceStat { name: string; total: number }

const RANGE_OPTIONS = [
  { label: 'Hoy',        days: 0  },
  { label: 'Últimos 7d', days: 7  },
  { label: '30 días',    days: 30 },
  { label: '90 días',    days: 90 },
]

export function ReportsView() {
  const [range, setRange]         = useState(7)
  const [stats, setStats]         = useState<Stats | null>(null)
  const [profStats, setProfStats] = useState<ProfStat[]>([])
  const [svcStats, setSvcStats]   = useState<ServiceStat[]>([])
  const [loading, setLoading]     = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    const from = startOfDay(range === 0 ? new Date() : subDays(new Date(), range)).toISOString()
    const to   = endOfDay(new Date()).toISOString()

    supabase
      .from('appointments')
      .select('status, professionals(full_name), services(name)')
      .gte('starts_at', from)
      .lte('starts_at', to)
      .then(({ data }) => {
        const rows = data ?? []
        setStats({
          total:       rows.length,
          confirmados: rows.filter(r => r.status === 'confirmado').length,
          cancelados:  rows.filter(r => r.status === 'cancelado').length,
          noAsistio:   rows.filter(r => r.status === 'no_asistio').length,
          completados: rows.filter(r => r.status === 'completado').length,
          enAtencion:  rows.filter(r => r.status === 'en_atencion').length,
          pendientes:  rows.filter(r => r.status === 'pendiente').length,
        })

        const profMap: Record<string, { total: number; completados: number }> = {}
        for (const r of rows) {
          const name = (r.professionals as any)?.full_name ?? 'Sin asignar'
          if (!profMap[name]) profMap[name] = { total: 0, completados: 0 }
          profMap[name].total++
          if (r.status === 'completado') profMap[name].completados++
        }
        setProfStats(Object.entries(profMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total).slice(0, 8))

        const svcMap: Record<string, number> = {}
        for (const r of rows) {
          const name = (r.services as any)?.name ?? 'Sin servicio'
          svcMap[name] = (svcMap[name] ?? 0) + 1
        }
        setSvcStats(Object.entries(svcMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 8))
        setLoading(false)
      })
  }, [range])

  const tasaCancelacion = stats && stats.total > 0 ? Math.round((stats.cancelados / stats.total) * 100) : 0
  const tasaAsistencia  = stats && stats.total > 0 ? Math.round(((stats.total - stats.cancelados - stats.noAsistio) / stats.total) * 100) : 0

  const rangeLabel = RANGE_OPTIONS.find(o => o.days === range)?.label ?? ''
  const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })

  function handleExport() {
    // Inject print styles, print, then remove
    const style = document.createElement('style')
    style.id = '__report-print-style'
    style.textContent = `
      @media print {
        body > *:not(#report-print-root) { display: none !important; }
        #report-print-root { display: block !important; }
        @page { margin: 20mm; size: A4 portrait; }
        .no-print { display: none !important; }
      }
    `
    document.head.appendChild(style)
    if (printRef.current) printRef.current.id = 'report-print-root'
    window.print()
    setTimeout(() => {
      document.head.removeChild(style)
      if (printRef.current) printRef.current.removeAttribute('id')
    }, 1000)
  }

  return (
    <div ref={printRef} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Métricas operativas · {today}</p>
        </div>
        <div className="flex items-center gap-3 no-print">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.days}
                onClick={() => setRange(opt.days)}
                className={['px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  range === opt.days ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {!loading && stats && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar PDF
            </button>
          )}
        </div>
      </div>

      {/* Print header (only visible when printing) */}
      <div className="hidden print:block mb-4">
        <p className="text-xs text-gray-400">Período: {rangeLabel} · Exportado el {today}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : stats ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={CalendarCheck} label="Total turnos"  value={stats.total}       color="sky"   />
            <KpiCard icon={TrendingUp}   label="Completados"    value={stats.completados}  color="green" />
            <KpiCard icon={XCircle}      label="Cancelados"     value={stats.cancelados}   color="red"   />
            <KpiCard icon={Users}        label="No asistieron"  value={stats.noAsistio}    color="gray"  />
          </div>

          {/* Tasas */}
          <div className="grid grid-cols-2 gap-4">
            <RateCard label="Tasa de asistencia"  pct={tasaAsistencia}  barColor="bg-green-500" textColor="text-green-600" />
            <RateCard label="Tasa de cancelación" pct={tasaCancelacion} barColor="bg-red-400"   textColor="text-red-500"   />
          </div>

          {/* Estado actual */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Distribución por estado</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Pendientes',   value: stats.pendientes,  color: 'text-yellow-600 bg-yellow-50' },
                { label: 'Confirmados',  value: stats.confirmados, color: 'text-sky-600 bg-sky-50'       },
                { label: 'En atención',  value: stats.enAtencion,  color: 'text-purple-600 bg-purple-50' },
                { label: 'Completados',  value: stats.completados, color: 'text-green-600 bg-green-50'   },
                { label: 'No asistió',   value: stats.noAsistio,   color: 'text-orange-600 bg-orange-50' },
                { label: 'Cancelados',   value: stats.cancelados,  color: 'text-red-600 bg-red-50'       },
              ].map(s => (
                <div key={s.label} className={`rounded-xl px-4 py-3 ${s.color.split(' ')[1]}`}>
                  <div className={`text-2xl font-bold ${s.color.split(' ')[0]}`}>{s.value}</div>
                  <div className="text-xs font-medium text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Por profesional */}
          {profStats.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                <Award className="w-4 h-4 text-sky-500" />
                <h2 className="font-semibold text-gray-900">Por profesional</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {profStats.map((p, i) => {
                  const pct = stats.total > 0 ? Math.round((p.total / stats.total) * 100) : 0
                  return (
                    <div key={p.name} className="px-5 py-3 flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900 truncate">{p.name}</span>
                          <span className="text-sm font-bold text-gray-700 ml-2">{p.total}</span>
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

          {/* Por servicio */}
          {svcStats.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-500" />
                <h2 className="font-semibold text-gray-900">Servicios más reservados</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {svcStats.map((s, i) => {
                  const pct = stats.total > 0 ? Math.round((s.total / stats.total) * 100) : 0
                  return (
                    <div key={s.name} className="px-5 py-3 flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900 truncate">{s.name}</span>
                          <span className="text-sm font-bold text-gray-700 ml-2">{s.total}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: pct + '%' }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number; color: string
}) {
  const colors: Record<string, { bg: string; text: string; icon: string }> = {
    sky:   { bg: 'bg-sky-50',   text: 'text-sky-700',   icon: 'text-sky-500'   },
    green: { bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-500' },
    red:   { bg: 'bg-red-50',   text: 'text-red-700',   icon: 'text-red-500'   },
    gray:  { bg: 'bg-gray-50',  text: 'text-gray-700',  icon: 'text-gray-400'  },
  }
  const c = colors[color]
  return (
    <div className={`${c.bg} rounded-2xl p-5`}>
      <Icon className={`w-5 h-5 ${c.icon} mb-3`} />
      <div className={`text-3xl font-bold ${c.text}`}>{value}</div>
      <div className="text-xs font-medium text-gray-500 mt-1">{label}</div>
    </div>
  )
}

function RateCard({ label, pct, barColor, textColor }: {
  label: string; pct: number; barColor: string; textColor: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-sm text-gray-500 mb-2">{label}</p>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-bold ${textColor}`}>{pct}%</span>
        <span className="text-sm text-gray-400 mb-1">de los turnos</span>
      </div>
      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: pct + '%' }} />
      </div>
    </div>
  )
}
