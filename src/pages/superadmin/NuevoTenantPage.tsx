import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Upload, Check, AlertCircle, ExternalLink, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { TenantType } from '../../types'

const TENANT_OPTIONS: { value: TenantType; label: string; emoji: string; hint: string }[] = [
  { value: 'medical',    label: 'Centro Médico',       emoji: '🩺', hint: 'Consultas, especialidades, HC' },
  { value: 'beauty',     label: 'Peluquería / Beauty', emoji: '✂️', hint: 'Cortes, color, manicuría' },
  { value: 'estetica',   label: 'Centro Estético',     emoji: '💆', hint: 'Tratamientos, uñas, estética' },
  { value: 'cancha',     label: 'Canchas',             emoji: '⚽', hint: 'Fútbol, pádel, deportes' },
  { value: 'petshop',    label: 'Pet Shop',            emoji: '🐾', hint: 'Baño, peluquería, accesorios' },
  { value: 'veterinary', label: 'Veterinaria',         emoji: '🐕', hint: 'Consultas, vacunas, cirugía' },
  { value: 'general',    label: 'General',             emoji: '🏢', hint: 'Cualquier rubro' },
]

interface FormState {
  name: string; slug: string; tenant_type: TenantType
  whatsapp: string; primary_color: string
  address: string; phone: string; email: string
}

const INITIAL: FormState = {
  name: '', slug: '', tenant_type: 'medical',
  whatsapp: '', primary_color: '#0ea5e9',
  address: '', phone: '', email: '',
}

function slugify(str: string) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-')
}

export function NuevoTenantPage() {
  const navigate                    = useNavigate()
  const [form, setForm]             = useState<FormState>(INITIAL)
  const [logoFile, setLogoFile]     = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploading, setUploading]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [done, setDone]             = useState<{ slug: string } | null>(null)
  const [slugEdited, setSlugEdited] = useState(false)
  const fileRef                     = useRef<HTMLInputElement>(null)

  const set = (k: keyof FormState, v: string) =>
    setForm(prev => {
      const next = { ...prev, [k]: v }
      if (k === 'name' && !slugEdited) next.slug = slugify(v)
      return next
    })

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return null
    setUploading(true)
    const ext  = logoFile.name.split('.').pop()
    const path = form.slug + '-logo.' + ext
    const { error: upErr } = await supabase.storage.from('logos').upload(path, logoFile, { upsert: true })
    setUploading(false)
    if (upErr) { setError('Error subiendo logo: ' + upErr.message); return null }
    return supabase.storage.from('logos').getPublicUrl(path).data.publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    if (!form.slug.trim()) { setError('El slug es obligatorio'); return }
    if (!/^[a-z0-9-]+$/.test(form.slug)) { setError('El slug solo puede tener letras minúsculas, números y guiones'); return }
    setSaving(true)
    const logoUrl = await uploadLogo()
    if (logoFile && !logoUrl) { setSaving(false); return }
    const { data, error: rpcErr } = await supabase.rpc('crear_tenant', {
      p_name:          form.name,
      p_slug:          form.slug,
      p_tenant_type:   form.tenant_type,
      p_whatsapp:      form.whatsapp      || null,
      p_primary_color: form.primary_color,
      p_logo_url:      logoUrl            || null,
      p_address:       form.address       || null,
      p_phone:         form.phone         || null,
      p_email:         form.email         || null,
    })
    setSaving(false)
    if (rpcErr) { setError('Error: ' + rpcErr.message); return }
    const result = data as { id?: string; slug?: string; error?: string }
    if (result?.error === 'slug_taken') { setError('Ese slug ya está en uso. Elegí otro.'); return }
    if (result?.error) { setError('Error: ' + result.error); return }
    setDone({ slug: result.slug! })
  }

  const resetForm = () => {
    setDone(null); setForm(INITIAL); setLogoFile(null)
    setLogoPreview(null); setSlugEdited(false); setError('')
  }

  if (done) return (
    <div className="max-w-lg mx-auto py-16 px-4 text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Check className="w-8 h-8 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Cliente dado de alta</h2>
      <p className="text-gray-500 mb-6">
        El tenant <span className="font-mono font-semibold text-gray-800">/{done.slug}</span> está listo.
      </p>
      <div className="bg-sky-50 rounded-2xl p-4 text-left text-sm text-sky-800 mb-6 space-y-1">
        <p className="font-semibold mb-2">Próximos pasos:</p>
        <p>1. Cargar los profesionales desde el panel admin</p>
        <p>2. Configurar los horarios de cada profesional</p>
        <p>3. Crear usuario admin para el cliente</p>
      </div>
      <div className="flex gap-3">
        <a href={'/' + done.slug} target="_blank" rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 bg-sky-600 text-white py-3 rounded-xl font-medium hover:bg-sky-700 transition-colors text-sm">
          <ExternalLink className="w-4 h-4" /> Ver página pública
        </a>
        <button onClick={resetForm}
          className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm">
          Crear otro
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
          <Building2 className="w-5 h-5 text-sky-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nuevo cliente</h1>
          <p className="text-sm text-gray-400">Alta de tenant + servicios base en un solo paso</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Tipo de negocio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de negocio</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TENANT_OPTIONS.map(opt => (
              <button key={opt.value} type="button" onClick={() => set('tenant_type', opt.value)}
                className={['flex flex-col gap-1 p-3 rounded-xl border-2 text-left transition-all',
                  form.tenant_type === opt.value ? 'border-sky-500 bg-sky-50' : 'border-gray-200 hover:border-gray-300'].join(' ')}>
                <span className="text-lg">{opt.emoji}</span>
                <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                <span className="text-xs text-gray-400">{opt.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Nombre + Slug */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Ej: Centro Médico Norte"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              URL (slug) <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-sky-500">
              <span className="px-3 py-3 bg-gray-50 text-gray-400 text-xs border-r border-gray-200 whitespace-nowrap">turnos.app/</span>
              <input type="text" value={form.slug}
                onChange={e => { setSlugEdited(true); set('slug', slugify(e.target.value)) }}
                placeholder="mi-centro"
                className="flex-1 px-3 py-3 text-sm focus:outline-none" />
            </div>
          </div>
        </div>

        {/* Logo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Logo</label>
          <div onClick={() => fileRef.current?.click()}
            className="flex items-center gap-4 p-4 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-sky-400 hover:bg-sky-50 transition-all">
            {logoPreview
              ? <img src={logoPreview} alt="preview" className="w-16 h-16 object-contain rounded-lg" />
              : <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-400" />
                </div>
            }
            <div>
              <p className="text-sm font-medium text-gray-700">{logoFile ? logoFile.name : 'Subir logo'}</p>
              <p className="text-xs text-gray-400">PNG, JPG o WebP · máx 2MB</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onLogoChange} className="hidden" />
        </div>

        {/* Color + WhatsApp */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Color primario</label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.primary_color} onChange={e => set('primary_color', e.target.value)}
                className="w-12 h-12 rounded-xl border border-gray-200 cursor-pointer p-1" />
              <input type="text" value={form.primary_color} onChange={e => set('primary_color', e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-mono" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp</label>
            <input type="tel" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)}
              placeholder="+54 9 11 1234-5678"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
          </div>
        </div>

        {/* Opcionales */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Datos adicionales (opcional)</p>
          <input type="text" value={form.address} onChange={e => set('address', e.target.value)}
            placeholder="Dirección"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
              placeholder="Teléfono fijo"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="Email del centro"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <button type="submit" disabled={saving || uploading}
          className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white py-3.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
          {(saving || uploading) && <Loader2 className="w-4 h-4 animate-spin" />}
          {uploading ? 'Subiendo logo...' : saving ? 'Creando tenant...' : 'Crear cliente'}
        </button>
      </form>
    </div>
  )
}
