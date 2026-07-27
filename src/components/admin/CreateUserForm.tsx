import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Professional, UserRole, Organization } from '../../types'
import { Button } from '../ui/Button'

interface Props {
  /** true = usuario logueado es superadmin (ve todos los centros) */
  isSuperAdmin?: boolean
  /** organización del usuario logueado (para admin/recepción) */
  currentOrgId?: string | null
  /** Si viene definido, oculta el selector de rol y siempre crea con este rol */
  fixedRole?: UserRole
  /** Si viene definido, oculta el selector de profesional (usuario ya sabe a quién vincular) */
  fixedProfessionalId?: string
  /** Nombre a mostrar (solo lectura) cuando fixedProfessionalId está definido */
  fixedProfessionalName?: string
  /** Si viene definido, oculta el selector de centro */
  fixedOrganizationId?: string
  submitLabel?: string
  onSuccess: () => void
  onCancel?: () => void
}

export function CreateUserForm({
  isSuperAdmin = true,
  currentOrgId = null,
  fixedRole,
  fixedProfessionalId,
  fixedProfessionalName,
  fixedOrganizationId,
  submitLabel = 'Crear usuario',
  onSuccess,
  onCancel,
}: Props) {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')
  const [orgFilterForPro, setOrgFilterForPro] = useState('')

  const [form, setForm] = useState({
    email: '', password: '', full_name: '',
    role: fixedRole ?? ('medico' as UserRole),
    professional_id: fixedProfessionalId ?? '',
    organization_id: fixedOrganizationId ?? '',
  })

  const needsOrg          = !fixedOrganizationId && (form.role === 'recepcion' || form.role === 'admin')
  const needsProfessional = !fixedProfessionalId && form.role === 'medico'

  const availableProfessionals = professionals.filter(p => {
    if (isSuperAdmin) return !orgFilterForPro || p.organization_id === orgFilterForPro
    return p.organization_id === (currentOrgId ?? '')
  })

  useEffect(() => {
    if (!fixedProfessionalId) {
      supabase.from('professionals').select('id, full_name, organization_id').eq('active', true).order('full_name')
        .then(({ data }) => setProfessionals((data ?? []) as Professional[]))
    }
    if (!fixedOrganizationId) {
      supabase.from('organizations').select('id, name').eq('active', true).order('name')
        .then(({ data }) => setOrganizations((data ?? []) as Organization[]))
    }
  }, [fixedProfessionalId, fixedOrganizationId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.email || !form.password) { setError('Email y contrasena son obligatorios'); return }
    if (needsProfessional && !form.professional_id) { setError('Selecciona el profesional asociado'); return }
    if (needsOrg && !form.organization_id) { setError('Selecciona el centro al que pertenece el usuario'); return }
    setSaving(true)
    const { error: fnErr } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email:           form.email,
        password:        form.password,
        full_name:       form.full_name,
        role:            form.role,
        professional_id: fixedProfessionalId ?? (needsProfessional ? form.professional_id : null) ?? null,
        organization_id: fixedOrganizationId ?? (needsOrg ? form.organization_id : null) ?? null,
      },
    })
    if (fnErr) {
      setError(fnErr.message ?? 'Error al crear el usuario')
      setSaving(false)
      return
    }
    setSaving(false)
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">Nombre completo</label>
          <input
            value={form.full_name}
            onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="Ej: Brenda Lopez"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="usuario@email.com"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">Contrasena *</label>
          <input
            type="password"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="Minimo 6 caracteres"
            required
          />
        </div>

        {!fixedRole && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Rol *</label>
            <select
              value={form.role}
              onChange={e => {
                setOrgFilterForPro('')
                setForm(f => ({ ...f, role: e.target.value as UserRole, professional_id: '', organization_id: '' }))
              }}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {isSuperAdmin && <option value="globaladmin">Global Admin (Cofundador)</option>}
              {isSuperAdmin && <option value="comercial">Comercial (Sales)</option>}
              <option value="admin">Admin de centro</option>
              <option value="recepcion">Recepción</option>
              <option value="medico">Profesional</option>
            </select>
          </div>
        )}

        {fixedProfessionalName && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Profesional asociado</label>
            <div className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 text-gray-700">
              {fixedProfessionalName}
            </div>
          </div>
        )}

        {needsProfessional && isSuperAdmin && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Centro *</label>
            <select
              value={orgFilterForPro}
              onChange={e => {
                setOrgFilterForPro(e.target.value)
                setForm(f => ({ ...f, professional_id: '' }))
              }}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Selecciona un centro</option>
              {organizations.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}

        {needsProfessional && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Profesional asociado *</label>
            <select
              value={form.professional_id}
              onChange={e => {
                const profId = e.target.value
                const prof = professionals.find(p => p.id === profId)
                setForm(f => ({ ...f, professional_id: profId, organization_id: prof?.organization_id ?? '' }))
              }}
              disabled={isSuperAdmin && !orgFilterForPro}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {isSuperAdmin && !orgFilterForPro ? 'Primero elegí un centro' : 'Selecciona un profesional'}
              </option>
              {availableProfessionals.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Solo verá sus propios turnos.</p>
          </div>
        )}

        {needsOrg && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Centro *</label>
            <select
              value={form.organization_id}
              onChange={e => setForm(f => ({ ...f, organization_id: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Selecciona el centro</option>
              {organizations.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Solo vera los turnos de este centro.</p>
          </div>
        )}

        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}
      </div>
      <div className="pt-5 flex gap-3">
        {onCancel && (
          <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" className="flex-1" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
