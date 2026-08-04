import { useEffect, useState } from 'react'
import { UserPlus, ChevronRight, ChevronLeft, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { format, addDays, startOfWeek, subWeeks, addWeeks, isBefore, startOfDay, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { useAvailability } from '../../hooks/useAvailability'

const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

interface Professional { id: string; full_name: string; specialty?: string }
interface Service      { id: string; name: string; duration_minutes: number }

interface InitialPatient {
  full_name: string
  phone?: string
  email?: string
  dni?: string
  obra_social?: string
  nro_socio?: string
  notes?: string
}

interface Props {
  organizationId: string
  initialPatient?: InitialPatient | null
}

type Step = 'profesional' | 'servicio' | 'fecha' | 'paciente' | 'confirmar'

const STEPS: Step[] = ['profesional', 'servicio', 'fecha', 'paciente', 'confirmar']
const STEP_LABELS: Record<Step, string> = {
  profesional: 'Profesional',
  servicio:    'Servicio',
  fecha:       'Fecha y hora',
  paciente:    'Paciente',
  confirmar:   'Confirmar',
}

export function NuevoTurnoRecepcion({ organizationId, initialPatient }: Props) {
  const [step, setStep]                   = useState<Step>('profesional')
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [services, setServices]           = useState<Service[]>([])
  const [selectedPro, setSelectedPro]     = useState<Professional | null>(null)
  const [selectedSvc, setSelectedSvc]     = useState<Service | null>(null)
  const [selectedDate, setSelectedDate]   = useState('')
  const [selectedHora, setSelectedHora]   = useState('')
  const [saving, setSaving]               = useState(false)
  const [success, setSuccess]             = useState(false)
  const [wasWaitlisted, setWasWaitlisted] = useState(false)
  const [errorMsg, setErrorMsg]           = useState('')

  // Paciente (precargado si venimos desde la búsqueda de pacientes)
  const [patientName,  setPatientName]  = useState(initialPatient?.full_name ?? '')
  const [patientPhone, setPatientPhone] = useState(initialPatient?.phone ?? '')
  const [patientEmail, setPatientEmail] = useState(initialPatient?.email ?? '')
  const [patientDni,   setPatientDni]   = useState(initialPatient?.dni ?? '')
  const [obraSocial,   setObraSocial]   = useState(initialPatient?.obra_social ?? '')
  const [nroSocio,     setNroSocio]     = useState(initialPatient?.nro_socio ?? '')
  const [notas,        setNotas]        = useState(initialPatient?.notes ?? '')

  // Calendario semanal
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))

  // Slots de disponibilidad
  const { slots, availableDates } = useAvailability(selectedPro?.id, selectedDate, selectedSvc?.duration_minutes ?? 30, undefined, selectedSvc?.id)

  const todayStart = startOfDay(new Date())
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const maxDate = (() => { const d = startOfDay(new Date()); d.setMonth(d.getMonth() + 2); return d })()
  const isPrevWeekDisabled = isBefore(addDays(weekStart, 6), todayStart)
  const isNextWeekDisabled = isBefore(maxDate, addDays(weekStart, 7))
  const weekLabel = (() => {
    const s = weekStart, e = addDays(weekStart, 6)
    return s.getMonth() === e.getMonth()
      ? `${format(s, 'd')} – ${format(e, 'd')} ${format(e, 'MMMM', { locale: es })}`
      : `${format(s, "d MMM", { locale: es })} – ${format(e, "d MMM", { locale: es })}`
  })()

  useEffect(() => {
    supabase
      .from('professionals')
      .select('id, full_name, specialty')
      .eq('organization_id', organizationId)
      .eq('active', true)
      .order('full_name')
      .then(({ data }) => setProfessionals((data ?? []) as Professional[]))
  }, [organizationId])

  useEffect(() => {
    if (!selectedPro) return
    supabase
      .from('professional_services')
      .select('services(id, name, duration_minutes, active, capacity, waitlist_limit)')
      .eq('professional_id', selectedPro.id)
      .then(({ data }) => {
        const svcs = (data ?? [])
          .map((r: any) => r.services)
          .filter((s: any) => s?.active)
          .sort((a: any, b: any) => a.name.localeCompare(b.name))
        setServices(svcs as Service[])
      })
  }, [selectedPro, organizationId])

  const handleConfirm = async () => {
    if (!selectedPro || !selectedSvc || !selectedDate || !selectedHora || !patientName || !patientPhone) return
    setSaving(true); setErrorMsg('')
    try {
      const startsAt = `${selectedDate}T${selectedHora}:00-03:00`
      const { data, error } = await supabase.rpc('reservar_turno', {
        p_professional_id:     selectedPro.id,
        p_service_id:          selectedSvc.id,
        p_starts_at:           startsAt,
        p_patient_name:        patientName,
        p_patient_phone:       patientPhone,
        p_patient_email:       patientEmail || undefined,
        p_patient_dni:         patientDni   || undefined,
        p_patient_obra_social: obraSocial   || undefined,
        p_patient_nro_socio:   nroSocio     || undefined,
        p_patient_notes:       notas        || undefined,
      })
      if (error) throw error
      const result = data as { id?: string; status?: string; error?: string }
      if (result?.error === 'slot_taken') {
        setErrorMsg('Ese horario ya fue reservado. Elegí otro.')
        setStep('fecha'); setSaving(false); return
      }
      if (result?.error === 'cupo_completo') {
        setErrorMsg('Ese horario alcanzó el cupo máximo y la lista de espera también está completa. Elegí otro.')
        setStep('fecha'); setSaving(false); return
      }
      if (result?.error === 'service_conflict') {
        setErrorMsg('Ese horario no está disponible por un turno de otro servicio que ocupa a la profesional en ese momento. Elegí otro.')
        setStep('fecha'); setSaving(false); return
      }
      if (result?.error) throw new Error(result.error)
      setWasWaitlisted(result?.status === 'lista_espera')
      setSuccess(true)
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Error al crear el turno')
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setStep('profesional')
    setSelectedPro(null); setSelectedSvc(null)
    setSelectedDate(''); setSelectedHora('')
    setPatientName(''); setPatientPhone(''); setPatientEmail('')
    setPatientDni(''); setObraSocial(''); setNroSocio(''); setNotas('')
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
    setSuccess(false); setWasWaitlisted(false); setErrorMsg('')
  }

  if (success) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
      {wasWaitlisted ? (
        <Clock className="w-12 h-12 text-amber-500 mx-auto mb-3" />
      ) : (
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
      )}
      <h3 className="font-semibold text-gray-900 text-lg mb-1">{wasWaitlisted ? 'Anotado en lista de espera' : 'Turno creado'}</h3>
      <p className="text-sm text-gray-500 mb-1">
        {patientName} — {selectedPro?.full_name}
      </p>
      <p className="text-sm text-gray-500 mb-6">
        {selectedDate} a las {selectedHora}hs · {selectedSvc?.name}
        {wasWaitlisted && ' · Se le avisará por mail si se libera un cupo.'}
      </p>
      <button onClick={reset}
        className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-xl transition-colors">
        Nuevo turno
      </button>
    </div>
  )

  const stepIdx = STEPS.indexOf(step)

  return (
    <div className="space-y-5">
      {initialPatient && (
        <div className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-xl px-4 py-2.5">
          <UserPlus className="w-4 h-4 text-sky-600 flex-shrink-0" />
          <p className="text-sm text-sky-800">Turno nuevo para <span className="font-semibold">{initialPatient.full_name}</span></p>
        </div>
      )}
      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => i < stepIdx && setStep(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                s === step
                  ? 'bg-sky-500 text-white'
                  : i < stepIdx
                  ? 'bg-sky-100 text-sky-700 cursor-pointer hover:bg-sky-200'
                  : 'bg-gray-100 text-gray-400 cursor-default'
              }`}
            >
              {STEP_LABELS[s]}
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600">{errorMsg}</p>
        </div>
      )}

      {/* Paso 1: Profesional */}
      {step === 'profesional' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Elegí el profesional</h3>
          <div className="space-y-2">
            {professionals.map(p => (
              <button key={p.id} onClick={() => { setSelectedPro(p); setSelectedSvc(null); setStep('servicio') }}
                className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-sky-400 hover:bg-sky-50 transition-colors">
                <div className="text-sm font-medium text-gray-900">{p.full_name}</div>
                {p.specialty && <div className="text-xs text-gray-500 mt-0.5">{p.specialty}</div>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Paso 2: Servicio */}
      {step === 'servicio' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-1">Elegí el servicio</h3>
          <p className="text-xs text-gray-400 mb-4">{selectedPro?.full_name}</p>
          <div className="space-y-2">
            {services.map(s => (
              <button key={s.id} onClick={() => { setSelectedSvc(s); setSelectedDate(''); setSelectedHora(''); setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })); setStep('fecha') }}
                className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-sky-400 hover:bg-sky-50 transition-colors">
                <div className="text-sm font-medium text-gray-900">{s.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.duration_minutes} min</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Paso 3: Fecha y hora */}
      {step === 'fecha' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-1">Fecha</h3>
            <p className="text-xs text-gray-400 mb-4">{selectedPro?.full_name} · {selectedSvc?.name}</p>

            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setWeekStart(w => subWeeks(w, 1))} disabled={isPrevWeekDisabled}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30 bg-gray-100 hover:bg-gray-200">
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="font-semibold text-gray-900 capitalize text-sm">{weekLabel}</span>
              <button onClick={() => setWeekStart(w => addWeeks(w, 1))} disabled={isNextWeekDisabled}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30 bg-gray-100 hover:bg-gray-200">
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map((day, i) => {
                const dateStr     = format(day, 'yyyy-MM-dd')
                const isPast      = isBefore(day, todayStart)
                const isAvailable = availableDates.has(dateStr)
                const isSelected  = selectedDate === dateStr
                const isToday     = isSameDay(day, new Date())
                return (
                  <button key={dateStr}
                    onClick={() => { if (isAvailable && !isPast) { setSelectedDate(dateStr); setSelectedHora('') } }}
                    disabled={!isAvailable || isPast}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all ${
                      isSelected
                        ? 'bg-sky-500 text-white'
                        : isAvailable && !isPast
                        ? 'bg-sky-50 border border-sky-200 cursor-pointer hover:bg-sky-100'
                        : 'opacity-35 cursor-not-allowed'
                    }`}
                  >
                    <span className={`text-[10px] font-medium ${isSelected ? 'text-white' : isToday ? 'text-sky-600' : 'text-gray-400'}`}>
                      {DAYS[i]}
                    </span>
                    <span className={`text-sm font-semibold ${isSelected ? 'text-white' : isAvailable && !isPast ? 'text-gray-900' : 'text-gray-300'}`}>
                      {format(day, 'd')}
                    </span>
                    {isAvailable && !isPast && !isSelected && <span className="w-1 h-1 rounded-full bg-sky-500" />}
                  </button>
                )
              })}
            </div>
            {!Array.from(availableDates).some(d => d >= format(todayStart, 'yyyy-MM-dd')) && (
              <p className="text-sm text-gray-400 text-center pt-4">No hay fechas disponibles en los próximos 2 meses</p>
            )}
          </div>

          {selectedDate && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Horario</h3>
              {slots.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">No hay turnos disponibles ese día</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map(s => {
                    const seleccionable = s.disponible || s.enListaDeEspera
                    const esEspera = s.enListaDeEspera && !s.disponible
                    return (
                    <button key={s.hora}
                      disabled={!seleccionable}
                      onClick={() => { if (seleccionable) { setSelectedHora(s.hora); setStep('paciente') } }}
                      className={`py-2 rounded-xl text-sm font-medium transition-colors flex flex-col items-center gap-0.5 ${
                        !seleccionable
                          ? 'bg-gray-100 text-gray-300 cursor-not-allowed line-through'
                          : esEspera
                            ? selectedHora === s.hora ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : selectedHora === s.hora
                              ? 'bg-sky-500 text-white'
                              : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                      }`}
                    >
                      <span>{s.hora}</span>
                      {esEspera && <span className="text-[9px] opacity-80">Lista de espera</span>}
                      {s.disponible && typeof s.cuposRestantes === 'number' && <span className="text-[9px] opacity-70">{s.cuposRestantes} cupos</span>}
                    </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Paso 4: Paciente */}
      {step === 'paciente' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Datos del paciente</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input value={patientName} onChange={e => setPatientName(e.target.value)}
                  placeholder="Ej: María González"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
                <input value={patientPhone} onChange={e => setPatientPhone(e.target.value)}
                  placeholder="Ej: 11 1234-5678"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={patientEmail} onChange={e => setPatientEmail(e.target.value)}
                  placeholder="correo@email.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DNI</label>
                  <input value={patientDni} onChange={e => setPatientDni(e.target.value)}
                    placeholder="12.345.678"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Obra social</label>
                  <input value={obraSocial} onChange={e => setObraSocial(e.target.value)}
                    placeholder="Ej: OSDE"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nro de obra social</label>
                <input value={nroSocio} onChange={e => setNroSocio(e.target.value)}
                  placeholder="Nro de obra social"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                  placeholder="Ej: paciente prefiere turno a la mañana, viene con acompañante, etc."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
            </div>
            <button
              onClick={() => { if (patientName && patientPhone) setStep('confirmar') }}
              disabled={!patientName || !patientPhone}
              className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Paso 5: Confirmar */}
      {step === 'confirmar' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-sky-500" />
            Confirmación
          </h3>
          <div className="space-y-2 mb-6">
            {[
              ['Profesional', selectedPro?.full_name ?? ''],
              ['Servicio',    selectedSvc?.name ?? ''],
              ['Fecha',       selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : ''],
              ['Hora',        selectedHora ? `${selectedHora}hs` : ''],
              ['Paciente',    patientName],
              ['Teléfono',    patientPhone],
              ...(patientEmail ? [['Email', patientEmail] as [string, string]] : []),
              ...(patientDni   ? [['DNI',   patientDni]   as [string, string]] : []),
              ...(obraSocial   ? [['Obra social', obraSocial] as [string, string]] : []),
              ...(nroSocio     ? [['Nro de obra social', nroSocio] as [string, string]] : []),
              ...(notas        ? [['Observaciones', notas] as [string, string]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-start gap-4 py-2 border-b border-gray-50 last:border-0">
                <span className="text-xs font-medium text-gray-400 flex-shrink-0">{label}</span>
                <span className="text-sm text-gray-900 text-right">{value}</span>
              </div>
            ))}
          </div>
          <button onClick={handleConfirm} disabled={saving}
            className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-medium transition-colors disabled:opacity-50">
            {saving ? 'Creando turno...' : 'Confirmar turno'}
          </button>
        </div>
      )}
    </div>
  )
}
