import { useEffect, useState } from 'react'
import {
  MapPin, Phone, Clock, ChevronLeft, Search, FileText,
  CheckCircle, ChevronRight, ShieldCheck, CalendarCheck,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { alpha } from '../../lib/color'
import type { Organization, Professional, Service, BookingState } from '../../types'
import { DateTimeSelector } from './DateTimeSelector'
import { ProfessionalSelector } from './ProfessionalSelector'
import { BookingConfirm } from './BookingConfirm'

/**
 * Flujo de reserva MULTI-CENTRO para organismos de salud pública (tenant_type = 'general').
 * Puerta de entrada: elegir centro -> elegir atención (con gate de orden médica por servicio)
 * -> fecha/hora -> datos -> confirmación. Reutiliza DateTimeSelector y BookingConfirm.
 */

interface Centro { id: string; name: string; address: string | null; phone: string | null }
interface SvcEntry { service: Service; professionals: Professional[] }

type Step = 'centro' | 'servicio' | 'orden' | 'sinorden' | 'profesional' | 'fechahora' | 'datos' | 'ok'

// Servicios de atención primaria: son la "puerta" que emite la orden. Nunca piden orden.
const PRIMARIA = ['Medicina Familiar', 'Clínica Médica', 'Pediatría']

const INITIAL: BookingState = {
  step: 1, nombre: '', telefono: '', email: '', dni: '',
  obra_social: '', nro_socio: '', observaciones: '',
}

const AMBER = '#D98A1F'

export function MunicipalBookingFlow({ org }: { org: Organization }) {
  const accent = org.primary_color ?? '#1F5C99'
  const logoUrl = org.logo_url ?? `${import.meta.env.BASE_URL}msf_logo.png`

  const [step, setStep] = useState<Step>('centro')
  const [centros, setCentros] = useState<Centro[]>([])
  const [loadingCentros, setLoadingCentros] = useState(true)
  const [query, setQuery] = useState('')

  const [centro, setCentro] = useState<Centro | null>(null)
  const [entries, setEntries] = useState<SvcEntry[]>([])
  const [loadingSvcs, setLoadingSvcs] = useState(false)

  const [selected, setSelected] = useState<SvcEntry | null>(null)
  const [booking, setBooking] = useState<BookingState>(INITIAL)

  // ── cargar centros ───────────────────────────────────────────────
  useEffect(() => {
    setLoadingCentros(true)
    supabase
      .from('locations')
      .select('id, name, address, phone')
      .eq('organization_id', org.id)
      .eq('active', true)
      .order('name')
      .then(({ data }: { data: Centro[] | null }) => {
        setCentros(data ?? [])
        setLoadingCentros(false)
      })
  }, [org.id])

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  const goto = (s: Step) => { setStep(s); scrollTop() }

  // ── elegir centro -> cargar servicios de ese centro ──────────────
  const pickCentro = async (c: Centro) => {
    setCentro(c)
    setSelected(null)
    setBooking(INITIAL)
    setLoadingSvcs(true)
    goto('servicio')
    const { data } = await supabase
      .from('professionals')
      .select('id, organization_id, location_id, full_name, specialty, active, concurrent_capacity, professional_services(services(*))')
      .eq('location_id', c.id)
      .eq('active', true)
    const map = new Map<string, SvcEntry>()
    ;(data ?? []).forEach((p: any) => {
      const prof: Professional = p
      ;(p.professional_services ?? []).forEach((ps: any) => {
        const svc: Service | null = ps.services
        if (!svc || !svc.active) return
        const e = map.get(svc.id)
        if (e) e.professionals.push(prof)
        else map.set(svc.id, { service: svc, professionals: [prof] })
      })
    })
    const list = Array.from(map.values()).sort((a, b) => a.service.name.localeCompare(b.service.name, 'es'))
    setEntries(list)
    setLoadingSvcs(false)
  }

  const cabeceraEntry = (): SvcEntry | null => {
    for (const name of PRIMARIA) {
      const e = entries.find(x => !x.service.requiere_orden && x.service.name === name)
      if (e) return e
    }
    return entries.find(x => !x.service.requiere_orden) ?? null
  }

  const proceedAfterService = (entry: SvcEntry) => {
    if (entry.professionals.length === 1) {
      setBooking(b => ({ ...b, service: entry.service, professional: entry.professionals[0], fecha: undefined, hora: undefined }))
      goto('fechahora')
    } else {
      setBooking(b => ({ ...b, service: entry.service, professional: undefined, fecha: undefined, hora: undefined }))
      goto('profesional')
    }
  }

  const pickService = (entry: SvcEntry) => {
    setSelected(entry)
    if (entry.service.requiere_orden) goto('orden')
    else proceedAfterService(entry)
  }

  const update = (partial: Partial<BookingState>) => setBooking(prev => ({ ...prev, ...partial }))

  // ── Shell institucional ──────────────────────────────────────────
  const STEP_NUM: Record<Step, number> = {
    centro: 1, servicio: 2, orden: 2, sinorden: 2, profesional: 2, fechahora: 3, datos: 4, ok: 5,
  }
  const STEPS = ['Centro', 'Atención', 'Fecha y hora', 'Tus datos', 'Confirmación']

  const Shell = ({ children, showSteps = true }: { children: React.ReactNode; showSteps?: boolean }) => (
    <div className="min-h-screen" style={{ backgroundColor: '#F4F6F8' }}>
      {/* Banda superior de marca */}
      <div className="bg-white border-b" style={{ borderColor: '#e5e7eb', borderBottomWidth: 4, borderBottomColor: accent }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src={logoUrl} alt={org.name} className="h-11 w-auto" />
          <div className="leading-tight">
            <div className="font-extrabold text-[17px]" style={{ color: '#161616' }}>{org.name}</div>
            <div className="text-xs" style={{ color: '#5b6470' }}>Turnos en los Centros de Salud Municipales</div>
          </div>
          <div className="ml-auto text-right hidden sm:block">
            <div className="text-[11px]" style={{ color: '#5b6470' }}>Línea de turnos</div>
            <div className="text-sm font-bold" style={{ color: '#161616' }}>{org.phone ?? '0800 888 5566'}</div>
          </div>
        </div>
      </div>

      {/* Pasos */}
      {showSteps && (
        <div className="bg-white border-b sticky top-0 z-10" style={{ borderColor: '#e5e7eb' }}>
          <div className="max-w-3xl mx-auto px-4 py-2.5 flex gap-2 flex-wrap">
            {STEPS.map((label, i) => {
              const n = i + 1
              const cur = STEP_NUM[step]
              const done = n < cur
              const active = n === cur
              return (
                <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px]"
                  style={{
                    backgroundColor: active ? alpha(accent, 0.1) : '#fff',
                    border: `1px solid ${active ? accent : '#e5e7eb'}`,
                    color: active ? '#161616' : '#8a929c', fontWeight: active ? 600 : 400,
                  }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-bold text-white"
                    style={{ backgroundColor: done ? '#2E7D32' : active ? accent : '#c7ccd2' }}>
                    {done ? '✓' : n}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-6">{children}</div>

      <div className="max-w-3xl mx-auto px-4 py-6 text-xs" style={{ color: '#8a929c' }}>
        Atención gratuita en los Centros de Salud Municipales. Ante una urgencia, llamá al <b>107</b> (Emergencias San Fernando, 24 h).
      </div>
    </div>
  )

  const BackBtn = ({ to, label = 'Volver' }: { to: Step; label?: string }) => (
    <button onClick={() => goto(to)}
      className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl mb-3"
      style={{ color: accent, backgroundColor: alpha(accent, 0.08) }}>
      <ChevronLeft className="w-4 h-4" /> {label}
    </button>
  )

  // ── Paso 1: Centro ───────────────────────────────────────────────
  if (step === 'centro') {
    const q = query.toLowerCase().trim()
    const filtered = centros.filter(c => (c.name + ' ' + (c.address ?? '')).toLowerCase().includes(q))
    return (
      <Shell>
        <h1 className="text-2xl font-extrabold mb-1" style={{ color: '#161616' }}>Elegí tu Centro de Salud</h1>
        <p className="text-[15px] mb-1" style={{ color: '#5b6470' }}>Seleccioná el centro más cercano a tu domicilio o el que prefieras.</p>
        <span className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-5"
          style={{ backgroundColor: alpha(AMBER, 0.16), color: '#8a5410' }}>100% gratuito · sin costo ni seña</span>

        <div className="relative mb-4">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }} />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nombre o dirección…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border text-[15px] outline-none"
            style={{ borderColor: '#d8ddd6', borderWidth: 2 }} />
        </div>

        {loadingCentros ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ backgroundColor: '#e9edf1' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <p style={{ color: '#5b6470' }}>No encontramos centros con ese nombre.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map(c => (
              <button key={c.id} onClick={() => pickCentro(c)}
                className="text-left bg-white rounded-2xl p-4 border transition-all hover:shadow-md"
                style={{ borderColor: '#e5e7eb', borderWidth: 1 }}>
                <div className="font-bold text-[16px] leading-tight mb-1.5" style={{ color: '#161616' }}>{c.name}</div>
                {c.address && <div className="flex items-start gap-1.5 text-sm" style={{ color: '#5b6470' }}><MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />{c.address}</div>}
                {c.phone && <div className="flex items-center gap-1.5 text-sm mt-0.5" style={{ color: '#5b6470' }}><Phone className="w-4 h-4 flex-shrink-0" />{c.phone}</div>}
              </button>
            ))}
          </div>
        )}
      </Shell>
    )
  }

  // ── Paso 2: Servicio ─────────────────────────────────────────────
  if (step === 'servicio' && centro) {
    const directos = entries.filter(e => !e.service.requiere_orden)
    const conOrden = entries.filter(e => e.service.requiere_orden)
    const ServiceBtn = (e: SvcEntry) => (
      <button key={e.service.id} onClick={() => pickService(e)}
        className="w-full flex items-center gap-3 bg-white border rounded-xl px-4 py-4 mb-2.5 text-left transition-all hover:shadow-md"
        style={{ borderColor: '#e5e7eb' }}>
        <span className="font-semibold flex-1" style={{ color: '#161616' }}>{e.service.name}</span>
        {e.service.requiere_orden && (
          <span className="text-[12px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
            style={{ backgroundColor: alpha(AMBER, 0.16), color: '#8a5410' }}>Requiere orden médica</span>
        )}
        <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: accent }} />
      </button>
    )
    return (
      <Shell>
        <BackBtn to="centro" label="Cambiar de centro" />
        <h1 className="text-2xl font-extrabold mb-1" style={{ color: '#161616' }}>{centro.name}</h1>
        <p className="text-sm mb-5 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: '#5b6470' }}>
          {centro.address && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{centro.address}</span>}
        </p>

        {loadingSvcs ? (
          <div className="space-y-2.5">{[1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: '#e9edf1' }} />)}</div>
        ) : entries.length === 0 ? (
          <div className="rounded-xl p-5 text-sm" style={{ backgroundColor: '#fff8e6', color: '#8a5410' }}>
            Este centro todavía no tiene agenda de turnos online disponible. Comunicate al {org.phone ?? '0800 888 5566'} (Lun a Vie, 7 a 19 h).
          </div>
        ) : (
          <>
            {directos.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: '#5b6470' }}>Atención primaria — acceso directo</h3>
                {directos.map(ServiceBtn)}
              </div>
            )}
            {conOrden.length > 0 && (
              <div className="mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: '#5b6470' }}>Especialidades — requieren orden del médico de cabecera</h3>
                {conOrden.map(ServiceBtn)}
              </div>
            )}
          </>
        )}
      </Shell>
    )
  }

  // ── Paso 2b: Gate de orden ───────────────────────────────────────
  if (step === 'orden' && selected && centro) {
    return (
      <Shell>
        <BackBtn to="servicio" label="Volver a especialidades" />
        <div className="bg-white border rounded-2xl p-6" style={{ borderColor: '#e5e7eb' }}>
          <h1 className="text-2xl font-extrabold mb-1" style={{ color: '#161616' }}>Antes de continuar</h1>
          <p className="text-[15px] mb-1" style={{ color: '#5b6470' }}>
            Elegiste <b style={{ color: '#161616' }}>{selected.service.name}</b> en {centro.name}.
          </p>
          <h2 className="text-lg font-bold mt-4 mb-4" style={{ color: '#161616' }}>
            ¿Tenés la orden de tu médico de cabecera para esta atención?
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => proceedAfterService(selected)}
              className="rounded-2xl p-5 text-center border-2 transition-all hover:shadow-md"
              style={{ borderColor: '#e5e7eb', backgroundColor: '#fff' }}>
              <ShieldCheck className="w-7 h-7 mx-auto mb-1.5" style={{ color: '#2E7D32' }} />
              <div className="font-bold" style={{ color: '#161616' }}>Sí, tengo la orden</div>
              <div className="text-sm" style={{ color: '#5b6470' }}>Continuar con la reserva</div>
            </button>
            <button onClick={() => goto('sinorden')}
              className="rounded-2xl p-5 text-center border-2 transition-all hover:shadow-md"
              style={{ borderColor: '#e5e7eb', backgroundColor: '#fff' }}>
              <FileText className="w-7 h-7 mx-auto mb-1.5" style={{ color: AMBER }} />
              <div className="font-bold" style={{ color: '#161616' }}>No tengo la orden</div>
              <div className="text-sm" style={{ color: '#5b6470' }}>Ver cómo obtenerla</div>
            </button>
          </div>
        </div>
      </Shell>
    )
  }

  // ── Paso 2c: Sin orden ───────────────────────────────────────────
  if (step === 'sinorden' && selected && centro) {
    const cab = cabeceraEntry()
    return (
      <Shell>
        <BackBtn to="orden" />
        <div className="rounded-2xl p-6 mb-5" style={{ backgroundColor: '#f2f7f0', borderLeft: `5px solid ${accent}` }}>
          <h1 className="text-xl font-extrabold mb-2" style={{ color: '#161616' }}>Para este turno necesitás una orden de tu médico de cabecera</h1>
          <p className="text-[15px] mb-2" style={{ color: '#333' }}>
            La atención que elegiste (<b>{selected.service.name}</b>) requiere que primero te vea tu <b>médico de cabecera</b>.
            Él o ella evalúa tu situación y, si corresponde, te da la <b>orden</b> para acceder a esta especialidad.
          </p>
          <p className="text-[15px]" style={{ color: '#333' }}>
            <b>¿Qué hacés ahora?</b> Sacá un turno con tu médico de cabecera en este mismo centro. Es gratuito, como todos los turnos.
            Cuando tengas la orden, volvés y reservás la especialidad sin problema.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {cab ? (
            <button onClick={() => proceedAfterService(cab)}
              className="text-white font-bold rounded-xl px-6 py-3.5" style={{ backgroundColor: accent }}>
              Sacar turno con mi médico de cabecera
            </button>
          ) : (
            <p className="text-sm" style={{ color: '#5b6470' }}>Consultá en la línea {org.phone ?? '0800 888 5566'} a qué centro acercarte.</p>
          )}
          <button onClick={() => goto('servicio')}
            className="font-bold rounded-xl px-6 py-3.5 border-2 bg-white" style={{ color: accent, borderColor: accent }}>
            Elegir otra atención
          </button>
        </div>
      </Shell>
    )
  }

  // ── Paso 2d: Profesional (cuando hay más de uno) ─────────────────
  if (step === 'profesional' && booking.service) {
    return (
      <Shell>
        <div className="bg-white border rounded-2xl p-5" style={{ borderColor: '#e5e7eb' }}>
          <ProfessionalSelector
            service={booking.service}
            selected={booking.professional}
            onSelect={p => update({ professional: p, fecha: undefined, hora: undefined })}
            onConfirm={() => goto('fechahora')}
            onBack={() => goto('servicio')}
            accentColor={accent}
            tenantType="medical"
          />
        </div>
      </Shell>
    )
  }

  // ── Paso 3: Fecha y hora ─────────────────────────────────────────
  if (step === 'fechahora' && booking.professional && booking.service) {
    const backTo: Step = selected?.service.requiere_orden ? 'orden' : 'servicio'
    return (
      <Shell>
        <div className="bg-white border rounded-2xl p-5" style={{ borderColor: '#e5e7eb' }}>
          <p className="text-sm mb-3" style={{ color: '#5b6470' }}>
            <b style={{ color: '#161616' }}>{booking.service.name}</b> · {centro?.name}
          </p>
          <DateTimeSelector
            professional={booking.professional}
            selectedDate={booking.fecha}
            selectedTime={booking.hora}
            serviceDurationMinutes={booking.service.duration_minutes ?? 20}
            serviceId={booking.service.id}
            onSelect={(fecha, hora) => { update({ fecha, hora }); goto('datos') }}
            onBack={() => goto(backTo)}
            accentColor={accent}
            weeksToShow={2}
          />
        </div>
      </Shell>
    )
  }

  // ── Paso 4: Datos ────────────────────────────────────────────────
  if (step === 'datos') {
    return (
      <Shell>
        <div className="bg-white border rounded-2xl p-5 sm:p-6" style={{ borderColor: '#e5e7eb' }}>
          <BookingConfirm
            state={booking}
            onChange={update}
            onBack={() => goto('fechahora')}
            onComplete={() => goto('ok')}
            tenantType="medical"
            accentColor={accent}
          />
        </div>
      </Shell>
    )
  }

  // ── Paso 5: Confirmación ─────────────────────────────────────────
  if (step === 'ok') {
    const requiereOrden = !!selected?.service.requiere_orden
    const fechaLabel = booking.fecha ? format(parseISO(booking.fecha), "EEEE d 'de' MMMM", { locale: es }) : ''
    return (
      <Shell>
        <div className="bg-white border rounded-2xl p-8 text-center" style={{ borderColor: '#e5e7eb' }}>
          <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#2E7D32' }}>
            <CheckCircle className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold mb-1" style={{ color: '#161616' }}>¡Tu turno está confirmado!</h1>
          <p className="text-[15px] mb-5" style={{ color: '#5b6470' }}>Te esperamos en el centro el día del turno.</p>

          <div className="rounded-xl p-4 text-left max-w-md mx-auto mb-5" style={{ backgroundColor: '#F4F6F8' }}>
            {[
              ['Centro', centro?.name],
              ['Dirección', centro?.address],
              ['Atención', booking.service?.name],
              ['Día', fechaLabel],
              ['Hora', booking.hora ? `${booking.hora} h` : ''],
              ['A nombre de', booking.nombre],
            ].map(([k, v]) => v ? (
              <div key={k} className="flex gap-3 py-1.5 border-b last:border-0 text-sm" style={{ borderColor: '#e5e7eb' }}>
                <span className="flex-none w-32" style={{ color: '#5b6470' }}>{k}</span>
                <span className="font-semibold capitalize" style={{ color: '#161616' }}>{v}</span>
              </div>
            ) : null)}
          </div>

          <div className="rounded-xl p-4 text-left max-w-md mx-auto mb-6" style={{ backgroundColor: alpha(AMBER, 0.12) }}>
            <div className="flex items-center gap-2 font-bold mb-1" style={{ color: '#8a5410' }}>
              <FileText className="w-4 h-4" /> No te olvides de traer:
            </div>
            <div className="text-sm" style={{ color: '#8a5410' }}>
              Tu <b>DNI</b>{requiereOrden && <> y la <b>orden de tu médico de cabecera</b> (sin la orden no se podrá realizar la atención)</>}.
            </div>
          </div>

          <button onClick={() => { setBooking(INITIAL); setSelected(null); setCentro(null); goto('centro') }}
            className="text-white font-bold rounded-xl px-6 py-3.5 inline-flex items-center gap-2" style={{ backgroundColor: accent }}>
            <CalendarCheck className="w-5 h-5" /> Sacar otro turno
          </button>
          <p className="text-sm mt-4" style={{ color: '#8a929c' }}>Si no vas a poder asistir, cancelá tu turno para que otro vecino pueda usarlo.</p>
        </div>
      </Shell>
    )
  }

  return <Shell showSteps={false}><div className="py-20 text-center" style={{ color: '#5b6470' }}>Cargando…</div></Shell>
}
