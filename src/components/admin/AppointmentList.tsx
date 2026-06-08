import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Search, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Appointment, AppointmentStatus } from '../../types'
import { Button } from '../ui/Button'

const ESTADOS = [
  { label: 'Todos',       value: 'all' },
  { label: 'Confirmados', value: 'confirmado' },
  { label: 'Pendientes',  value: 'pendiente' },
  { label: 'Completados', value: 'completado' },
  { label: 'Cancelados',  value: 'cancelado' },
  { label: 'No asistio',  value: 'no_asistio' },
]

const ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
  confirmado: { label: 'Confirmado', className: 'bg-green-100 text-green-800' },
  pendiente:  { label: 'Pendiente',  className: 'bg-yellow-100 text-yellow-800' },
  cancelado:  { label: 'Cancelado',  className: 'bg-red-100 text-red-800' },
  no_asistio: { label: 'No asistio', className: 'bg-gray-100 text-gray-600' },
  completado: { label: 'Completado', className: 'bg-blue-100 text-blue-800' },
}

function toArgTime(iso: string): string {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d = new Date(ms)
  return `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')}`
}

function toArgDate(iso: string): string {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${(d.getUTCMonth()+1).toString().padStart(2,'0')}-${d.getUTCDate().toString().padStart(2,'0')}`
}

export function AppointmentList() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [updating, setUpdating] = useState(false)

  const load = async () => {
    setLoading(true)
    let q = supabase
      .from('appointments')
      .select('*, professionals(full_name, specialty), services(name, color), patients(full_name, phone, email, obra_social, nro_socio)')
      .order('starts_at', { ascending: false })
      .limit(200)
    if (statusFilter !== 'all') q = q.eq('status', statusFilter)
    const { data } = await q
    const appts = (data ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      professional: r.professionals,
      service:      r.services,
      patient:      r.patients,
    })) as Appointment[]
    setAppointments(appts)
    setLoading(false)
  }

  useEffect(() => { load() }, [statusFilter])

  const filtered = appointments.filter(a => {
    if (!search) return true
    return a.patient_name.toLowerCase().includes(search.toLowerCase()) ||
           (a.patient_phone ?? '').includes(search)
  })

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    setUpdating(true)
    await supabase.from('appointments').update({ status }).eq('id', id)
    setSelected(prev => prev ? { ...prev, status } : null)
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a))
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
              placeholder="Buscar por nombre o telefono..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {ESTADOS.map(f => (
              <button key={f.value} onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${statusFilter === f.value ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
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
            {filtered.map(a => {
              const service      = a.service      as { name: string } | undefined
              const professional = a.professional as { full_name: string } | undefined
              const cfg = ESTADO_CONFIG[a.status]
              return (
                <div key={a.id} onClick={() => setSelected(a)}
                  className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50/50 cursor-pointer">
                  <div className="text-xs font-mono text-gray-400 w-20 flex-shrink-0">
                    {toArgDate(a.starts_at)}<br />{toArgTime(a.starts_at)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm">{a.patient_name}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg?.className}`}>{cfg?.label}</span>
                    </div>
                    <div className="text-xs text-gray-400">{service?.name} · {professional?.full_name}</div>
                  </div>
                  <Eye className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selected && (
        <AppointmentModal
          appointment={selected}
          onClose={() => setSelected(null)}
          onUpdate={updateStatus}
          updating={updating}
        />
      )}
    </div>
  )
}

function AppointmentModal({ appointment: a, onClose, onUpdate, updating }: {
  appointment: Appointment
  onClose: () => void
  onUpdate: (id: string, status: AppointmentStatus) => void
  updating: boolean
}) {
  const patient      = a.patient      as { full_name: string; phone?: string; email?: string; obra_social?: string; nro_socio?: string } | undefined
  const service      = a.service      as { name: string } | undefined
  const professional = a.professional as { full_name: string } | undefined
  const cfg = ESTADO_CONFIG[a.status]
  const isPendiente = a.status === 'pendiente'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Detalle del turno</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">x</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg?.className}`}>{cfg?.label}</span>
            <span className="text-sm text-gray-500">
              {format(parseISO(toArgDate(a.starts_at)), 'dd/MM/yy')} a las {toArgTime(a.starts_at)}hs
            </span>
          </div>

          {isPendiente && patient?.obra_social && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Verificar cobertura</p>
              <p className="text-sm font-medium text-amber-900">{patient.obra_social}</p>
              {patient.nro_socio && (
                <p className="text-sm text-amber-700">N socio: <span className="font-mono font-semibold">{patient.nro_socio}</span></p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Paciente"    value={a.patient_name} />
            <Info label="Telefono"    value={a.patient_phone ?? '-'} />
            <Info label="Servicio"    value={service?.name ?? '-'} />
            <Info label="Profesional" value={professional?.full_name ?? '-'} />
            {a.patient_email && <Info label="Email" value={a.patient_email} />}
            {patient?.obra_social && !isPendiente && (
              <Info label="Obra social" value={`${patient.obra_social}${patient.nro_socio ? ` - ${patient.nro_socio}` : ''}`} />
            )}
          </div>

          <div className="flex gap-2 pt-1 flex-wrap">
            {a.status === 'pendiente' && (
              <Button size="sm" onClick={() => onUpdate(a.id, 'confirmado')} loading={updating}>
                Confirmar
              </Button>
            )}
            {a.status === 'confirmado' && (
              <Button size="sm" onClick={() => onUpdate(a.id, 'completado')} loading={updating}>
                Completado
              </Button>
            )}
            {!['no_asistio','completado','cancelado'].includes(a.status) && (
              <Button size="sm" variant="secondary" onClick={() => onUpdate(a.id, 'no_asistio')} loading={updating}>
                No asistio
              </Button>
            )}
            {!['cancelado','completado'].includes(a.status) && (
              <Button size="sm" variant="danger" onClick={() => onUpdate(a.id, 'cancelado')} loading={updating}>
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
