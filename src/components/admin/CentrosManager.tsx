import { useEffect, useState } from 'react'
import { Plus, ExternalLink, Copy, Check, Building2, Pencil, X, Upload, ToggleLeft, ToggleRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { alpha } from '../../lib/color'
import type { TenantType } from '../../types'

interface Org {
  id: string
  name: string
  slug: string
  tenant_type: TenantType | null
  primary_color: string | null
  logo_url: string | null
  whatsapp_number: string | null
  address: string | null
  phone: string | null
  email: string | null
  active: boolean
  instagram_handle: string | null
}

const TENANT_LABELS: Record<string, { label: string; emoji: string }> = {
  medical:    { label: 'Salud',      emoji: '🏥' },
  beauty:     { label: 'Belleza',    emoji: '✂️' },
  estetica:   { label: 'Estética',   emoji: '✨' },
  petshop:    { label: 'Pet Shop',   emoji: '🐾' },
  veterinary: { label: 'Veterinaria',emoji: '🐶' },
  cancha:     { label: 'Canchas',    emoji: '⚽' },
  general:    { label: 'General',    emoji: '🏢' },
}

const BASE_URL = window.location.origin

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      title="Copiar link"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

interface EditModalProps {
  org: Org
  onClose: () => void
  onSaved: (updated: Org) => void
}

function EditModal({ org, onClose, onSaved }: EditModalProps) {
  const [form, setForm] = useState({
    name:             org.name,
    primary_color:    org.primary_color ?? '#0ea5e9',
    whatsapp_number:  org.whatsapp_number ?? '',
    address:          org.address ?? '',
    phone:            org.phone ?? '',
    email:            org.email ?? '',
    instagram_handle: org.instagram_handle ?? '',
    active:           org.active,
  })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [uploading, setUploading] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(org.logo_url)

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext  = file.name.split('.').pop()
    const path = org.slug + '.' + ext
    const { error: upErr } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) { setError('Error subiendo logo: ' + upErr.message); setUploading(false); return }
    const { data } = supabase.storage.from('logos').getPublicUrl(path)
    const url = data.publicUrl + '?t=' + Date.now()
    setLogoPreview(url)
    await supabase.from('organizations').update({ logo_url: url }).eq('id', org.id)
    setUploading(false)
  }

  const handleSave = async () => {
    setSaving(true); setError('')
    const { error: err } = await supabase.from('organizations').update({
      name:            form.name,
      primary_color:   form.primary_color,
      whatsapp_number: form.whatsapp_number || null,
      address:         form.address || null,
      phone:           form.phone || null,
      email:           form.email || null,
      instagram_handle: form.instagram_handle || null,
      active:          form.active,
      updated_at:      new Date().toISOString(),
    }).eq('id', org.id)
    if (err) { setError(err.message); setSaving(false); return }
    onSaved({ ...org, ...form, logo_url: logoPreview, primary_color: form.primary_color, instagram_handle: form.instagram_handle || null })
    onClose()
  }

  const accent = form.primary_color

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {logoPreview
              ? <img src={logoPreview} alt="" className="w-10 h-10 rounded-xl object-cover" />
              : <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: alpha(accent, 0.15) }}>
                  <Building2 className="w-5 h-5" style={{ color: accent }} />
                </div>
            }
            <div>
              <h2 className="font-bold text-gray-900">{org.name}</h2>
              <p className="text-xs text-gray-400">{BASE_URL}/{org.slug}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Logo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
            <label className="flex items-center gap-3 cursor-pointer">
              {logoPreview
                ? <img src={logoPreview} alt="" className="w-14 h-14 rounded-xl object-cover border border-gray-200" />
                : <div className="w-14 h-14 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-gray-400" />
                  </div>
              }
              <div>
                <span className="text-sm font-medium text-gray-700">
                  {uploading ? 'Subiendo...' : 'Cambiar logo'}
                </span>
                <p className="text-xs text-gray-400">PNG, JPG — recomendado 200×200px</p>
              </div>
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={uploading} />
            </label>
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre del centro</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2"
              style={{ ['--tw-ring-color' as string]: accent }}
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Color principal</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.primary_color}
                onChange={e => set('primary_color', e.target.value)}
                className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
              />
              <span className="text-sm text-gray-500 font-mono">{form.primary_color}</span>
              <div className="flex-1 h-8 rounded-lg" style={{ backgroundColor: alpha(accent, 0.2) }} />
            </div>
          </div>

          {/* WhatsApp */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp (con código de país)</label>
            <input
              value={form.whatsapp_number}
              onChange={e => set('whatsapp_number', e.target.value)}
              placeholder="+5491168887700"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2"
            />
          </div>

          {/* Dirección */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Dirección</label>
            <input
              value={form.address}
              onChange={e => set('address', e.target.value)}
              placeholder="Av. Corrientes 1234, CABA"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2"
            />
          </div>

          {/* Teléfono + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label>
              <input
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="011-4567-8900"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="contacto@centro.com"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2"
              />
            </div>
          </div>

          {/* Instagram */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Instagram (sin @)</label>
            <input
              value={form.instagram_handle}
              onChange={e => set('instagram_handle', e.target.value)}
              placeholder="nombre_del_negocio"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2"
            />
          </div>

          {/* Activo */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-gray-900">Centro activo</p>
              <p className="text-xs text-gray-500">Si está inactivo, la página pública muestra error 404</p>
            </div>
            <button onClick={() => set('active', !form.active)} className="transition-colors">
              {form.active
                ? <ToggleRight className="w-8 h-8 text-green-500" />
                : <ToggleLeft  className="w-8 h-8 text-gray-300" />}
            </button>
          </div>

          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

          {/* Acciones */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-60"
              style={{ backgroundColor: accent }}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CentrosManager({ userRole }: { userRole?: string }) {
  const [orgs, setOrgs]       = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Org | null>(null)

  const isSuperGlobal = userRole === 'superadmin' || userRole === 'globaladmin'

  useEffect(() => {
    supabase
      .from('organizations')
      .select('id,name,slug,tenant_type,primary_color,logo_url,whatsapp_number,address,phone,email,active')
      .order('name')
      .then(({ data }) => {
        setOrgs((data ?? []) as Org[])
        setLoading(false)
      })
  }, [])

  const handleSaved = (updated: Org) =>
    setOrgs(prev => prev.map(o => o.id === updated.id ? updated : o))

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Centros</h1>
          <p className="text-sm text-gray-500 mt-0.5">{orgs.length} centros registrados</p>
        </div>
        {isSuperGlobal && (
          <a
            href="/superadmin/nuevo-tenant"
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white text-sm font-medium rounded-xl hover:bg-sky-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo centro
          </a>
        )}
      </div>

      {/* Lista */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {orgs.map(org => {
          const accent    = org.primary_color ?? '#0ea5e9'
          const typeInfo  = TENANT_LABELS[org.tenant_type ?? 'general'] ?? TENANT_LABELS['general']
          const publicUrl = BASE_URL + '/' + org.slug

          return (
            <div
              key={org.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Color bar */}
              <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />

              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Logo / fallback */}
                  {org.logo_url
                    ? <img src={org.logo_url} alt={org.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                    : <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
                           style={{ backgroundColor: alpha(accent, 0.12) }}>
                        {typeInfo.emoji}
                      </div>
                  }

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 truncate">{org.name}</h3>
                      {!org.active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Inactivo</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-gray-400">{typeInfo.emoji} {typeInfo.label}</span>
                      <span className="text-gray-200">·</span>
                      <span className="text-xs text-gray-400 font-mono truncate">/{org.slug}</span>
                    </div>
                    {org.address && (
                      <p className="text-xs text-gray-400 mt-1 truncate">{org.address}</p>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-50">
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Ver reserva
                  </a>
                  <CopyButton text={publicUrl} />
                  {org.whatsapp_number && (
                    <a
                      href={'https://wa.me/' + org.whatsapp_number.replace(/\D/g,'')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    >
                      WhatsApp
                    </a>
                  )}
                  <div className="flex-1" />
                  {isSuperGlobal && (
                    <button
                      onClick={() => setEditing(org)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                      style={{ color: accent, backgroundColor: alpha(accent, 0.08) }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Editar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {editing && (
        <EditModal
          org={editing}
          onClose={() => setEditing(null)}
          onSaved={updated => { handleSaved(updated); setEditing(null) }}
        />
      )}
    </div>
  )
}
