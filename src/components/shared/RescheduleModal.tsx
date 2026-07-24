import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react'
import { format, addDays, startOfWeek, subWeeks, addWeeks, isBefore, startOfDay, isSameDay, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { useAvailability } from '../../hooks/useAvailability'

const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

interface Props {
  appointmentId: string
  professionalId: string
  serviceDurationMinutes: number
  serviceId?: string
  currentStartsAt: string
  onClose: () => void
  onRescheduled: (newStartsAt: string, newEndsAt: string) => void
}

export function RescheduleModal({
  appointmentId, professionalId, serviceDurationMinutes, serviceId, currentStartsAt, onClose, onRescheduled,
}: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedHora, setSelectedHora] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const { slots, availableDates } = useAvailability(professionalId, selectedDate, serviceDurationMinutes, appointmentId, serviceId)

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

  const handleConfirm = async () => {
    if (!selectedDate || !selectedHora) return
    setSaving(true); setErrorMsg('')
    const newStartsAt = `${selectedDate}T${selectedHora}:00-03:00`
    const { data, error } = await supabase.rpc('reprogramar_turno', {
      p_appointment_id: appointmentId,
      p_starts_at:      newStartsAt,
    })
    if (error) {
      setErrorMsg(error.message ?? 'Error al reprogramar el turno')
      setSaving(false)
      return
    }
    const result = data as { id?: string; starts_at?: string; ends_at?: string; error?: string }
    if (result?.error === 'slot_taken') {
      setErrorMsg('Ese horario ya fue reservado o alcanzó el cupo máximo. Elegí otro.')
      setSaving(false)
      return
    }
    if (result?.error) {
      setErrorMsg('No se pudo reprogramar el turno.')
      setSaving(false)
      return
    }
    onRescheduled(result.starts_at!, result.ends_at!)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15,23,42,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-gray-900">Reprogramar turno</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <p className="text-xs text-gray-400">
            Turno actual: {format(parseISO(currentStartsAt), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}hs
          </p>

          {errorMsg && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{errorMsg}</p>
            </div>
          )}

          <div>
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
          </div>

          {selectedDate && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Horario</h4>
              {slots.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">No hay turnos disponibles ese día</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map(s => (
                    <button key={s.hora}
                      disabled={!s.disponible}
                      onClick={() => setSelectedHora(s.hora)}
                      className={`py-2 rounded-xl text-sm font-medium transition-colors flex flex-col items-center gap-0.5 ${
                        s.disponible
                          ? selectedHora === s.hora
                            ? 'bg-sky-500 text-white'
                            : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                          : 'bg-gray-100 text-gray-300 cursor-not-allowed line-through'
                      }`}
                    >
                      <span>{s.hora}</span>
                      {s.disponible && typeof s.cuposRestantes === 'number' && <span className="text-[9px] opacity-70">{s.cuposRestantes} cupos</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={handleConfirm} disabled={!selectedDate || !selectedHora || saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white font-medium transition-colors">
            <CheckCircle className="w-4 h-4" />
            {saving ? 'Reprogramando...' : 'Confirmar nuevo horario'}
          </button>
        </div>
      </div>
    </div>
  )
}
