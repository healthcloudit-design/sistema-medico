import { useEffect, useState } from 'react'
import { Calendar, CheckCircle, XCircle, Clock } from 'lucide-react'
import { format, startOfDay, endOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import type { Turno } from '../../types'

const ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
  confirmado: { label: 'Confirmado', className: 'bg-green-100 text-green-800' },
  pendiente:  { label: 'Pendiente',  className: 'bg-yellow-100 text-yellow-800' },
  cancelado:  { label: 'Cancelado',  className: 'bg-red-100 text-red-800' },
  ausente:    { label: 'Ausente',    className: 'bg-gray-100 text-gray-600' },
  atendido:   { label: 'Atendido',   className: 'bg-blue-100 text-blue-800' },
}

export function Dashboard() {
  const [turnosHoy, setTurnosHoy] = useState<Turno[]>([])
  const [stats, setStats] = useState({ total: 0, confirmados: 0, cancelados: 0, pendientes: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const hoy = format(new Date(), 'yyyy-MM-dd')
    supabase
      .from('turnos')
      .select('*, consultorios(nombre), servicios(nombre, icono), pacientes(nombre, telefono)')
      .eq('fecha', hoy)
      .order('hora')
      .then(({ data }) => {
        // Supabase devuelve joins con nombre de tabla (plural); normalizamos a singular
        const ts = (data ?? []).map((r: Record<string, unknown>) => ({
          ...r,
          paciente:    r.pacientes,
          consultorio: r.consultorios,
          servicio:    r.servicios,
        })) as Turno[]
        setTurnosHoy(ts)
        setStats({
          total: ts.length,
          confirmados: ts.filter(t => t.estado === 'confirmado').length,
          cancelados: ts.filter(t => t.estado === 'cancelado').length,
          pendientes: ts.filter(t => t.estado === 'pendiente').length,
        })
        setLoading(false)
      })
  }, [])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm capitalize">
          {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Calendar}     label="Turnos hoy"   value={stats.total}       color="blue"   loading={loading} />
        <StatCard icon={CheckCircle}  label="Confirmados"  value={stats.confirmados}  color="green"  loading={loading} />
        <StatCard icon={Clock}        label="Pendientes"   value={stats.pendientes}   color="yellow" loading={loading} />
        <StatCard icon={XCircle}      label="Cancelados"   value={stats.cancelados}   color="red"    loading={loading} />
      </div>

      {/* Turnos de hoy */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Turnos de hoy</h2>
          <span className="text-sm text-gray-400">{stats.total} total</span>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)}</div>
        ) : turnosHoy.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No hay turnos para hoy</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {turnosHoy.map(t => {
              const servicio = t.servicio as { nombre: string; icono?: string } | undefined
              const paciente = t.paciente as { nombre: string; telefono: string } | undefined
              const consultorio = t.consultorio as { nombre: string } | undefined
              const cfg = ESTADO_CONFIG[t.estado]
              return (
                <div key={t.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="text-sm font-mono font-semibold text-gray-500 w-12">{t.hora.slice(0,5)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">{paciente?.nombre ?? '—'}</div>
                    <div className="text-xs text-gray-400">{servicio?.icono} {servicio?.nombre} · {consultorio?.nombre}</div>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${cfg?.className}`}>{cfg?.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color, loading }: {
  icon: React.ElementType; label: string; value: number; color: string; loading: boolean
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600', red: 'bg-red-50 text-red-600',
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      {loading ? <div className="h-7 w-10 bg-gray-100 rounded animate-pulse mb-1" /> : (
        <div className="text-2xl font-bold text-gray-900">{value}</div>
      )}
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}
