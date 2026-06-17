import { useEffect, useState } from 'react'
import { Plus, UserCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Profile, Professional, UserRole } from '../../types'
import type { Organization } from '../../types'
import { Button } from '../ui/Button'

const ROLE_CONFIG: Record<UserRole, { label: string; className: string }> = {
  superadmin: { label: 'Superadmin',  className: 'bg-purple-100 text-purple-800' },
  admin:      { label: 'Admin',        className: 'bg-sky-100 text-sky-800' },
  recepcion:  { label: 'Recepcion',    className: 'bg-green-100 text-green-800' },
  medico:     { label: 'Medico',       className: 'bg-amber-100 text-amber-800' },
  paciente:   { label: 'Paciente',     className: 'bg-gray-100 text-gray-600' },
}

interface UserRow extends Profile {
  email?: string
}

export function UserManager() {
  const [users, setUsers]                 = useState<UserRow[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading]             = useState(true)
  const [creating, setCreating]           = useState(false)
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')

  const [form, setForm] = useState({
    email: '', password: '', full_name: '',
    role: 'medico' as UserRole,
    professional_id: '',
    organization_id: '',
  })

  const needsOrg = form.role === 'recepcion' || form.role === 'admin'
  const needsProfessional = form.role === 'medico'

  const load = async () => {
    setLoading(true)
    const [pRes, profRes, orgRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('professionals').select('id, full_name, organization_id').eq('active', true).order('full_name'),
      supabase.from('organizations').select('id, name').eq('active', true).order('name'),
    ])
    setUsers((pRes.data ?? []) as UserRow[])
    setProfessionals((profRes.data ?? []) as Professional[])
    setOrganizations((orgRes.data ?? []) as Organization[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.email || !form.password) { setError('Email y contrasena son obligatorios'); return }
    if (needsProfessional && !form.professional_id) {
      setError('Selecciona el profesional asociado'); return
    }
    if (needsOrg && !form.organization_id) {
      setError('Selecciona el centro al que pertenece el usuario'); return
    }
    setSaving(true)
    const { error: fnErr } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email:           form.email,
        password:        form.password,
        full_name:       form.full_name,
        role:            form.role,
        professional_id: needsProfessional ? form.professional_id : null,
        organization_id: needsOrg ? form.organization_id : null,
      },
    })
    if (fnErr) {
      setError(fnErr.message ?? 'Error al crear el usuario')
    } else {
      setCreating(false)
      setForm({ email: '', password: '', full_name: '', role: 'medico', professional_id: '', organization_id: '' })
      await load()
    }
    setSaving(false)
  }

  const changeRole = async (id: string, role: UserRole) => {
    await supabase.from('profiles').update({ role }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u))
  }

  // Org name for display
  const orgName = (orgId: string | null | undefined) => {
    if (!orgId) return null
    return organizations.find(o => o.id === orgId)?.name ?? null
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500">Gestiona el acceso al sistema</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4" /> Nuevo usuario
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {users.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No hay usuarios registrados</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {users.map(u => {
                const cfg = ROLE_CONFIG[u.role]
                const org = orgName((u as any).organization_id)
                return (
                  <div key={u.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                      <UserCircle className="w-5 h-5 text-sky-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">{u.full_name ?? '—'}</div>
                      <div className="text-xs text-gray-400">
                        {org ? org : u.id.slice(0,8) + '…'}
                      </div>
                    </div>
                    <select
                      value={u.role}
                      onChange={e => changeRole(u.id, e.target.value as UserRole)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      {Object.entries(ROLE_CONFIG).map(([r, c]) => (
                        <option key={r} value={r}>{c.label}</option>
                      ))}
                    </select>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.className}`}>
                      {cfg.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Nuevo usuario</h3>
            </div>
            <form onSubmit={handleCreate}>
              <div className="p-5 space-y-4">
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
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Rol *</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole, professional_id: '', organization_id: '' }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="admin">Admin</option>
                    <option value="recepcion">Recepcion</option>
                    <option value="medico">Medico / Profesional</option>
                  </select>
                </div>

                {needsProfessional && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Profesional asociado *</label>
                    <select
                      value={form.professional_id}
                      onChange={e => setForm(f => ({ ...f, professional_id: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="">Selecciona un profesional</option>
                      {professionals.map(p => {
                        const org = orgName(p.organization_id)
                        return (
                          <option key={p.id} value={p.id}>
                            {p.full_name}{org ? ` (${org})` : ''}
                          </option>
                        )
                      })}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Solo vera sus propios turnos.</p>
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
              <div className="px-5 pb-5 flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => { setCreating(false); setError('') }}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" loading={saving}>
                  Crear usuario
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
