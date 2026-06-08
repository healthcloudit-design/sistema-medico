import { useEffect, useState } from 'react'
import { Plus, Pencil, Power, UserCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Professional } from '../../types'
import { Button } from '../ui/Button'

const DEFAULT_ORG_ID = 'a0000000-0000-0000-0000-000000000001'

export function ProfessionalsManager() {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Professional> | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('professionals').select('*').order('full_name')
    setProfessionals((data ?? []) as Professional[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!editing?.full_name) return
    setSaving(true)
    const payload = {
      organization_id: DEFAULT_ORG_ID,
      full_name:  editing.full_name,
      specialty:  editing.specialty ?? null,
      bio:        editing.bio ?? null,
      avatar_url: editing.avatar_url ?? null,
      active:     editing.active ?? true,
    }
    if (editing.id) {
      await supabase.from('professionals').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('professionals').insert(payload)
    }
    await load()
    setEditing(null)
    setSaving(false)
  }

  const toggle = async (p: Professional) => {
    await supabase.from('professionals').update({ active: !p.active }).eq('id', p.id)
    setProfessionals(prev => prev.map(x => x.id === p.id ? { ...x, active: !p.active } : x))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profesionales</h1>
          <p className="text-sm text-gray-500">Administra el equipo medico</p>
        </div>
        <Button onClick={() => setEditing({ active: true })}>
          <Plus className="w-4 h-4" /> Nuevo profesional
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {professionals.map(p => (
            <div key={p.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 ${p.active ? '' : 'opacity-60'}`}>
              <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {p.avatar_url
                  ? <img src={p.avatar_url} alt={p.full_name} className="w-10 h-10 object-cover" />
                  : <UserCircle className="w-6 h-6 text-sky-600" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900">{p.full_name}</div>
                {p.specialty && <div className="text-sm text-gray-500">{p.specialty}</div>}
                {p.bio && <div className="text-xs text-gray-400 mt-0.5 truncate">{p.bio}</div>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(p)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => toggle(p)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
                  <Power className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold">{editing.id ? 'Editar profesional' : 'Nuevo profesional'}</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nombre completo *</label>
                <input
                  value={editing.full_name ?? ''}
                  onChange={e => setEditing(p => ({ ...p, full_name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Ej: Dra. Ana Garcia"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Especialidad</label>
                <input
                  value={editing.specialty ?? ''}
                  onChange={e => setEditing(p => ({ ...p, specialty: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Ej: Cardiologia"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Bio</label>
                <textarea
                  value={editing.bio ?? ''}
                  onChange={e => setEditing(p => ({ ...p, bio: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">URL de foto</label>
                <input
                  value={editing.avatar_url ?? ''}
                  onChange={e => setEditing(p => ({ ...p, avatar_url: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="https://..."
                />
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
