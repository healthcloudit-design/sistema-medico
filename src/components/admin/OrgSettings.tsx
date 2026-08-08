import { useEffect, useRef, useState } from 'react'
import { Upload, X, Check, ImageIcon, Palette, Globe, Stethoscope, CreditCard, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Organization } from '../../types'

// ── Design tokens (PRAXIS) ───────────────────────────────────────────────────
const P800  = '#0F2830'
const P600  = '#1A3F4E'
const GOLD  = '#C9A96E'
const BG    = '#EEF1F5'
const CARD  = '#FFFFFF'
const BD    = '#E2E8F0'
const T1    = '#0F172A'
const T2    = '#475569'
const T3    = '#94A3B8'
const ERR   = '#EF4444'
const OK    = '#10B981'

const SPECIALTIES = [
  { value: '',                label: '— Sin especialidad —' },
  { value: 'oftalmologia',    label: 'Oftalmología' },
  { value: 'pediatria',       label: 'Pediatría' },
  { value: 'kinesiologia',    label: 'Kinesiología & Fisioterapia' },
  { value: 'dermatologia',    label: 'Dermatología' },
  { value: 'medicinaEstetica',label: 'Medicina Estética' },
  { value: 'cardiologia',     label: 'Cardiología' },
  { value: 'odontologia',     label: 'Odontología' },
  { value: 'nutricion',       label: 'Nutrición' },
  { value: 'psicologia',      label: 'Psicología' },
  { value: 'traumatologia',   label: 'Traumatología' },
  { value: 'ginecologia',     label: 'Ginecología & Obstetricia' },
  { value: 'neurologia',      label: 'Neurología' },
  { value: 'gastroenterologia',label:'Gastroenterología' },
  { value: 'endocrinologia',  label: 'Endocrinología' },
  { value: 'clinicamedica',   label: 'Clínica Médica' },
  { value: 'masajes',         label: 'Masajes & Bienestar' },
  { value: 'beauty',          label: 'Peluquería & Belleza' },
  { value: 'estetica',        label: 'Estética de Autor' },
]

interface Props {
  organizationId: string | null | undefined
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function OrgSettings({ organizationId }: Props) {
  const [org, setOrg]         = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)

  // Editable fields
  const [name, setName]               = useState('')
  const [specialty, setSpecialty]     = useState('')
  const [primaryColor, setPrimaryColor] = useState('#C9A96E')
  const [headline, setHeadline]       = useState('')
  const [bookingWeeks, setBookingWeeks] = useState<1 | 2>(1)
  const [address, setAddress]         = useState('')
  const [phone, setPhone]             = useState('')
  const [whatsapp, setWhatsapp]       = useState('')
  const [instagram, setInstagram]     = useState('')

  // Image states
  const [coverUrl, setCoverUrl]         = useState<string | null>(null)
  const [logoUrl, setLogoUrl]           = useState<string | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingLogo, setUploadingLogo]   = useState(false)
  const [uploadError, setUploadError]       = useState<string | null>(null)

  const [saveState, setSaveState] = useState<SaveState>('idle')

  // Mercado Pago (por tenant) — el token nunca se lee de vuelta al frontend, solo se sabe si hay uno configurado.
  const [mpConfigured, setMpConfigured] = useState(false)
  const [mpTokenInput, setMpTokenInput] = useState('')
  const [mpSaveState, setMpSaveState]   = useState<SaveState>('idle')

  const coverRef = useRef<HTMLInputElement>(null)
  const logoRef  = useRef<HTMLInputElement>(null)

  // ── Load org ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!organizationId) { setLoading(false); return }
    supabase.from('organizations').select('*').eq('id', organizationId).single()
      .then(({ data }) => {
        if (!data) { setLoading(false); return }
        const o = data as Organization
        setOrg(o)
        setName(o.name ?? '')
        setSpecialty((o as any).specialty ?? '')
        setPrimaryColor(o.primary_color ?? '#C9A96E')
        setHeadline((o as any).booking_headline ?? '')
        setBookingWeeks((o as any).booking_weeks === 2 ? 2 : 1)
        setAddress(o.address ?? '')
        setPhone(o.phone ?? '')
        setWhatsapp(o.whatsapp_number ?? '')
        setInstagram(o.instagram_handle ?? '')
        setCoverUrl(o.cover_image_url ?? null)
        setLogoUrl(o.logo_url ?? null)
        setLoading(false)
      })

    // Solo chequea si existe un token propio, nunca trae el valor real.
    supabase
      .from('organization_payment_credentials')
      .select('organization_id')
      .eq('organization_id', organizationId)
      .maybeSingle()
      .then(({ data }) => setMpConfigured(!!data))
  }, [organizationId])

  async function saveMpToken() {
    if (!organizationId || !mpTokenInput.trim()) return
    setMpSaveState('saving')
    const { error } = await supabase
      .from('organization_payment_credentials')
      .upsert({
        organization_id: organizationId,
        mp_access_token: mpTokenInput.trim(),
        updated_at: new Date().toISOString(),
      })
    if (error) { setMpSaveState('error'); return }
    setMpConfigured(true)
    setMpTokenInput('')
    setMpSaveState('saved')
    setTimeout(() => setMpSaveState('idle'), 2500)
  }

  // ── Upload helper ─────────────────────────────────────────────────────────
  async function uploadImage(
    file: File,
    field: 'cover_image_url' | 'logo_url',
    setUploading: (v: boolean) => void,
    setUrl: (v: string | null) => void,
  ) {
    if (!organizationId) return
    setUploading(true)
    setUploadError(null)
    const ext  = file.name.split('.').pop()
    const key  = field === 'cover_image_url' ? 'cover' : 'logo'
    const path = `${organizationId}/${key}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('org-assets')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (upErr) { setUploadError(upErr.message); setUploading(false); return }

    const { data: { publicUrl } } = supabase.storage
      .from('org-assets')
      .getPublicUrl(path)

    // Bust cache with timestamp
    const urlWithCache = `${publicUrl}?t=${Date.now()}`
    setUrl(urlWithCache)
    await supabase.from('organizations').update({ [field]: urlWithCache }).eq('id', organizationId)
    setUploading(false)
  }

  // ── Save text fields ──────────────────────────────────────────────────────
  async function save() {
    if (!organizationId) return
    setSaveState('saving')
    const { error } = await supabase.from('organizations').update({
      name,
      specialty:        specialty || null,
      primary_color:    primaryColor,
      booking_headline: headline || null,
      booking_weeks:    bookingWeeks,
      address:          address  || null,
      phone:            phone    || null,
      whatsapp_number:  whatsapp || null,
      instagram_handle: instagram|| null,
    }).eq('id', organizationId)
    setSaveState(error ? 'error' : 'saved')
    setTimeout(() => setSaveState('idle'), 2500)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:T3 }}>
      <div style={{ width:'28px', height:'28px', borderRadius:'50%', border:`2px solid ${P800}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
    </div>
  )

  if (!organizationId || !org) return (
    <div style={{ padding:'40px', textAlign:'center', color:T3, fontSize:'14px' }}>
      No se encontró la organización.
    </div>
  )

  const inputStyle: React.CSSProperties = {
    width:'100%', padding:'10px 12px', borderRadius:'8px',
    border:`1px solid ${BD}`, fontSize:'14px', color:T1,
    outline:'none', backgroundColor:CARD, boxSizing:'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display:'block', fontSize:'12px', fontWeight:600,
    color:T2, marginBottom:'6px', letterSpacing:'0.02em',
  }
  const sectionStyle: React.CSSProperties = {
    backgroundColor:CARD, borderRadius:'12px', border:`1px solid ${BD}`,
    padding:'24px', marginBottom:'16px',
  }
  const sectionTitleStyle: React.CSSProperties = {
    fontSize:'13px', fontWeight:700, color:P800,
    marginBottom:'20px', display:'flex', alignItems:'center', gap:'8px',
  }

  return (
    <div style={{ maxWidth:'680px', margin:'0 auto', padding:'8px 0 40px' }}>
      <h2 style={{ fontSize:'20px', fontWeight:700, color:P800, marginBottom:'24px' }}>
        Configuración del centro
      </h2>

      {/* ── IMAGEN DE PORTADA ── */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <ImageIcon size={16} color={P600} />
          Imagen de portada
        </div>
        <p style={{ fontSize:'13px', color:T2, marginBottom:'16px', lineHeight:1.6 }}>
          Esta imagen aparece como fondo en la página de reservas pública. Recomendamos una foto horizontal de alta calidad (mínimo 1200×675px).
        </p>

        {/* Preview */}
        <div style={{ position:'relative', width:'100%', height:'200px', borderRadius:'10px', overflow:'hidden', backgroundColor:'#111', marginBottom:'16px', border:`1px solid ${BD}` }}>
          {coverUrl
            ? <img src={coverUrl} alt="Portada" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center' }} />
            : <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px', color:T3 }}>
                <ImageIcon size={32} />
                <span style={{ fontSize:'13px' }}>Sin imagen — se usará la de la especialidad</span>
              </div>
          }
          {coverUrl && (
            <button
              onClick={async () => {
                setCoverUrl(null)
                await supabase.from('organizations').update({ cover_image_url: null }).eq('id', organizationId)
              }}
              style={{ position:'absolute', top:'8px', right:'8px', width:'28px', height:'28px', borderRadius:'50%', backgroundColor:'rgba(0,0,0,0.6)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
              title="Quitar imagen personalizada"
            >
              <X size={14} color="#fff" />
            </button>
          )}
        </div>

        <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display:'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'cover_image_url', setUploadingCover, setCoverUrl) }} />

        <button
          onClick={() => coverRef.current?.click()}
          disabled={uploadingCover}
          style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'10px 20px', borderRadius:'8px', border:`1.5px solid ${P800}`, backgroundColor: uploadingCover ? '#f1f5f9' : CARD, color:P800, fontSize:'13px', fontWeight:600, cursor: uploadingCover ? 'default' : 'pointer' }}
        >
          <Upload size={15} />
          {uploadingCover ? 'Subiendo…' : coverUrl ? 'Cambiar imagen' : 'Subir imagen'}
        </button>

        {uploadError && <p style={{ color:ERR, fontSize:'12px', marginTop:'8px' }}>{uploadError}</p>}
      </div>

      {/* ── LOGO ── */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <ImageIcon size={16} color={P600} />
          Logo del centro
        </div>
        <p style={{ fontSize:'13px', color:T2, marginBottom:'16px', lineHeight:1.6 }}>
          Aparece sobre la imagen de portada. Usá un PNG con fondo transparente o blanco, formato cuadrado.
        </p>

        <div style={{ display:'flex', alignItems:'center', gap:'20px', marginBottom:'16px' }}>
          <div style={{ width:'100px', height:'100px', borderRadius:'16px', border:`1px solid ${BD}`, backgroundColor:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
            {logoUrl
              ? <img src={logoUrl} alt="Logo" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
              : <ImageIcon size={28} color={T3} />
            }
          </div>
          <div>
            <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display:'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'logo_url', setUploadingLogo, setLogoUrl) }} />
            <button
              onClick={() => logoRef.current?.click()}
              disabled={uploadingLogo}
              style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'10px 20px', borderRadius:'8px', border:`1.5px solid ${P800}`, backgroundColor: uploadingLogo ? '#f1f5f9' : CARD, color:P800, fontSize:'13px', fontWeight:600, cursor: uploadingLogo ? 'default' : 'pointer', marginBottom:'8px' }}
            >
              <Upload size={15} />
              {uploadingLogo ? 'Subiendo…' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
            </button>
            {logoUrl && (
              <button
                onClick={async () => { setLogoUrl(null); await supabase.from('organizations').update({ logo_url: null }).eq('id', organizationId) }}
                style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 12px', borderRadius:'6px', border:`1px solid ${BD}`, backgroundColor:CARD, color:T2, fontSize:'12px', cursor:'pointer' }}
              >
                <X size={12} /> Quitar logo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── IDENTIDAD ── */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <Stethoscope size={16} color={P600} />
          Identidad y especialidad
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={labelStyle}>Nombre del centro</label>
            <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Ej: Vision Centro" />
          </div>

          <div>
            <label style={labelStyle}>Especialidad</label>
            <select value={specialty} onChange={e => setSpecialty(e.target.value)}
              style={{ ...inputStyle, cursor:'pointer' }}>
              {SPECIALTIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Color de acento</label>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                style={{ width:'44px', height:'40px', borderRadius:'8px', border:`1px solid ${BD}`, cursor:'pointer', padding:'2px' }} />
              <input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                style={{ ...inputStyle }} placeholder="#C9A96E" />
            </div>
          </div>

          <div style={{ gridColumn:'1/-1' }}>
            <label style={labelStyle}>Subtítulo en página de reservas</label>
            <input value={headline} onChange={e => setHeadline(e.target.value)} style={inputStyle}
              placeholder="Ej: Reservá tu consulta personalizada" />
          </div>

          <div style={{ gridColumn:'1/-1' }}>
            <label style={labelStyle}>Semanas visibles en el calendario</label>
            <div style={{ display:'flex', gap:'10px' }}>
              {([1, 2] as const).map(w => (
                <button key={w} onClick={() => setBookingWeeks(w)} type="button"
                  style={{ flex:1, padding:'10px', borderRadius:'8px', border:`1.5px solid ${bookingWeeks === w ? P800 : BD}`, backgroundColor: bookingWeeks === w ? P800 : CARD, color: bookingWeeks === w ? '#fff' : T1, fontSize:'13px', fontWeight:600, cursor:'pointer' }}>
                  {w === 1 ? '1 semana' : '2 semanas'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTACTO ── */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <Globe size={16} color={P600} />
          Contacto y redes
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
          <div>
            <label style={labelStyle}>Teléfono</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="+54 11 1234-5678" />
          </div>
          <div>
            <label style={labelStyle}>WhatsApp (con código de país)</label>
            <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} style={inputStyle} placeholder="541112345678" />
          </div>
          <div>
            <label style={labelStyle}>Instagram (@handle)</label>
            <input value={instagram} onChange={e => setInstagram(e.target.value)} style={inputStyle} placeholder="@centro_vision" />
          </div>
          <div>
            <label style={labelStyle}>Dirección</label>
            <input value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} placeholder="Av. Corrientes 1234, CABA" />
          </div>
        </div>
      </div>

      {/* ── COBROS / MERCADO PAGO ── */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <CreditCard size={16} color={P600} />
          Cobros — Mercado Pago
        </div>
        <p style={{ fontSize:'13px', color:T2, marginBottom:'16px', lineHeight:1.6 }}>
          Access Token de producción de la cuenta de Mercado Pago de este centro. Se usa para cobrar
          señas y pagos online. Lo obtenés en el panel de desarrolladores de Mercado Pago, con la cuenta
          de MP del centro ya logueada: developers → Tus integraciones → tu aplicación → Credenciales de producción.
        </p>

        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px', fontSize:'13px', fontWeight:600, color: mpConfigured ? OK : T3 }}>
          {mpConfigured
            ? <><Check size={15} /> Token configurado</>
            : <><Lock size={15} /> Sin token propio — usa la cuenta global por defecto</>
          }
        </div>

        <label style={labelStyle}>{mpConfigured ? 'Reemplazar token' : 'Access Token de producción'}</label>
        <div style={{ display:'flex', gap:'10px' }}>
          <input
            type="password"
            value={mpTokenInput}
            onChange={e => setMpTokenInput(e.target.value)}
            style={{ ...inputStyle, flex:1 }}
            placeholder="APP_USR-..."
            autoComplete="off"
          />
          <button
            onClick={saveMpToken}
            disabled={!mpTokenInput.trim() || mpSaveState === 'saving'}
            style={{ padding:'10px 20px', borderRadius:'8px', border:'none', backgroundColor: !mpTokenInput.trim() ? '#cbd5e1' : P800, color:'#fff', fontSize:'13px', fontWeight:600, cursor: !mpTokenInput.trim() ? 'default' : 'pointer', whiteSpace:'nowrap' }}
          >
            {mpSaveState === 'saving' ? 'Guardando…' : 'Guardar token'}
          </button>
        </div>
        {mpSaveState === 'saved' && <p style={{ color:OK, fontSize:'12px', marginTop:'8px' }}>Token guardado.</p>}
        {mpSaveState === 'error'  && <p style={{ color:ERR, fontSize:'12px', marginTop:'8px' }}>Error al guardar. Probá de nuevo.</p>}
      </div>

      {/* ── SAVE ── */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
        <button
          onClick={save}
          disabled={saveState === 'saving'}
          style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'12px 28px', borderRadius:'10px', border:'none', backgroundColor: saveState === 'error' ? ERR : P800, color:'#fff', fontSize:'14px', fontWeight:600, cursor: saveState === 'saving' ? 'default' : 'pointer', opacity: saveState === 'saving' ? 0.7 : 1 }}
        >
          {saveState === 'saving' && <div style={{ width:'14px', height:'14px', borderRadius:'50%', border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', animation:'spin 0.8s linear infinite' }} />}
          {saveState === 'saved'  && <Check size={15} />}
          {saveState === 'error'  ? 'Error al guardar' : saveState === 'saved' ? 'Guardado' : 'Guardar cambios'}
        </button>
        {saveState === 'saved' && (
          <span style={{ fontSize:'13px', color:OK, display:'flex', alignItems:'center', gap:'5px' }}>
            <Check size={14} /> Los cambios se aplicarán en la próxima visita al sitio
          </span>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
