import { useEffect, useState } from 'react'
import { Plus, Pencil, Power, Building2, MapPin, Phone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Consultorio } from '../../types'
import { Button } from '../ui/Button'

export function ProfessionalsManager() {
  const [consultorios, setConsultorios] = useState<Consultorio[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Consultorio> | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('consultorios').select('*').order('nombre')
    setConsultorios((data ?? []) as Consultorio[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!editing?.nombre) return
    setSaving(true)
    const payload = { nombre: editing.nombre, direccion: editing.direccion ?? null, telefono: editing.telefono ?? null, activo: editing.activo ?? true }
    if (editing.id) {
      await supabase.from('consultorios').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('consultorios').insert(payload)
    }
    await load()
    setEditing(null)
    setSaving(false)
  }

  const toggle = async (c: Consultorio) => {
    await supabase.from('consultorios').update({ activo: !c.activo }).eq('id', c.id)
    setConsultorios(prev => prev.map(x => x.id === c.id ? { ...x, activo: !x.activo } : x))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consultorios</h1>
          <p className="text-sm text-gray-500">Administrá las salas de atención</p>
        </div>
        <Button onClick={() => setEditing({ activo: true })}>
          <Plus className="w-4 h-4" /> Nuevo consultorio
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {consultorios.map(c => (
            <div key={c.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 ${c.activo ? '' : 'opacity-60'}`}>
              <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-sky-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900">{c.nombre}</div>
                {c.direccion && <div className="flex items-center gap-1 text-xs text-gray-400"><MapPin className="w-3 h-3" />{c.direccion}</div>}
                {c.telefono && <div className="flex items-center gap-1 text-xs text-gray-400"><Phone className="w-3 h-3" />{c.telefono}</div>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(c)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => toggle(c)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"><Power className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold">{editing.id ? 'Editar consultorio' : 'Nuevo consultorio'}</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nombre *</label>
                <input value={editing.nombre ?? ''} onChange={e => setEditing(p => ({ ...p, nombre: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Ej: Consultorio A" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Dirección</label>
                <input value={editing.direccion ?? ''} onChange={e => setEditing(p => ({ ...p, direccion: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Teléfono</label>
                <input value={editing.telefono ?? ''} onChange={e => setEditing(p => ({ ...p, telefono: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
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
