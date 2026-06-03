import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Search, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Turno, TurnoEstado } from '../../types'
import { Button } from '../ui/Button'

const ESTADOS: { label: string; value: string }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Confirmados', value: 'confirmado' },
  { label: 'Pendientes', value: 'pendiente' },
  { label: 'Atendidos', value: 'atendido' },
  { label: 'Cancelados', value: 'cancelado' },
  { label: 'Ausentes', value: 'ausente' },
]

const ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
  confirmado: { label: 'Confirmado', className: 'bg-green-100 text-green-800' },
  pendiente:  { label: 'Pendiente',  className: 'bg-yellow-100 text-yellow-800' },
  cancelado:  { label: 'Cancelado',  className: 'bg-red-100 text-red-800' },
  ausente:    { label: 'Ausente',    className: 'bg-gray-100 text-gray-600' },
  atendido:   { label: 'Atendido',   className: 'bg-blue-100 text-blue-800' },
}

export function AppointmentList() {
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('all')
  const [selected, setSelected] = useState<Turno | null>(null)
  const [updating, setUpdating] = useState(false)

  const load = async () => {
    setLoading(true)
    let q = supabase
      .from('turnos')
      .select('*, consultorios(nombre), servicios(nombre, icono), pacientes(nombre, telefono, email, obra_social)')
      .order('fecha', { ascending: false })
      .order('hora', { ascending: true })
      .limit(150)
    if (estadoFilter !== 'all') q = q.eq('estado', estadoFilter)
    const { data } = await q
    const ts = (data ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      paciente:    r.pacientes,
      consultorio: r.consultorios,
      servicio:    r.servicios,
    })) as Turno[]
    setTurnos(ts)
    setLoading(false)
  }

  useEffect(() => { load() }, [estadoFilter])

  const filtered = turnos.filter(t => {
    if (!search) return true
    const paciente = t.paciente as { nombre: string; telefono: string } | undefined
    return paciente?.nombre.toLowerCase().includes(search.toLowerCase()) ||
           paciente?.telefono.includes(search)
  })

  const updateEstado = async (id: string, estado: TurnoEstado) => {
    setUpdating(true)
    await supabase.from('turnos').update({ estado }).eq('id', id)
    setSelected(prev => prev ? { ...prev, estado } : null)
    setTurnos(prev => prev.map(t => t.id === id ? { ...t, estado } : t))
    setUpdating(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Turnos</h1>
        <p className="text-sm text-gray-500">Gestioná todos los turnos del centro</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o teléfono..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {ESTADOS.map(f => (
              <button key={f.value} onClick={() => setEstadoFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${estadoFilter === f.value ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No se encontraron turnos</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(t => {
              const servicio = t.servicio as { nombre: string; icono?: string } | undefined
              const paciente = t.paciente as { nombre: string; telefono: string } | undefined
              const consultorio = t.consultorio as { nombre: string } | undefined
              const cfg = ESTADO_CONFIG[t.estado]
              return (
                <div key={t.id} onClick={() => setSelected(t)}
                  className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50/50 cursor-pointer">
                  <div className="text-xs font-mono text-gray-400 w-20 flex-shrink-0">
                    {t.fecha}<br />{t.hora.slice(0,5)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm">{paciente?.nombre ?? '—'}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg?.className}`}>{cfg?.label}</span>
                    </div>
                    <div className="text-xs text-gray-400">{servicio?.icono} {servicio?.nombre} · {consultorio?.nombre}</div>
                  </div>
                  <Eye className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selected && (
        <TurnoModal turno={selected} onClose={() => setSelected(null)} onUpdate={updateEstado} updating={updating} />
      )}
    </div>
  )
}

function TurnoModal({ turno, onClose, onUpdate, updating }: {
  turno: Turno; onClose: () => void
  onUpdate: (id: string, estado: TurnoEstado) => void; updating: boolean
}) {
  const paciente = turno.paciente as { nombre: string; telefono: string; email?: string; obra_social?: string; nro_socio?: string } | undefined
  const servicio = turno.servicio as { nombre: string; icono?: string } | undefined
  const consultorio = turno.consultorio as { nombre: string } | undefined
  const cfg = ESTADO_CONFIG[turno.estado]
  const esPendiente = turno.estado === 'pendiente'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Detalle del turno</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg?.className}`}>{cfg?.label}</span>
            <span className="text-sm text-gray-500">
              {format(parseISO(turno.fecha), 'dd/MM/yy')} a las {turno.hora.slice(0,5)}hs
            </span>
          </div>

          {/* Alerta obra social pendiente de verificación */}
          {esPendiente && paciente?.obra_social && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Verificar cobertura</p>
              <p className="text-sm font-medium text-amber-900">{paciente.obra_social}</p>
              {paciente.nro_socio && (
                <p className="text-sm text-amber-700">Nº socio: <span className="font-mono font-semibold">{paciente.nro_socio}</span></p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Paciente" value={paciente?.nombre ?? '—'} />
            <Info label="Teléfono" value={paciente?.telefono ?? '—'} />
            <Info label="Servicio" value={`${servicio?.icono ?? ''} ${servicio?.nombre ?? '—'}`} />
            <Info label="Consultorio" value={consultorio?.nombre ?? '—'} />
            {paciente?.email && <Info label="Email" value={paciente.email} />}
            {paciente?.obra_social && !esPendiente && <Info label="Obra social" value={`${paciente.obra_social}${paciente.nro_socio ? ` · ${paciente.nro_socio}` : ''}`} />}
          </div>

          <div className="flex gap-2 pt-1 flex-wrap">
            {/* Confirmar es CTA principal para pendientes */}
            {turno.estado === 'pendiente' && (
              <Button size="sm" onClick={() => onUpdate(turno.id, 'confirmado')} loading={updating}>
                ✓ Confirmar turno
              </Button>
            )}
            {turno.estado === 'confirmado' && (
              <Button size="sm" onClick={() => onUpdate(turno.id, 'atendido')} loading={updating}>
                ✓ Atendido
              </Button>
            )}
            {turno.estado !== 'ausente' && turno.estado !== 'atendido' && turno.estado !== 'cancelado' && (
              <Button size="sm" variant="secondary" onClick={() => onUpdate(turno.id, 'ausente')} loading={updating}>
                No asistió
              </Button>
            )}
            {turno.estado !== 'cancelado' && turno.estado !== 'atendido' && (
              <Button size="sm" variant="danger" onClick={() => onUpdate(turno.id, 'cancelado')} loading={updating}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="text-gray-900 font-medium text-sm">{value}</div>
    </div>
  )
}
