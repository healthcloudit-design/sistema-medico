import { useEffect, useMemo, useState } from 'react'
import {
  MapPin, Phone, Search, ChevronRight, ChevronLeft,
  ShieldCheck, FileText, CheckCircle, CalendarCheck, Clock,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { alpha } from '../../lib/color'
import { getMunicipalTheme, type MunicipalTheme } from '../../lib/municipalTheme'
import { useAvailability } from '../../hooks/useAvailability'
import type { Organization, Professional, Service } from '../../types'

/**
 * Flujo de reserva MULTI-CENTRO para organismos de salud pública (tenant_type = 'general').
 * Diseño institucional accesible: hero -> centro -> atención (gate de orden por servicio)
 * -> fecha/hora -> datos -> confirmación. Disponibilidad real (useAvailability) y reserva
 * real (RPC reservar_turno).
 */

interface Centro { id: string; name: string; address: string | null; phone: string | null }
interface SvcEntry { service: Service; professionals: Professional[] }
type Step = 'home' | 'centro' | 'servicio' | 'orden' | 'sinorden' | 'fechahora' | 'datos' | 'ok'

const PRIMARIA = ['Medicina Familiar', 'Clínica Médica', 'Pediatría']
const DIA3 = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

// ── Neutrales compartidos (iguales para todos los tenants) ────────────────────
// La paleta institucional (acento, secundario, etc.) y los textos por municipio
// se resuelven por tenant en getMunicipalTheme(org) => ver src/lib/municipalTheme.ts.
const INK = '#161616', MUTED = '#5b6470', SOFT = '#F4F6F8', BORDER = '#e5e7eb'

const STEP_NUM: Record<Step, number> = { home: 0, centro: 1, servicio: 2, orden: 2, sinorden: 2, fechahora: 3, datos: 4, ok: 5 }
const STEPS = ['Centro', 'Atención', 'Fecha y hora', 'Tus datos', 'Confirmación']

// ── Subcomponentes a NIVEL DE MÓDULO (identidad estable => los inputs no se
//    re-montan en cada tecla y no pierden el foco) ────────────────────────────
function Shell({ org, theme, logoUrl, phone, step, children }: {
  org: Organization; theme: MunicipalTheme; logoUrl: string; phone: string; step: Step; children: React.ReactNode
}) {
  const cur = STEP_NUM[step]
  return (
    <div className="min-h-screen" style={{ backgroundColor: SOFT, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header className="bg-white" style={{ borderBottom: `4px solid ${theme.accent}` }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src={logoUrl} alt={org.name} className="h-11 w-auto" />
          <div className="leading-tight">
            <div className="font-extrabold text-[17px]" style={{ color: INK }}>{org.name}</div>
            <div className="text-xs" style={{ color: MUTED }}>{theme.subtitle}</div>
          </div>
          <div className="ml-auto text-right hidden sm:block">
            <div className="text-[11px]" style={{ color: MUTED }}>Línea de turnos</div>
            <div className="text-sm font-bold" style={{ color: INK }}>{phone}</div>
            <div className="text-[11px]" style={{ color: MUTED }}>{theme.hoursLabel}</div>
          </div>
        </div>
      </header>
      {cur > 0 && (
        <div className="bg-white border-b sticky top-0 z-10" style={{ borderColor: BORDER }}>
          <div className="max-w-3xl mx-auto px-4 py-2.5 flex gap-2 flex-wrap">
            {STEPS.map((label, i) => {
              const n = i + 1, done = n < cur, active = n === cur
              return (
                <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px]"
                  style={{ backgroundColor: active ? alpha(theme.accent, 0.1) : '#fff', border: `1px solid ${active ? theme.accent : BORDER}`, color: active ? INK : '#8a929c', fontWeight: active ? 600 : 400 }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-bold text-white"
                    style={{ backgroundColor: done ? theme.success : active ? theme.accent : '#c7ccd2' }}>{done ? '✓' : n}</span>
                  <span className="hidden sm:inline">{label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <div className="max-w-3xl mx-auto px-4 py-6">{children}</div>
      <div className="max-w-3xl mx-auto px-4 pb-8 text-xs" style={{ color: '#8a929c' }}>
        Atención gratuita en los Centros de Salud Municipales. Ante una urgencia, llamá al <b>{theme.emergency.phone}</b> ({theme.emergency.label}, {theme.emergency.hours}).
      </div>
    </div>
  )
}

function Back({ to, label = 'Volver', goto, accent }: { to: Step; label?: string; goto: (s: Step) => void; accent: string }) {
  return (
    <button onClick={() => goto(to)} className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl mb-3"
      style={{ color: accent, backgroundColor: alpha(accent, 0.08) }}><ChevronLeft className="w-4 h-4" />{label}</button>
  )
}
const H1 = ({ children }: { children: React.ReactNode }) => <h1 className="text-2xl font-extrabold mb-1" style={{ color: INK }}>{children}</h1>
const Sub = ({ children }: { children: React.ReactNode }) => <p className="text-[15px] mb-4" style={{ color: MUTED }}>{children}</p>

export function MunicipalBookingFlow({ org }: { org: Organization }) {
  const theme = getMunicipalTheme(org)
  const { accent: ACCENT, accentInk: ACCENT_INK, brand: VERDE, secondary: MAG, secondaryBg: MAG_BG, secondaryTxt: MAG_TXT } = theme
  const logoUrl = org.logo_url ?? `${import.meta.env.BASE_URL}${theme.logoFallback}`
  const phone = org.phone ?? theme.phoneFallback

  const [step, setStep] = useState<Step>('home')
  const [centros, setCentros] = useState<Centro[]>([])
  const [loadingCentros, setLoadingCentros] = useState(true)
  const [query, setQuery] = useState('')

  const [centro, setCentro] = useState<Centro | null>(null)
  const [entries, setEntries] = useState<SvcEntry[]>([])
  const [loadingSvcs, setLoadingSvcs] = useState(false)

  const [svc, setSvc] = useState<Service | null>(null)
  const [prof, setProf] = useState<Professional | null>(null)
  const [requiereOrden, setRequiereOrden] = useState(false)

  const [dateISO, setDateISO] = useState('')
  const [hora, setHora] = useState('')

  const [form, setForm] = useState({ nombre: '', dni: '', fnac: '', telefono: '', email: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [turnoId, setTurnoId] = useState('')

  const { slots, loading: loadingSlots, availableDates } =
    useAvailability(prof?.id, dateISO || undefined, svc?.duration_minutes ?? 20, undefined, svc?.id)

  const dias = useMemo(() => Array.from(availableDates).sort().slice(0, 8), [availableDates])

  useEffect(() => {
    if (step === 'fechahora' && !dateISO && dias.length) setDateISO(dias[0])
  }, [step, dias, dateISO])

  useEffect(() => {
    setLoadingCentros(true)
    supabase.from('locations').select('id, name, address, phone')
      .eq('organization_id', org.id).eq('active', true).order('name')
      .then(({ data }: { data: Centro[] | null }) => { setCentros(data ?? []); setLoadingCentros(false) })
  }, [org.id])

  const goto = (s: Step) => { setStep(s); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const pickCentro = async (c: Centro) => {
    setCentro(c); setSvc(null); setProf(null); setDateISO(''); setHora('')
    setLoadingSvcs(true); goto('servicio')
    const { data } = await supabase.from('professionals')
      .select('id, organization_id, location_id, full_name, specialty, active, concurrent_capacity, professional_services(services(*))')
      .eq('location_id', c.id).eq('active', true)
    const map = new Map<string, SvcEntry>()
    ;(data ?? []).forEach((p: any) => {
      const pr: Professional = p
      ;(p.professional_services ?? []).forEach((ps: any) => {
        const s: Service | null = ps.services
        if (!s || !s.active) return
        const e = map.get(s.id)
        if (e) e.professionals.push(pr); else map.set(s.id, { service: s, professionals: [pr] })
      })
    })
    setEntries(Array.from(map.values()).sort((a, b) => a.service.name.localeCompare(b.service.name, 'es')))
    setLoadingSvcs(false)
  }

  const cabecera = (): SvcEntry | null => {
    for (const name of PRIMARIA) { const e = entries.find(x => !x.service.requiere_orden && x.service.name === name); if (e) return e }
    return entries.find(x => !x.service.requiere_orden) ?? null
  }

  const startBooking = (entry: SvcEntry) => {
    setSvc(entry.service); setProf(entry.professionals[0]); setDateISO(''); setHora('')
    setRequiereOrden(!!entry.service.requiere_orden)
    goto('fechahora')
  }
  const pickService = (entry: SvcEntry) => {
    setSvc(entry.service); setProf(entry.professionals[0]); setRequiereOrden(!!entry.service.requiere_orden)
    if (entry.service.requiere_orden) goto('orden'); else startBooking(entry)
  }

  const submit = async () => {
    if (!svc || !prof || !dateISO || !hora) return
    if (!form.nombre.trim()) { setError('El nombre y apellido es obligatorio'); return }
    if (!form.dni.trim())    { setError('El DNI es obligatorio'); return }
    if (!form.telefono.trim()){ setError('El teléfono es obligatorio'); return }
    setSubmitting(true); setError('')
    try {
      const startsAt = `${dateISO}T${hora}:00-03:00`
      const { data, error: rpcErr } = await supabase.rpc('reservar_turno', {
        p_professional_id: prof.id, p_service_id: svc.id, p_starts_at: startsAt,
        p_patient_name: form.nombre, p_patient_phone: form.telefono,
        p_patient_email: form.email || undefined, p_patient_dni: form.dni || undefined,
      })
      if (rpcErr) throw rpcErr
      const res = data as { id?: string; error?: string }
      if (res?.error === 'slot_taken') { setError('Ese horario ya fue reservado. Por favor elegí otro.'); setSubmitting(false); goto('fechahora'); return }
      if (res?.error) throw new Error(res.error)
      setTurnoId(res?.id ?? '')
      goto('ok')
    } catch (e) { setError('Hubo un error al reservar. Por favor intentá de nuevo.') }
    finally { setSubmitting(false) }
  }

  const reset = () => {
    setStep('home'); setCentro(null); setSvc(null); setProf(null); setDateISO(''); setHora('')
    setForm({ nombre: '', dni: '', fnac: '', telefono: '', email: '' }); setTurnoId(''); setError('')
  }

  const turnoCode = turnoId ? theme.turnoPrefix + '-' + (parseInt(turnoId.replace(/-/g, '').slice(0, 8), 16) % 90000 + 10000) : ''

  const shellProps = { org, theme, logoUrl, phone, step }

  // ── HOME ─────────────────────────────────────────────────────────
  if (step === 'home') return (
    <Shell {...shellProps}>
      <div className="bg-white rounded-2xl overflow-hidden border" style={{ borderColor: BORDER, boxShadow: '0 4px 20px rgba(47,100,23,.10)' }}>
        <div className="px-8 py-10 text-white" style={{ background: `linear-gradient(120deg, ${theme.gradientFrom} 0%, ${ACCENT} 55%, ${VERDE} 100%)` }}>
          <h1 className="text-3xl font-extrabold mb-2 leading-tight">Sacá tu turno en tu Centro de Salud</h1>
          <p className="text-[16px] opacity-95 max-w-xl">Reservá una atención en cualquiera de los Centros de Salud Municipales{theme.heroMunicipio}, de forma simple y desde tu celular.</p>
        </div>
        <div className="px-8 py-7">
          <span className="inline-block text-[13px] font-bold px-3.5 py-1.5 rounded-full mb-5" style={{ backgroundColor: MAG_BG, color: MAG_TXT }}>100% gratuito · sin costo ni seña</span>
          <ul className="grid gap-3 sm:grid-cols-3 mb-7 list-none p-0">
            {['Elegí el centro más cercano a tu domicilio.', 'Reservá el día y horario que mejor te quede.', 'Recibí la confirmación de tu turno al instante.'].map(t => (
              <li key={t} className="flex gap-2.5 text-[15px]" style={{ color: '#26313b' }}>
                <span className="font-extrabold text-lg leading-none" style={{ color: ACCENT }}>✓</span><span>{t}</span>
              </li>
            ))}
          </ul>
          <button onClick={() => goto('centro')} className="w-full text-white font-bold text-[17px] rounded-xl py-4" style={{ backgroundColor: ACCENT }}>Pedir un turno →</button>
        </div>
      </div>
    </Shell>
  )

  // ── CENTRO ───────────────────────────────────────────────────────
  if (step === 'centro') {
    const q = query.toLowerCase().trim()
    const filtered = centros.filter(c => (c.name + ' ' + (c.address ?? '')).toLowerCase().includes(q))
    return (
      <Shell {...shellProps}>
        <Back to="home" goto={goto} accent={ACCENT} />
        <H1>Elegí tu Centro de Salud</H1>
        <Sub>Seleccioná el centro más cercano a tu domicilio o el que prefieras.</Sub>
        <div className="relative mb-4">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre o dirección…"
            className="w-full pl-10 pr-4 py-3 rounded-xl text-[15px] outline-none" style={{ border: `2px solid #d8ddd6` }} />
        </div>
        {loadingCentros ? (
          <div className="grid gap-3 sm:grid-cols-2">{[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ backgroundColor: '#e9edf1' }} />)}</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map(c => (
              <button key={c.id} onClick={() => pickCentro(c)} className="text-left bg-white rounded-2xl p-4 border transition-all hover:shadow-md" style={{ borderColor: BORDER }}>
                <div className="font-bold text-[16px] leading-tight mb-1.5" style={{ color: INK }}>{c.name}</div>
                {c.address && <div className="flex items-start gap-1.5 text-sm" style={{ color: MUTED }}><MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />{c.address}</div>}
                {c.phone && <div className="flex items-center gap-1.5 text-sm mt-0.5" style={{ color: MUTED }}><Phone className="w-4 h-4 flex-shrink-0" />{c.phone}</div>}
              </button>
            ))}
            {q === '' && theme.emergencyCard && (
              <div className="bg-white rounded-2xl p-4 border border-dashed opacity-80" style={{ borderColor: BORDER }}>
                <div className="font-bold text-[16px] leading-tight mb-1.5" style={{ color: INK }}>{theme.emergencyCard.name}</div>
                <div className="flex items-start gap-1.5 text-sm" style={{ color: MUTED }}><MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />{theme.emergencyCard.address}</div>
                <span className="inline-block mt-2 text-[12px] font-bold px-2 py-1 rounded" style={{ backgroundColor: '#fdecec', color: '#c62828' }}>{theme.emergencyCard.badge}</span>
              </div>
            )}
            {filtered.length === 0 && q !== '' && <p style={{ color: MUTED }}>No encontramos centros con ese nombre.</p>}
          </div>
        )}
      </Shell>
    )
  }

  // ── SERVICIO ─────────────────────────────────────────────────────
  if (step === 'servicio' && centro) {
    const directos = entries.filter(e => !e.service.requiere_orden)
    const conOrden = entries.filter(e => e.service.requiere_orden)
    const Item = (e: SvcEntry) => (
      <button key={e.service.id} onClick={() => pickService(e)}
        className="w-full flex items-center gap-3 bg-white border rounded-xl px-4 py-4 mb-2.5 text-left transition-all hover:shadow-md" style={{ borderColor: BORDER }}>
        <span className="font-semibold flex-1" style={{ color: INK }}>{e.service.name}</span>
        {e.service.requiere_orden && <span className="text-[12px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: MAG_BG, color: MAG_TXT }}>Requiere orden médica</span>}
        <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: ACCENT }} />
      </button>
    )
    return (
      <Shell {...shellProps}>
        <Back to="centro" label="Cambiar de centro" goto={goto} accent={ACCENT} />
        <H1>{centro.name}</H1>
        <p className="text-sm mb-5 flex items-center gap-1" style={{ color: MUTED }}>{centro.address && <><MapPin className="w-4 h-4" />{centro.address}</>}</p>
        {loadingSvcs ? (
          <div className="space-y-2.5">{[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: '#e9edf1' }} />)}</div>
        ) : entries.length === 0 ? (
          <div className="rounded-xl p-5 text-sm" style={{ backgroundColor: '#fff8e6', color: MAG_TXT }}>Este centro todavía no tiene agenda de turnos online. Comunicate al {phone} (Lun a Vie, 7 a 19 h).</div>
        ) : (
          <>
            {directos.length > 0 && <div className="mb-6"><h3 className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: MUTED }}>Atención primaria — acceso directo</h3>{directos.map(Item)}</div>}
            {conOrden.length > 0 && <div className="mb-6"><h3 className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: MUTED }}>Especialidades — requieren orden del médico de cabecera</h3>{conOrden.map(Item)}</div>}
            <div><h3 className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: MUTED }}>Sin turno</h3>
              <div className="rounded-xl p-4 text-sm border border-dashed" style={{ backgroundColor: SOFT, borderColor: BORDER, color: MUTED }}>
                <b style={{ color: INK }}>Farmacia · Vacunatorio · Enfermería</b><br />Se atienden por orden de llegada, no necesitás reservar turno. Acercate al centro dentro del horario de atención.
              </div>
            </div>
          </>
        )}
      </Shell>
    )
  }

  // ── ORDEN gate ───────────────────────────────────────────────────
  if (step === 'orden' && svc && centro) return (
    <Shell {...shellProps}>
      <Back to="servicio" label="Volver a especialidades" goto={goto} accent={ACCENT} />
      <div className="bg-white border rounded-2xl p-6" style={{ borderColor: BORDER }}>
        <H1>Antes de continuar</H1>
        <p className="text-[15px] mb-4" style={{ color: MUTED }}>Elegiste <b style={{ color: INK }}>{svc.name}</b> en {centro.name}.</p>
        <h2 className="text-lg font-bold mb-4" style={{ color: INK }}>¿Tenés la orden de tu médico de cabecera para esta atención?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => svc && startBooking({ service: svc, professionals: prof ? [prof] : [] })} className="rounded-2xl p-5 text-center border-2 transition-all hover:shadow-md" style={{ borderColor: BORDER, backgroundColor: '#fff' }}>
            <ShieldCheck className="w-7 h-7 mx-auto mb-1.5" style={{ color: theme.success }} /><div className="font-bold" style={{ color: INK }}>Sí, tengo la orden</div><div className="text-sm" style={{ color: MUTED }}>Continuar con la reserva</div>
          </button>
          <button onClick={() => goto('sinorden')} className="rounded-2xl p-5 text-center border-2 transition-all hover:shadow-md" style={{ borderColor: BORDER, backgroundColor: '#fff' }}>
            <FileText className="w-7 h-7 mx-auto mb-1.5" style={{ color: MAG }} /><div className="font-bold" style={{ color: INK }}>No tengo la orden</div><div className="text-sm" style={{ color: MUTED }}>Ver cómo obtenerla</div>
          </button>
        </div>
      </div>
    </Shell>
  )

  // ── SIN ORDEN ────────────────────────────────────────────────────
  if (step === 'sinorden' && svc && centro) {
    const cab = cabecera()
    return (
      <Shell {...shellProps}>
        <Back to="orden" goto={goto} accent={ACCENT} />
        <div className="rounded-2xl p-6 mb-5" style={{ backgroundColor: alpha(ACCENT, 0.06), borderLeft: `5px solid ${ACCENT}` }}>
          <h1 className="text-xl font-extrabold mb-2" style={{ color: INK }}>Para este turno necesitás una orden de tu médico de cabecera</h1>
          <p className="text-[15px] mb-2" style={{ color: '#333' }}>La atención que elegiste (<b>{svc.name}</b>) requiere que primero te vea tu <b>médico de cabecera</b>. Él o ella evalúa tu situación y, si corresponde, te da la <b>orden</b> para acceder a esta especialidad.</p>
          <p className="text-[15px]" style={{ color: '#333' }}><b>¿Qué hacés ahora?</b> Sacá un turno con tu médico de cabecera en este mismo centro. Es gratuito, como todos los turnos. Cuando tengas la orden, volvés y reservás la especialidad sin problema.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {cab ? <button onClick={() => startBooking(cab)} className="text-white font-bold rounded-xl px-6 py-3.5" style={{ backgroundColor: ACCENT }}>Sacar turno con mi médico de cabecera</button>
               : <p className="text-sm" style={{ color: MUTED }}>Consultá en la línea {phone} a qué centro acercarte.</p>}
          <button onClick={() => goto('servicio')} className="font-bold rounded-xl px-6 py-3.5 border-2 bg-white" style={{ color: ACCENT, borderColor: ACCENT }}>Elegir otra atención</button>
        </div>
      </Shell>
    )
  }

  // ── FECHA Y HORA ─────────────────────────────────────────────────
  if (step === 'fechahora' && svc && centro) {
    const backTo: Step = requiereOrden ? 'orden' : 'servicio'
    return (
      <Shell {...shellProps}>
        <Back to={backTo} goto={goto} accent={ACCENT} />
        <H1>Elegí día y horario</H1>
        <Sub><b style={{ color: INK }}>{svc.name}</b> · {centro.name}</Sub>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-[15px] font-bold mb-2.5" style={{ color: INK }}>Día</h2>
            {dias.length === 0 ? <p className="text-sm" style={{ color: MUTED }}>No hay días disponibles.</p> : (
              <div className="flex gap-2 flex-wrap">
                {dias.map(d => {
                  const dt = parseISO(d); const sel = dateISO === d
                  return (
                    <button key={d} onClick={() => { setDateISO(d); setHora('') }} className="rounded-xl px-2 py-2.5 min-w-[62px] text-center border-2"
                      style={sel ? { borderColor: ACCENT, backgroundColor: ACCENT, color: '#fff' } : { borderColor: BORDER, backgroundColor: '#fff', color: INK }}>
                      <div className="text-[11px] uppercase opacity-80">{DIA3[dt.getDay()]}</div>
                      <div className="text-xl font-extrabold leading-none">{dt.getDate()}</div>
                      <div className="text-[11px] opacity-80">{MES3[dt.getMonth()]}</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-[15px] font-bold mb-2.5" style={{ color: INK }}>Horario disponible</h2>
            {loadingSlots ? <p className="text-sm" style={{ color: MUTED }}>Cargando horarios…</p>
              : slots.length === 0 ? <p className="text-sm" style={{ color: MUTED }}>No hay horarios para este día.</p> : (
              <>
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))' }}>
                  {slots.map(s => {
                    const sel = hora === s.hora
                    return (
                      <button key={s.hora} disabled={!s.disponible} onClick={() => setHora(s.hora)} className="rounded-lg py-2.5 text-center font-semibold border-2"
                        style={!s.disponible ? { borderColor: BORDER, color: '#c0c6cc', textDecoration: 'line-through', background: '#fff', cursor: 'not-allowed' }
                          : sel ? { borderColor: ACCENT, backgroundColor: ACCENT, color: '#fff' } : { borderColor: BORDER, backgroundColor: '#fff', color: INK }}>
                        {s.hora}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[13px] mt-3 flex items-center gap-1" style={{ color: MUTED }}><Clock className="w-3.5 h-3.5" />Los horarios tachados ya están ocupados.</p>
              </>
            )}
          </div>
        </div>
        <div className="mt-6">
          <button disabled={!hora} onClick={() => hora && goto('datos')} className="text-white font-bold rounded-xl px-7 py-3.5" style={{ backgroundColor: ACCENT, opacity: hora ? 1 : 0.5, cursor: hora ? 'pointer' : 'not-allowed' }}>Continuar →</button>
        </div>
      </Shell>
    )
  }

  // ── DATOS ────────────────────────────────────────────────────────
  if (step === 'datos' && svc && centro) {
    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))
    const inp = 'w-full rounded-xl px-3.5 py-3 text-[15px] outline-none'
    const inpStyle = { border: `2px solid ${BORDER}` } as React.CSSProperties
    const lbl = 'block text-sm font-semibold mb-1.5'
    return (
      <Shell {...shellProps}>
        <Back to="fechahora" goto={goto} accent={ACCENT} />
        <H1>Completá tus datos</H1>
        <Sub>Necesitamos estos datos para registrar y confirmarte el turno.</Sub>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white border rounded-2xl p-5 sm:p-6" style={{ borderColor: BORDER }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className={lbl} style={{ color: INK }}>Nombre y apellido <span style={{ color: MAG_TXT }}>*</span></label><input className={inp} style={inpStyle} value={form.nombre} onChange={set('nombre')} placeholder="Ej: María González" /></div>
              <div><label className={lbl} style={{ color: INK }}>DNI <span style={{ color: MAG_TXT }}>*</span></label><input className={inp} style={inpStyle} inputMode="numeric" value={form.dni} onChange={set('dni')} placeholder="Sin puntos" /></div>
              <div><label className={lbl} style={{ color: INK }}>Fecha de nacimiento</label><input className={inp} style={inpStyle} type="date" value={form.fnac} onChange={set('fnac')} /></div>
              <div><label className={lbl} style={{ color: INK }}>Teléfono <span style={{ color: MAG_TXT }}>*</span></label><input className={inp} style={inpStyle} type="tel" inputMode="tel" value={form.telefono} onChange={set('telefono')} placeholder="Ej: 11 5555 5555" /></div>
              <div><label className={lbl} style={{ color: INK }}>Email</label><input className={inp} style={inpStyle} type="email" value={form.email} onChange={set('email')} placeholder="Para recibir la confirmación" /></div>
            </div>
            {error && <div className="mt-4 rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: '#fef2f2', color: '#b91c1c' }}>{error}</div>}
            <button disabled={submitting} onClick={submit} className="w-full mt-5 text-white font-bold text-[16px] rounded-xl py-4" style={{ backgroundColor: ACCENT, opacity: submitting ? 0.6 : 1 }}>{submitting ? 'Reservando…' : 'Confirmar turno'}</button>
          </div>
          <div>
            <div className="rounded-2xl p-5" style={{ backgroundColor: SOFT, border: `1px solid ${BORDER}` }}>
              <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: MUTED }}>Resumen del turno</h3>
              {[['Centro', centro.name], ['Dirección', centro.address], ['Atención', svc.name],
                ['Día', dateISO ? format(parseISO(dateISO), "EEEE d 'de' MMMM", { locale: es }) : ''], ['Hora', hora ? `${hora} h` : '']].map(([k, v]) => v ? (
                <div key={k} className="flex gap-3 py-1.5 border-b last:border-0 text-sm" style={{ borderColor: BORDER }}>
                  <span className="flex-none w-28" style={{ color: MUTED }}>{k}</span><span className="font-semibold capitalize" style={{ color: INK }}>{v}</span>
                </div>
              ) : null)}
            </div>
          </div>
        </div>
      </Shell>
    )
  }

  // ── OK ───────────────────────────────────────────────────────────
  if (step === 'ok' && svc && centro) {
    const fechaLabel = dateISO ? `${DIA3[parseISO(dateISO).getDay()]} ${parseISO(dateISO).getDate()} de ${MESES[parseISO(dateISO).getMonth()]}` : ''
    return (
      <Shell {...shellProps}>
        <div className="bg-white border rounded-2xl p-8 text-center" style={{ borderColor: BORDER }}>
          <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: theme.success }}><CheckCircle className="w-9 h-9 text-white" /></div>
          <H1>¡Tu turno está confirmado!</H1>
          <p className="text-[15px] mb-1" style={{ color: MUTED }}>Guardá tu código de turno:</p>
          {turnoCode && <div className="inline-block font-extrabold text-2xl tracking-wider rounded-xl px-6 py-2.5 my-2" style={{ backgroundColor: SOFT, border: `2px dashed ${ACCENT}`, color: ACCENT_INK }}>{turnoCode}</div>}
          <div className="rounded-xl p-4 text-left max-w-md mx-auto mt-5 mb-5" style={{ backgroundColor: SOFT }}>
            {[['Centro', centro.name], ['Dirección', centro.address], ['Atención', svc.name], ['Día y hora', `${fechaLabel} · ${hora} h`], ['A nombre de', form.nombre]].map(([k, v]) => v ? (
              <div key={k} className="flex gap-3 py-1.5 border-b last:border-0 text-sm" style={{ borderColor: BORDER }}>
                <span className="flex-none w-28" style={{ color: MUTED }}>{k}</span><span className="font-semibold capitalize" style={{ color: INK }}>{v}</span>
              </div>
            ) : null)}
          </div>
          <div className="rounded-xl p-4 text-left max-w-md mx-auto mb-6" style={{ backgroundColor: MAG_BG }}>
            <div className="flex items-center gap-2 font-bold mb-1" style={{ color: MAG_TXT }}><FileText className="w-4 h-4" /> No te olvides de traer:</div>
            <div className="text-sm" style={{ color: MAG_TXT }}>Tu <b>DNI</b>{requiereOrden && <> y la <b>orden de tu médico de cabecera</b> (sin la orden no se podrá realizar la atención)</>}.</div>
          </div>
          <button onClick={reset} className="text-white font-bold rounded-xl px-6 py-3.5 inline-flex items-center gap-2" style={{ backgroundColor: ACCENT }}><CalendarCheck className="w-5 h-5" /> Sacar otro turno</button>
          <p className="text-sm mt-4" style={{ color: '#8a929c' }}>Si no vas a poder asistir, cancelá tu turno para que otro vecino pueda usarlo.</p>
        </div>
      </Shell>
    )
  }

  return <Shell {...shellProps}><div className="py-20 text-center" style={{ color: MUTED }}>Cargando…</div></Shell>
}
