import { useState, useRef } from 'react'
import { Search, UserCircle, Phone, Mail, CreditCard, Heart, Hash, Pencil, CalendarPlus, X, Save, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Patient {
  id: string
  full_name: string
  phone?: string
  email?: string
  dni?: string
  obra_social?: string
  nro_socio?: string
  notes?: string
  last_appointment?: { starts_at: string; status: string; professionals?: { full_name: string } }
}

type NewPatientForm = Omit<Patient, 'id' | 'last_appointment'>

const BLANK_NEW_PATIENT: NewPatientForm = {
  full_name: '', phone: '', email: '', dni: '', obra_social: '', nro_socio: '', notes: '',
}

interface Props {
  orgId?: string | null
  professionalId?: string | null
  /** Permite editar la ficha del paciente (solo recepción/admin) */
  canEdit?: boolean
  /** Si se pasa, muestra un botón "Nuevo turno" por paciente */
  onNewAppointment?: (patient: Patient) => void
}

export function PatientSearch({ orgId, professionalId, canEdit = false, onNewAppointment }: Props) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<Patient[]>([])
  const [loading, setLoading]   = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [editing, setEditing]   = useState<Patient | null>(null)
  const [editForm, setEditForm] = useState<Patient | null>(null)
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError] = useState('')

  const [creating, setCreating]         = useState(false)
  const [createForm, setCreateForm]     = useState<NewPatientForm>(BLANK_NEW_PATIENT)
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError]   = useState('')
  const [createdOk, setCreatedOk]       = useState(false)

  const search = async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setSearched(false); return }
    setLoading(true)
    setSearched(true)

    let allowedPatientIds: string[] | null = null
    if (professionalId) {
      const { data: apptData } = await supabase
        .from('appointments')
        .select('patient_id')
        .eq('professional_id', professionalId)
        .not('patient_id', 'is', null)
      allowedPatientIds = Array.from(new Set((apptData ?? []).map((a: any) => String(a.patient_id)))) as string[]
    }

    let baseQuery = supabase
      .from('patients')
      .select('id, full_name, phone, email, dni, obra_social, nro_socio, notes, appointments(starts_at, status)')
      .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,dni.ilike.%${q}%,obra_social.ilike.%${q}%,nro_socio.ilike.%${q}%`)
      .order('full_name')
      .limit(25)

    if (orgId) baseQuery = baseQuery.eq('organization_id', orgId)
    if (allowedPatientIds && allowedPatientIds.length > 0) {
      baseQuery = baseQuery.in('id', allowedPatientIds)
    } else if (allowedPatientIds !== null && allowedPatientIds.length === 0) {
      setResults([])
      setLoading(false)
      return
    }

    const { data } = await baseQuery

    const mapped: Patient[] = (data ?? []).map((p: any) => {
      const appts = (p.appointments ?? []).sort(
        (a: any, b: any) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
      )
      return { ...p, last_appointment: appts[0] ?? null }
    })

    setResults(mapped)
    setLoading(false)
  }

  const openEdit = (p: Patient) => {
    setEditing(p)
    setEditForm({ ...p })
    setSaveError('')
  }

  const openCreate = () => {
    setCreateForm(BLANK_NEW_PATIENT)
    setCreateError('')
    setCreatedOk(false)
    setCreating(true)
  }

  const saveCreate = async () => {
    if (!orgId) { setCreateError('No se encontró el centro. Recargá la página e intentá de nuevo.'); return }
    if (!createForm.full_name.trim()) { setCreateError('El nombre es obligatorio'); return }
    setCreateSaving(true); setCreateError('')
    const { data, error } = await supabase
      .from('patients')
      .insert({
        organization_id: orgId,
        full_name:   createForm.full_name.trim(),
        phone:       createForm.phone || null,
        email:       createForm.email || null,
        dni:         createForm.dni || null,
        obra_social: createForm.obra_social || null,
        nro_socio:   createForm.nro_socio || null,
        notes:       createForm.notes || null,
      })
      .select('id, full_name, phone, email, dni, obra_social, nro_socio, notes')
      .single()
    if (error || !data) {
      setCreateError(
        error?.code === '23505'
          ? 'Ya existe un paciente con esos datos.'
          : 'No se pudo guardar. Intentá de nuevo.'
      )
      setCreateSaving(false)
      return
    }
    setResults(prev => [{ ...data } as Patient, ...prev])
    setCreateSaving(false)
    setCreatedOk(true)
    setTimeout(() => { setCreating(false); setCreatedOk(false) }, 900)
  }

  const saveEdit = async () => {
    if (!editing || !editForm) return
    if (!editForm.full_name?.trim()) { setSaveError('El nombre es obligatorio'); return }
    setSaving(true); setSaveError('')
    const { error } = await supabase
      .from('patients')
      .update({
        full_name:   editForm.full_name,
        phone:       editForm.phone || null,
        email:       editForm.email || null,
        dni:         editForm.dni || null,
        obra_social: editForm.obra_social || null,
        nro_socio:   editForm.nro_socio || null,
        notes:       editForm.notes || null,
      })
      .eq('id', editing.id)
    if (error) {
      setSaveError('No se pudo guardar. Intentá de nuevo.')
      setSaving(false)
      return
    }
    setResults(prev => prev.map(p => p.id === editing.id ? { ...p, ...editForm } : p))
    setSaving(false)
    setEditing(null)
    setEditForm(null)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 350)
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  const STATUS_LABEL: Record<string, string> = {
    pendiente:  'Pendiente',
    confirmado: 'Confirmado',
    cancelado:  'Cancelado',
    no_asistio: 'No asistio',
    completado: 'Completado',
  }

  const STATUS_COLOR: Record<string, string> = {
    pendiente:  'bg-yellow-100 text-yellow-800',
    confirmado: 'bg-green-100 text-green-800',
    cancelado:  'bg-red-100 text-red-800',
    no_asistio: 'bg-gray-100 text-gray-600',
    completado: 'bg-blue-100 text-blue-800',
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          {loading && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          )}
          <input
            value={query}
            onChange={handleChange}
            placeholder="Buscar por nombre, DNI, telefono, email u obra social..."
            className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
            autoComplete="off"
          />
        </div>
        {canEdit && (
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-medium bg-sky-500 hover:bg-sky-600 text-white transition-colors flex-shrink-0">
            <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Agregar paciente</span>
          </button>
        )}
      </div>

      {!searched && (
        <p className="text-xs text-gray-400 text-center">Escribi al menos 2 caracteres para buscar</p>
      )}

      {searched && !loading && results.length === 0 && (
        <div className="text-center py-10 text-gray-400">
          <UserCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No se encontraron pacientes</p>
        </div>
      )}

      <div className="space-y-3">
        {results.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                <UserCircle className="w-5 h-5 text-sky-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900">{p.full_name}</div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                  {p.dni && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Hash className="w-3 h-3" /> DNI {p.dni}
                    </span>
                  )}
                  {p.phone && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Phone className="w-3 h-3" /> {p.phone}
                    </span>
                  )}
                  {p.email && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Mail className="w-3 h-3" /> {p.email}
                    </span>
                  )}
                  {p.obra_social && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Heart className="w-3 h-3" /> {p.obra_social}
                      {p.nro_socio && <span className="text-gray-400">#{p.nro_socio}</span>}
                    </span>
                  )}
                  {!p.obra_social && p.nro_socio && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <CreditCard className="w-3 h-3" /> Socio #{p.nro_socio}
                    </span>
                  )}
                </div>
                {p.notes && (
                  <p className="mt-1 text-xs text-gray-400 truncate">{p.notes}</p>
                )}
                {p.last_appointment && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      Ultimo turno: {formatDate(p.last_appointment.starts_at)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[p.last_appointment.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[p.last_appointment.status] ?? p.last_appointment.status}
                    </span>
                  </div>
                )}
                {(canEdit || onNewAppointment) && (
                  <div className="mt-3 flex gap-2">
                    {onNewAppointment && (
                      <button onClick={() => onNewAppointment(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors">
                        <CalendarPlus className="w-3.5 h-3.5" /> Nuevo turno
                      </button>
                    )}
                    {canEdit && (
                      <button onClick={() => openEdit(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors">
                        <Pencil className="w-3.5 h-3.5" /> Editar datos
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal editar paciente */}
      {editing && editForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h3 className="font-semibold text-gray-900">Editar paciente</h3>
              <button onClick={() => { setEditing(null); setEditForm(null) }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input value={editForm.full_name} onChange={e => setEditForm(f => f && ({ ...f, full_name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input value={editForm.phone ?? ''} onChange={e => setEditForm(f => f && ({ ...f, phone: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={editForm.email ?? ''} onChange={e => setEditForm(f => f && ({ ...f, email: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DNI</label>
                  <input value={editForm.dni ?? ''} onChange={e => setEditForm(f => f && ({ ...f, dni: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Obra social</label>
                  <input value={editForm.obra_social ?? ''} onChange={e => setEditForm(f => f && ({ ...f, obra_social: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nro de obra social</label>
                <input value={editForm.nro_socio ?? ''} onChange={e => setEditForm(f => f && ({ ...f, nro_socio: e.target.value }))}
                  placeholder="Nro de obra social"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea value={editForm.notes ?? ''} onChange={e => setEditForm(f => f && ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              {saveError && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{saveError}</div>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => { setEditing(null); setEditForm(null) }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal agregar paciente */}
      {creating && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h3 className="font-semibold text-gray-900">Agregar paciente</h3>
              <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input value={createForm.full_name} onChange={e => setCreateForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input value={createForm.phone ?? ''} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={createForm.email ?? ''} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DNI</label>
                  <input value={createForm.dni ?? ''} onChange={e => setCreateForm(f => ({ ...f, dni: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Obra social</label>
                  <input value={createForm.obra_social ?? ''} onChange={e => setCreateForm(f => ({ ...f, obra_social: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nro de obra social</label>
                <input value={createForm.nro_socio ?? ''} onChange={e => setCreateForm(f => ({ ...f, nro_socio: e.target.value }))}
                  placeholder="Nro de obra social"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea value={createForm.notes ?? ''} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              {createError && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{createError}</div>
              )}
              {createdOk && (
                <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl">Paciente creado correctamente.</div>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setCreating(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={saveCreate} disabled={createSaving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
                <Save className="w-4 h-4" /> {createSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
