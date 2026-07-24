import { useEffect, useState } from 'react'
import { Plus, Pencil, Power, Clock, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Service, Professional } from '../../types'
import { Button } from '../ui/Button'

interface Props {
  organizationId?: string | null
}

export function ServicesManager({ organizationId }: Props) {
  const [services, setServices] = useState<Service[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Service> | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [assignedIds, setAssignedIds] = useState<string[]>([])

  const load = async () => {
    let sQuery = supabase.from('services').select('*').order('name')
    let pQuery = supabase.from('professionals').select('*').eq('active', true).order('full_name')
    if (organizationId) {
      sQuery = sQuery.eq('organization_id', organizationId)
      pQuery = pQuery.eq('organization_id', organizationId)
    }
    const [sRes, pRes] = await Promise.all([sQuery, pQuery])
    setServices((sRes.data ?? []) as Service[])
    setProfessionals((pRes.data ?? []) as Professional[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openEdit = async (s?: Service) => {
    if (s?.id) {
      const { data } = await supabase
        .from('professional_services')
        .select('professional_id')
        .eq('service_id', s.id)
      setAssignedIds((data ?? []).map((r: { professional_id: string }) => r.professional_id))
    } else {
      setAssignedIds([])
    }
    setEditing(s ?? { duration_minutes: 30, active: true, color: '#0ea5e9', capacity: 1, waitlist_limit: 0 })
  }

  const toggleAssign = (profId: string) => {
    setAssignedIds(prev =>
      prev.includes(profId) ? prev.filter(id => id !== profId) : [...prev, profId]
    )
  }

  const save = async () => {
    if (!editing?.name) return
    if (!organizationId) { setSaveError('No se encontró el centro. Recargá la página e intentá de nuevo.'); return }
    setSaving(true)
    setSaveError('')
    const payload = {
      organization_id:  organizationId,
      name:             editing.name,
      description:      editing.description ?? null,
      duration_minutes: editing.duration_minutes ?? 30,
      price:            editing.price ?? null,
      color:            editing.color ?? '#0ea5e9',
      active:           editing.active ?? true,
      capacity:         editing.capacity ?? 1,
      waitlist_limit:   editing.capacity && editing.capacity > 1 ? (editing.waitlist_limit ?? 0) : 0,
    }
    let serviceId = editing.id
    if (serviceId) {
      const { error } = await supabase.from('services').update(payload).eq('id', serviceId)
      if (error) { setSaveError('No se pudo guardar. Intentá de nuevo.'); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('services').insert(payload).select('id').single()
      if (error || !data) { setSaveError('No se pudo guardar. Intentá de nuevo.'); setSaving(false); return }
      serviceId = (data as { id: string })?.id
    }
    if (serviceId) {
      await supabase.from('professional_services').delete().eq('service_id', serviceId)
      if (assignedIds.length > 0) {
        await supabase.from('professional_services').insert(
          assignedIds.map(pid => ({ professional_id: pid, service_id: serviceId! }))
        )
      }
    }
    await load()
    setEditing(null)
    setSaving(false)
  }

  const toggle = async (s: Service) => {
    await supabase.from('services').update({ active: !s.active }).eq('id', s.id)
    setServices(prev => prev.map(x => x.id === s.id ? { ...x, active: !s.active } : x))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Servicios</h1>
          <p className="text-sm text-gray-500">Administra los servicios del centro</p>
        </div>
        <Button onClick={() => openEdit()}>
          <Plus className="w-4 h-4" /> Nuevo servicio
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {services.map(s => (
            <div key={s.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 ${s.active ? '' : 'opacity-60'}`}>
              <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900">{s.name}</div>
                {s.description && <div className="text-sm text-gray-400 mt-0.5">{s.description}</div>}
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.duration_minutes} min</span>
                  {s.price && <span>${s.price.toLocaleString('es-AR')}</span>}
                  {s.capacity > 1 && (
                    <span className="flex items-center gap-1 text-sky-600">
                      <Users className="w-3 h-3" />
                      Cupo: {s.capacity}{s.waitlist_limit > 0 ? ` (+${s.waitlist_limit} en espera)` : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(s)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => toggle(s)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
                  <Power className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl my-auto">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold">{editing.id ? 'Editar servicio' : 'Nuevo servicio'}</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nombre *</label>
                <input
                  value={editing.name ?? ''}
                  onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Ej: Consulta general"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Descripcion</label>
                <input
                  value={editing.description ?? ''}
                  onChange={e => setEditing(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Duracion (min)</label>
                  <input
                    type="number" value={editing.duration_minutes ?? 30} min={5} step={5}
                    onChange={e => setEditing(p => ({ ...p, duration_minutes: Number(e.target.value) }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Precio ($)</label>
                  <input
                    type="number" value={editing.price ?? ''} placeholder="Opt."
                    onChange={e => setEditing(p => ({ ...p, price: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Color</label>
                  <input
                    type="color" value={editing.color ?? '#0ea5e9'}
                    onChange={e => setEditing(p => ({ ...p, color: e.target.value }))}
                    className="w-full h-10 rounded-xl border border-gray-200 cursor-pointer px-1 py-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Cupo por turno</label>
                  <input
                    type="number" value={editing.capacity ?? 1} min={1} step={1}
                    onChange={e => setEditing(p => ({ ...p, capacity: Math.max(1, Number(e.target.value)) }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">1 = turno individual. Más de 1 = clase grupal (varias personas pueden reservar el mismo horario).</p>
                </div>
                {(editing.capacity ?? 1) > 1 && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Límite de lista de espera</label>
                    <input
                      type="number" value={editing.waitlist_limit ?? 0} min={0} step={1}
                      onChange={e => setEditing(p => ({ ...p, waitlist_limit: Math.max(0, Number(e.target.value)) }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">0 = sin lista de espera. Al llenarse el cupo, se ofrece anotarse hasta este límite.</p>
                  </div>
                )}
              </div>
              {saveError && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{saveError}</div>
              )}
              {professionals.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Profesionales que lo atienden</label>
                  <div className="space-y-2">
                    {professionals.map(p => (
                      <label key={p.id} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={assignedIds.includes(p.id)}
                          onChange={() => toggleAssign(p.id)}
                          className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                        />
                        <span className="text-sm text-gray-700">{p.full_name}{p.specialty ? ` (${p.specialty})` : ''}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button className="flex-1" loading={saving} onClick={save}>Guardar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
