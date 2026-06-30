import { useState } from 'react'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isBefore, startOfDay, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Professional } from '../../types'
import { useAvailability } from '../../hooks/useAvailability'
import { alpha } from '../../lib/color'

interface Props {
  professional: Professional
  selectedDate?: string
  selectedTime?: string
  onSelect: (fecha: string, hora: string) => void
  onBack: () => void
  accentColor?: string
}

export function DateTimeSelector({ professional, selectedDate, selectedTime, onSelect, onBack, accentColor = '#0ea5e9' }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [localDate, setLocalDate]       = useState(selectedDate)
  const [localTime, setLocalTime]       = useState(selectedTime)

  const { slots, loading, availableDates } = useAvailability(professional.id, localDate)

  const today    = startOfDay(new Date())
  const days     = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const startPad = getDay(startOfMonth(currentMonth)) === 0 ? 6 : getDay(startOfMonth(currentMonth)) - 1

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-colors mb-4"
        style={{ color: accentColor, backgroundColor: alpha(accentColor, 0.08) }}
      >
        <ChevronLeft className="w-4 h-4" /> Volver
      </button>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Elegi fecha y hora</h2>
      <p className="text-sm text-gray-500 mb-4">Los dias disponibles estan marcados en el calendario</p>

      {/* Calendario */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="font-semibold text-gray-900 capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </span>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <div className="grid grid-cols-7 mb-2">
          {['Lu','Ma','Mi','Ju','Vi','Sa','Do'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startPad }).map((_, i) => <div key={'p' + i} />)}
          {days.map(day => {
            const dateStr    = format(day, 'yyyy-MM-dd')
            const isPast     = isBefore(day, today)
            const isAvailable = availableDates.has(dateStr)
            const isSelected  = localDate === dateStr
            return (
              <button
                key={dateStr}
                onClick={() => { if (isAvailable && !isPast) { setLocalDate(dateStr); setLocalTime(undefined) } }}
                disabled={!isAvailable || isPast}
                className="aspect-square rounded-xl text-sm font-medium transition-all"
                style={
                  isSelected
                    ? { backgroundColor: accentColor, color: '#fff' }
                    : isAvailable && !isPast
                      ? { backgroundColor: alpha(accentColor, 0.08), color: '#111827', border: '1px solid ' + alpha(accentColor, 0.2) }
                      : { color: '#d1d5db', cursor: 'not-allowed' }
                }
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>
      </div>

      {/* Horarios */}
      {localDate && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: accentColor }} />
            Horarios — {format(parseISO(localDate), "d 'de' MMMM", { locale: es })}
          </h3>
          {loading ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No hay horarios disponibles</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slots.map(slot => (
                <button
                  key={slot.hora}
                  onClick={() => slot.disponible && setLocalTime(slot.hora)}
                  disabled={!slot.disponible}
                  className="py-2 rounded-xl text-sm font-medium transition-all"
                  style={
                    !slot.disponible
                      ? { backgroundColor: '#f9fafb', color: '#d1d5db', textDecoration: 'line-through', cursor: 'not-allowed' }
                      : localTime === slot.hora
                        ? { backgroundColor: accentColor, color: '#fff' }
                        : { backgroundColor: alpha(accentColor, 0.08), color: accentColor }
                  }
                >
                  {slot.hora}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {localDate && localTime && (
        <button
          onClick={() => onSelect(localDate, localTime)}
          className="w-full text-white py-3.5 rounded-2xl font-semibold transition-colors shadow-sm"
          style={{ backgroundColor: accentColor }}
        >
          Continuar — {format(parseISO(localDate), "d/MM", { locale: es })} a las {localTime}hs
        </button>
      )}
    </div>
  )
}
