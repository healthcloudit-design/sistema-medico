import { useEffect, useState } from 'react'
import { UserPlus, ChevronRight, CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAvailability } from '../../hooks/useAvailability'

interface Professional { id: string; full_name: string; specialty?: string }
interface Service      { id: string; name: string; duration_minutes: number }

interface Props { organizationId: string }

type Step = 'profesional' | 'servicio' | 'fecha' | 'paciente' | 'confirmar'

const STEPS: Step[] = ['profesional', 'servicio', 'fecha', 'paciente', 'confirmar']
const STEP_LABELS: Record<Step, string> = {
  profesional: 'Profesional',
  servicio:    'Servicio',
  fecha:       'Fecha y hora',
  paciente:    'Paciente',
  confirmar:   'Confirmar',
}

export function NuevoTurnoRecepcion({ organizationId }: Props) {
  const [step, setStep]                   = useState<Step>('profesional')
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [services, setServices]           = useState<Service[]>([])
  const [selectedPro, setSelectedPro]     = useState<Professional | null>(null)
  const [selectedSvc, setSelectedSvc]     = useState<Service | null>(null)
  const [selectedDate, setSelectedDate]   = useState('')
  const [selectedHora, setSelectedHora]   = useState('')
  const [saving, setSaving]               = useState(false)
  const [success, setSuccess]             = useState(false)
  const [errorMsg, setErrorMsg]           = useState('')

  // Paciente
  const [patientName,  setPatientName]  = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [patientEmail, setPatientEmail] = useState('')
  const [patientDni,   setPatientDni]   = useState('')
  const [obraSocial,   setObraSocial]   = useState('')

  // Slots de disponibilidad
  const { slots, availableDates } = useAvailability(selectedPro?.id, selectedDate)

  const today = new Date().toISOString().slice(0, 10)

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
      .select('services(id, name, duration_minutes, active)')
      .eq('professional_id', selectedPro.id)
      .then(({ data }) => {
        const svcs = (data ?? [])
          .map((r: any) => r.services)
          .filter((s: any) => s?.active)
          .sort((a: any, b: any) => a.name.localeCompare(b.name))
        setServices(svcs as Service[])
      })
  }, [selectedPro, organizationId])

  // Generar días disponibles para el mes actual + siguiente
  const availableDateList: string[] = []
  const cursor = new Date(today)
  const limit  = new Date(today)
  limit.setMonth(limit.getMonth() + 2)
  while (cursor <= limit) {
    const ds = cursor.toISOString().slice(0, 10)
    if (availableDates.has(ds)) availableDateList.push(ds)
    cursor.setDate(cursor.getDate() + 1)
  }

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
      })
      if (error) throw error
      const result = data as { id?: string; error?: string }
      if (result?.error === 'slot_taken') {
        setErrorMsg('Ese horario ya fue reservado. Elegí otro.')
        setStep('fecha'); setSaving(false); return
      }
      if (result?.error) throw new Error(result.error)
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
    setPatientDni(''); setObraSocial('')
    setSuccess(false); setErrorMsg('')
  }

  if (success) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
      <h3 className="font-semibold text-gray-900 text-lg mb-1">Turno creado</h3>
      <p className="text-sm text-gray-500 mb-1">
        {patientName} — {selectedPro?.full_name}
      </p>
      <p className="text-sm text-gray-500 mb-6">
        {selectedDate} a las {selectedHora}hs · {selectedSvc?.name}
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
              <button key={s.id} onClick={() => { setSelectedSvc(s); setSelectedDate(''); setSelectedHora(''); setStep('fecha') }}
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
            {availableDateList.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No hay fechas disponibles en los próximos 2 meses</p>
            ) : (
              <select
                value={selectedDate}
                onChange={e => { setSelectedDate(e.target.value); setSelectedHora('') }}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">Seleccioná una fecha</option>
                {availableDateList.map(d => (
                  <option key={d} value={d}>{new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' })}</option>
                ))}
              </select>
            )}
          </div>

          {selectedDate && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Horario</h3>
              {slots.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">No hay turnos disponibles ese día</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map(s => (
                    <button key={s.hora}
                      disabled={!s.disponible}
                      onClick={() => { setSelectedHora(s.hora); setStep('paciente') }}
                      className={`py-2 rounded-xl text-sm font-medium transition-colors ${
                        s.disponible
                          ? selectedHora === s.hora
                            ? 'bg-sky-500 text-white'
                            : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                          : 'bg-gray-100 text-gray-300 cursor-not-allowed line-through'
                      }`}
                    >
                      {s.hora}
                    </button>
                  ))}
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
