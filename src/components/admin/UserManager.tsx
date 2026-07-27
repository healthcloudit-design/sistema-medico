import { useEffect, useState } from 'react'
import { Plus, UserCircle, Trash2, KeyRound, Pencil, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Profile, UserRole } from '../../types'
import type { Organization } from '../../types'
import { Button } from '../ui/Button'
import { CreateUserForm } from './CreateUserForm'

const ROLE_CONFIG: Record<UserRole, { label: string; className: string }> = {
  superadmin:  { label: 'Superadmin',   className: 'bg-purple-100 text-purple-800' },
  globaladmin: { label: 'Global Admin', className: 'bg-indigo-100 text-indigo-800' },
  comercial:   { label: 'Comercial',    className: 'bg-cyan-100 text-cyan-800'    },
  admin:      { label: 'Admin',        className: 'bg-sky-100 text-sky-800' },
  recepcion:  { label: 'Recepcion',    className: 'bg-green-100 text-green-800' },
  medico:     { label: 'Medico',       className: 'bg-amber-100 text-amber-800' },
  paciente:   { label: 'Paciente',     className: 'bg-gray-100 text-gray-600' },
}

interface UserRow extends Profile {
  email?: string
}

interface Props {
  /** true = usuario logueado es superadmin (ve todos los centros) */
  isSuperAdmin?: boolean
  /** organización del usuario logueado (para admin/recepción) */
  currentOrgId?: string | null
}

export function UserManager({ isSuperAdmin = true, currentOrgId = null }: Props) {
  const [users, setUsers]                 = useState<UserRow[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading]             = useState(true)
  const [creating, setCreating]           = useState(false)
  const [error, setError]                 = useState('')
  const [confirmDelete, setConfirmDelete]   = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting]             = useState(false)
  const [resetTarget, setResetTarget]       = useState<{ id: string; name: string } | null>(null)
  const [newPassword, setNewPassword]       = useState('')
  const [resetting, setResetting]           = useState(false)
  const [resetSuccess, setResetSuccess]     = useState(false)
  const [editTarget, setEditTarget]         = useState<{ id: string; full_name: string; email: string } | null>(null)
  const [editName, setEditName]             = useState('')
  const [editEmail, setEditEmail]           = useState('')
  const [editError, setEditError]           = useState('')
  const [editSaving, setEditSaving]         = useState(false)
  const [search, setSearch]                 = useState('')

  const load = async () => {
    setLoading(true)
    const [pRes, orgRes, emailRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('organizations').select('id, name').eq('active', true).order('name'),
      supabase.rpc('get_user_emails'),
    ])
    const emailById = new Map(
      ((emailRes.data ?? []) as { id: string; email: string }[]).map(r => [r.id, r.email])
    )
    const rows = ((pRes.data ?? []) as UserRow[]).map(u => ({ ...u, email: emailById.get(u.id) }))
    setUsers(rows)
    setOrganizations((orgRes.data ?? []) as Organization[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    const { error: fnErr } = await supabase.functions.invoke('admin-delete-user', {
      body: { user_id: confirmDelete.id },
    })
    if (fnErr) {
      setError(fnErr.message ?? 'Error al eliminar el usuario')
    } else {
      setUsers(prev => prev.filter(u => u.id !== confirmDelete.id))
    }
    setConfirmDelete(null)
    setDeleting(false)
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetTarget) return
    setResetting(true)
    setError('')
    const { error: fnErr } = await supabase.functions.invoke('admin-reset-password', {
      body: { user_id: resetTarget.id, new_password: newPassword },
    })
    if (fnErr) {
      setError(fnErr.message ?? 'Error al resetear la contrasena')
    } else {
      setResetSuccess(true)
      setTimeout(() => {
        setResetTarget(null)
        setNewPassword('')
        setResetSuccess(false)
      }, 1500)
    }
    setResetting(false)
  }

  const changeRole = async (id: string, role: UserRole) => {
    await supabase.from('profiles').update({ role }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u))
  }

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    setEditError('')
    setEditSaving(true)

    if (editName !== editTarget.full_name) {
      const { error: nameErr } = await supabase.from('profiles').update({ full_name: editName }).eq('id', editTarget.id)
      if (nameErr) { setEditError('No se pudo actualizar el nombre: ' + nameErr.message); setEditSaving(false); return }
    }

    if (editEmail !== editTarget.email) {
      const { error: fnErr } = await supabase.functions.invoke('admin-update-email', {
        body: { user_id: editTarget.id, new_email: editEmail },
      })
      if (fnErr) { setEditError(fnErr.message ?? 'No se pudo actualizar el email'); setEditSaving(false); return }
    }

    setUsers(prev => prev.map(u => u.id === editTarget.id ? { ...u, full_name: editName, email: editEmail } : u))
    setEditTarget(null)
    setEditSaving(false)
  }

  const filtered = users.filter(u =>
    (u.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u as any).email?.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  )

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

      {/* Buscador */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email o rol…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Sin resultados</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(u => {
                const cfg = ROLE_CONFIG[u.role]
                const org = orgName((u as any).organization_id)
                return (
                  <div key={u.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                      <UserCircle className="w-5 h-5 text-sky-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">{u.full_name ?? '—'}</div>
                      <div className="text-xs text-gray-400 truncate">
                        {[((u as any).email as string | undefined), org].filter(Boolean).join(' · ') || u.id.slice(0,8) + '…'}
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
                    <button
                      onClick={() => {
                        const email = (u as any).email ?? ''
                        setEditTarget({ id: u.id, full_name: u.full_name ?? '', email })
                        setEditName(u.full_name ?? '')
                        setEditEmail(email)
                        setEditError('')
                      }}
                      className="p-1.5 text-gray-300 hover:text-sky-500 hover:bg-sky-50 rounded-lg transition-colors"
                      title="Editar usuario"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setResetTarget({ id: u.id, name: u.full_name ?? u.id }); setNewPassword(''); setResetSuccess(false) }}
                      className="p-1.5 text-gray-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                      title="Resetear contrasena"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ id: u.id, name: u.full_name ?? u.id })}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar usuario"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal editar usuario */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-1">Editar usuario</h3>
            <p className="text-sm text-gray-500 mb-4">Modificá los datos de <span className="font-medium text-gray-900">{editTarget.full_name || 'este usuario'}</span></p>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nombre completo</label>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Nombre completo"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  placeholder="usuario@email.com"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <p className="text-xs text-gray-400 mt-1">El usuario deberá usar este email para iniciar sesión.</p>
              </div>
              {editError && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{editError}</div>}
              <div className="flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditTarget(null)}>Cancelar</Button>
                <Button type="submit" className="flex-1" loading={editSaving}>Guardar</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal reset password */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-1">Resetear contrasena</h3>
            <p className="text-sm text-gray-500 mb-4">
              Nueva contrasena para <span className="font-medium text-gray-900">{resetTarget.name}</span>
            </p>
            <form onSubmit={handleReset} className="space-y-4">
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Nueva contrasena (min. 6 caracteres)"
                minLength={6}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}
              {resetSuccess && <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl">Contrasena actualizada</div>}
              <div className="flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => { setResetTarget(null); setError('') }}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" loading={resetting}>
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmar borrado */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Eliminar usuario</h3>
            <p className="text-sm text-gray-500 mb-5">
              Vas a eliminar a <span className="font-medium text-gray-900">{confirmDelete.name}</span>.
              Esta accion no se puede deshacer.
            </p>
            {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}
            <div className="flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => { setConfirmDelete(null); setError('') }}>
                Cancelar
              </Button>
              <Button type="button" className="flex-1 !bg-red-600 hover:!bg-red-700" loading={deleting} onClick={handleDelete}>
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
              <h3 className="font-semibold text-gray-900">Nuevo usuario</h3>
            </div>
            <div className="p-5">
              <CreateUserForm
                isSuperAdmin={isSuperAdmin}
                currentOrgId={currentOrgId}
                onCancel={() => setCreating(false)}
                onSuccess={() => { setCreating(false); load() }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
