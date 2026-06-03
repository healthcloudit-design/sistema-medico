import { useEffect, useState } from 'react'
import { Plus, Pencil, Power, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Servicio, Consultorio } from '../../types'
import { Button } from '../ui/Button'

export function ServicesManager() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [consultorios, setConsultorios] = useState<Consultorio[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Servicio> | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [sRes, cRes] = await Promise.all([
      supabase.from('servicios').select('*, consultorios(nombre)').order('nombre'),
      supabase.from('consultorios').select('*').eq('activo', true),
    ])
    setServicios((sRes.data ?? []) as Servicio[])
    setConsultorios((cRes.data ?? []) as Consultorio[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!editing?.nombre || !editing?.consultorio_id) return
    setSaving(true)
    const payload = {
      consultorio_id: editing.consultorio_id,
      nombre: editing.nombre,
      descripcion: editing.descripcion ?? null,
      duracion_minutos: editing.duracion_minutos ?? 30,
      icono: editing.icono ?? null,
      precio: editing.precio ?? null,
      activo: editing.activo ?? true,
    }
    if (editing.id) {
      await supabase.from('servicios').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('servicios').insert(payload)
    }
    await load()
    setEditing(null)
    setSaving(false)
  }

  const toggle = async (s: Servicio) => {
    await supabase.from('servicios').update({ activo: !s.activo }).eq('id', s.id)
    setServicios(prev => prev.map(x => x.id === s.id ? { ...x, activo: !x.activo } : x))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Servicios</h1>
          <p className="text-sm text-gray-500">Administrá los servicios del centro</p>
        </div>
        <Button onClick={() => setEditing({ duracion_minutos: 30, activo: true, consultorio_id: consultorios[0]?.id })}>
          <Plus className="w-4 h-4" /> Nuevo servicio
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {servicios.map(s => {
            const c = (s as Servicio & { consultorios?: { nombre: string } }).consultorios
            return (
              <div key={s.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 ${s.activo ? '' : 'opacity-60'}`}>
                <span className="text-2xl w-8 text-center flex-shrink-0">{s.icono ?? '👁'}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">{s.nombre}</div>
                  <div className="text-sm text-gray-400">{c?.nombre}</div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.duracion_minutos} min</span>
                    {s.precio && <span>${s.precio.toLocaleString('es-AR')}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(s)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => toggle(s)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
                    <Power className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold">{editing.id ? 'Editar servicio' : 'Nuevo servicio'}</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Consultorio *</label>
                <select value={editing.consultorio_id ?? ''} onChange={e => setEditing(p => ({ ...p, consultorio_id: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
                  {consultorios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nombre *</label>
                <input value={editing.nombre ?? ''} onChange={e => setEditing(p => ({ ...p, nombre: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Ej: Consulta oftalmológica" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Descripción</label>
                <input value={editing.descripcion ?? ''} onChange={e => setEditing(p => ({ ...p, descripcion: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Duración (min)</label>
                  <input type="number" value={editing.duracion_minutos ?? 30} min={5} step={5}
                    onChange={e => setEditing(p => ({ ...p, duracion_minutos: Number(e.target.value) }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Precio ($)</label>
                  <input type="number" value={editing.precio ?? ''} placeholder="Opcional"
                    onChange={e => setEditing(p => ({ ...p, precio: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Ícono</label>
                  <input value={editing.icono ?? ''} placeholder="👁"
                    onChange={e => setEditing(p => ({ ...p, icono: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 text-center text-xl" />
                </div>
              </div>
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
