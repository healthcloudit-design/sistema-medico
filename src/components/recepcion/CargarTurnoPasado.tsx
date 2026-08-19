import { useEffect, useState } from 'react'
import { CalendarClock, CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Professional { id: string; full_name: string; specialty?: string }
interface Service      { id: string; name: string; duration_minutes: number }

interface Props { organizationId: string }

/**
 * Carga retroactiva de turnos (recepción): registra un turno que YA ocurrió aunque no se haya
 * cargado en su momento — sin las restricciones de disponibilidad (fecha/hora libre). Sirve para
 * profesionales que cargan sus atenciones al final del día. Estado elegible: Atendido / Confirmado.
 */
export function CargarTurnoPasado({ organizationId }: Props) {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [services, setServices]           = useState<Service[]>([])
  const [proId, setProId]                 = useState('')
  const [svcId, setSvcId]                 = useState('')
  const [fecha, setFecha]                 = useState('')
  const [hora, setHora]                   = useState('')
  const [estado, setEstado]               = useState<'completado' | 'confirmado'>('completado')

  const [nombre, setNombre]     = useState('')
  const [telefono, setTelefono] = useState('')
  const [dni, setDni]           = useState('')
  const [obraSocial, setObraSocial] = useState('')
  const [nroSocio, setNroSocio] = useState('')
  const [email, setEmail]       = useState('')
  const [notas, setNotas]       = useState('')

  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const hoy = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!organizationId) return
    supabase.from('professionals').select('id, full_name, specialty')
      .eq('organization_id', organizationId).eq('active', true).order('full_name')
      .then(({ data }) => {
        const ps = (data ?? []) as Professional[]
        setProfessionals(ps)
        if (ps.length > 0) setProId(ps[0].id)
      })
  }, [organizationId])

  useEffect(() => {
    if (!proId) { setServices([]); setSvcId(''); return }
    supabase.from('professional_services')
      .select('services(id, name, duration_minutes, active)')
      .eq('professional_id', proId)
      .then(({ data }) => {
        const svcs = (data ?? [])
          .map((r: any) => r.services)
          .filter((s: any) => s?.active)
          .sort((a: any, b: any) => a.name.localeCompare(b.name)) as Service[]
        setServices(svcs)
        setSvcId(svcs.length > 0 ? svcs[0].id : '')
      })
  }, [proId])

  const canSubmit = proId && svcId && fecha && hora && nombre.trim() && telefono.trim() && !saving

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true); setErrorMsg('')
    try {
      const startsAt = `${fecha}T${hora}:00-03:00`
      const { data, error } = await supabase.rpc('registrar_turno_pasado', {
        p_professional_id:     proId,
        p_service_id:          svcId,
        p_starts_at:           startsAt,
        p_patient_name:        nombre,
        p_patient_phone:       telefono,
        p_status:              estado,
        p_patient_email:       email      || undefined,
        p_patient_dni:         dni        || undefined,
        p_patient_obra_social: obraSocial || undefined,
        p_patient_nro_socio:   nroSocio   || undefined,
        p_patient_notes:       notas      || undefined,
      })
      if (error) throw error
      const result = data as { id?: string; status?: string; error?: string }
      if (result?.error === 'not_authorized') { setErrorMsg('No tenés permiso para cargar turnos.'); setSaving(false); return }
      if (result?.error) throw new Error(result.error)
      setSuccess(true)
    } catch (e: any) {
      setErrorMsg(e.message ?? 'No se pudo cargar el turno. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setSvcId(services[0]?.id ?? '')
    setFecha(''); setHora(''); setEstado('completado')
    setNombre(''); setTelefono(''); setDni(''); setObraSocial(''); setNroSocio(''); setEmail(''); setNotas('')
    setSuccess(false); setErrorMsg('')
  }

  if (success) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
      <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
      <h3 className="font-semibold text-gray-900 text-lg mb-1">Turno cargado</h3>
      <p className="text-sm text-gray-500 mb-6">
        {nombre} — {fecha} a las {hora}hs · {estado === 'completado' ? 'Atendido' : 'Confirmado'}
      </p>
      <button onClick={reset}
        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors">
        Cargar otro turno
      </button>
    </div>
  )

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-slate-600" />
          Cargar turno pasado
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          Registrá un turno que ya ocurrió (por ejemplo, atenciones que se cargan al final del día). Podés elegir cualquier fecha y hora.
        </p>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Profesional *</label>
              <select value={proId} onChange={e => setProId(e.target.value)} className={inputCls}>
                {professionals.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name}{p.specialty ? ` — ${p.specialty}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Servicio *</label>
              <select value={svcId} onChange={e => setSvcId(e.target.value)} className={inputCls}>
                {services.length === 0 && <option value="">Sin servicios</option>}
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                <input type="date" value={fecha} max={hoy} onChange={e => setFecha(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora *</label>
                <input type="time" value={hora} onChange={e => setHora(e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <div className="grid grid-cols-2 gap-2">
              {([['completado', 'Atendido'], ['confirmado', 'Confirmado']] as const).map(([val, lbl]) => (
                <button key={val} type="button" onClick={() => setEstado(val)}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    estado === val ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Paciente */}
          <div className="pt-1 border-t border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-3 mb-2">Datos del paciente</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: María González" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
                <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: 11 1234-5678" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DNI</label>
                  <input value={dni} onChange={e => setDni(e.target.value)} placeholder="12.345.678" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Obra social</label>
                  <input value={obraSocial} onChange={e => setObraSocial(e.target.value)} placeholder="Ej: OSDE" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nro de obra social</label>
                <input value={nroSocio} onChange={e => setNroSocio(e.target.value)} placeholder="Nro de socio / carnet" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@email.com" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} placeholder="Notas de la atención" className={`${inputCls} resize-none`} />
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{errorMsg}</p>
            </div>
          )}

          <button onClick={handleSubmit} disabled={!canSubmit}
            className="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-medium transition-colors disabled:opacity-50">
            {saving ? 'Cargando...' : 'Cargar turno'}
          </button>
        </div>
      </div>
    </div>
  )
}
