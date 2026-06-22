import { useEffect, useState } from 'react'
import { Plus, Pencil, Power, UserCircle, Trash2, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Professional } from '../../types'
import type { Organization } from '../../types'
import { Button } from '../ui/Button'

interface ServiceOption { id: string; name: string }

export function ProfessionalsManager() {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading]             = useState(true)
  const [editing, setEditing]             = useState<Partial<Professional> | null>(null)
  const [saving, setSaving]               = useState(false)
  const [formError, setFormError]         = useState('')
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting]           = useState(false)
  const [search, setSearch]               = useState('')

  // Services for current editing org
  const [orgServices, setOrgServices]       = useState<ServiceOption[]>([])
  const [selectedServices, setSelectedServices] = useState<string[]>([])

  const load = async () => {
    const [profRes, orgRes] = await Promise.all([
      supabase.from('professionals').select('*, organizations(name)').order('full_name'),
      supabase.from('organizations').select('id, name').eq('active', true).order('name'),
    ])
    setProfessionals((profRes.data ?? []) as Professional[])
    setOrganizations((orgRes.data ?? []) as Organization[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Load services when org changes in the form
  useEffect(() => {
    if (!editing?.organization_id) { setOrgServices([]); return }
    supabase
      .from('services')
      .select('id, name')
      .eq('organization_id', editing.organization_id)
      .eq('active', true)
      .order('name')
      .then(({ data }) => setOrgServices((data ?? []) as ServiceOption[]))
  }, [editing?.organization_id])

  // Load existing services when editing an existing professional
  useEffect(() => {
    if (!editing?.id) { setSelectedServices([]); return }
    supabase
      .from('professional_services')
      .select('service_id')
      .eq('professional_id', editing.id)
      .then(({ data }) => setSelectedServices((data ?? []).map((r: { service_id: string }) => r.service_id)))
  }, [editing?.id])

  const filtered = professionals.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.specialty ?? '').toLowerCase().includes(search.toLowerCase()) ||
    ((p as any).organizations?.name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const toggleService = (id: string) => {
    setSelectedServices(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const save = async () => {
    if (!editing?.full_name) return
    if (!editing?.organization_id) { setFormError('Seleccioná el centro al que pertenece'); return }
    setFormError('')
    setSaving(true)
    const payload = {
      organization_id: editing.organization_id,
      full_name:  editing.full_name,
      specialty:  editing.specialty ?? null,
      bio:        editing.bio ?? null,
      avatar_url: editing.avatar_url ?? null,
      active:     editing.active ?? true,
    }

    let professionalId = editing.id ?? null

    if (editing.id) {
      await supabase.from('professionals').update(payload).eq('id', editing.id)
    } else {
      const { data } = await supabase.from('professionals').insert(payload).select('id').single()
      professionalId = data?.id ?? null
    }

    // Sync professional_services
    if (professionalId) {
      // Delete existing links then re-insert selected
      await supabase.from('professional_services').delete().eq('professional_id', professionalId)
      if (selectedServices.length > 0) {
        await supabase.from('professional_services').insert(
          selectedServices.map(sid => ({ professional_id: professionalId!, service_id: sid }))
        )
      }
    }

    await load()
    setEditing(null)
    setSelectedServices([])
    setSaving(false)
  }

  const toggle = async (p: Professional) => {
    await supabase.from('professionals').update({ active: !p.active }).eq('id', p.id)
    setProfessionals(prev => prev.map(x => x.id === p.id ? { ...x, active: !p.active } : x))
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    const id = confirmDelete.id
    // Borrar dependencias antes de borrar el profesional
    await supabase.from('professional_services').delete().eq('professional_id', id)
    await supabase.from('schedules').delete().eq('professional_id', id)
    await supabase.from('blocked_days').delete().eq('professional_id', id)
    // Los appointments se conservan (historial), solo nulleamos el professional_id
    await supabase.from('appointments').update({ professional_id: null } as any).eq('professional_id', id)
    await supabase.from('professionals').delete().eq('id', id)
    setProfessionals(prev => prev.filter(p => p.id !== confirmDelete.id))
    setConfirmDelete(null)
    setDeleting(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profesionales</h1>
          <p className="text-sm text-gray-500">Administrá el equipo</p>
        </div>
        <Button onClick={() => { setEditing({ active: true }); setFormError(''); setSelectedServices([]) }}>
          <Plus className="w-4 h-4" /> Nuevo profesional
        </Button>
      </div>

      {/* Buscador */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, especialidad o centro…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center text-gray-400 py-10">Sin resultados</div>
          )}
          {filtered.map(p => (
            <div key={p.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 ${p.active ? '' : 'opacity-60'}`}>
              <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {p.avatar_url
                  ? <img src={p.avatar_url} alt={p.full_name} className="w-10 h-10 object-cover rounded-full" />
                  : <UserCircle className="w-6 h-6 text-sky-600" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900">{p.full_name}</div>
                <div className="text-sm text-gray-500">
                  {p.specialty ?? ''}
                  {p.specialty && (p as any).organizations?.name ? ' · ' : ''}
                  {(p as any).organizations?.name ?? ''}
                </div>
                {p.bio && <div className="text-xs text-gray-400 mt-0.5 truncate">{p.bio}</div>}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => { setEditing(p); setFormError('') }}
                  className="p-2 rounded-xl hover:bg-sky-50 text-gray-400 hover:text-sky-600 transition-colors"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggle(p)}
                  className={`p-2 rounded-xl transition-colors ${p.active ? 'hover:bg-amber-50 text-gray-400 hover:text-amber-500' : 'hover:bg-green-50 text-gray-400 hover:text-green-600'}`}
                  title={p.active ? 'Desactivar' : 'Activar'}
                >
                  <Power className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setConfirmDelete({ id: p.id, name: p.full_name })}
                  className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal editar / crear */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
              <h3 className="font-semibold">{editing.id ? 'Editar profesional' : 'Nuevo profesional'}</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Centro *</label>
                <select
                  value={editing.organization_id ?? ''}
                  onChange={e => {
                    setEditing(p => ({ ...p, organization_id: e.target.value }))
                    setSelectedServices([])
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">Seleccioná el centro</option>
                  {organizations.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
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
                  placeholder="Ej: Peluquería"
                />
              </div>

              {/* Servicios que ofrece */}
              {editing.organization_id && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">
                    Servicios que ofrece
                    <span className="ml-1 text-xs font-normal text-gray-400">(aparece en el flujo de reserva solo si tiene al menos uno)</span>
                  </label>
                  {orgServices.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">Este centro no tiene servicios activos.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {orgServices.map(s => {
                        const on = selectedServices.includes(s.id)
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleService(s.id)}
                            className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                              on
                                ? 'bg-sky-600 text-white border-sky-600'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-sky-300'
                            }`}
                          >
                            {s.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

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
            {formError && (
              <div className="px-5 pb-2">
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{formError}</div>
              </div>
            )}
            <div className="px-5 pb-5 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => { setEditing(null); setFormError(''); setSelectedServices([]) }}>Cancelar</Button>
              <Button className="flex-1" loading={saving} onClick={save}>Guardar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar borrado */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Eliminar profesional</h3>
            <p className="text-sm text-gray-500 mb-5">
              Vas a eliminar a <span className="font-medium text-gray-900">{confirmDelete.name}</span>. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
              <Button className="flex-1 !bg-red-600 hover:!bg-red-700" loading={deleting} onClick={handleDelete}>Eliminar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
