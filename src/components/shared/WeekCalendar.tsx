import { useMemo } from 'react'
import { format, startOfWeek, addDays, parseISO, isToday, addWeeks, subWeeks } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Appointment } from '../../types'

interface Props {
  appointments: Appointment[]
  currentWeek: Date
  onWeekChange: (d: Date) => void
  onSelect: (a: Appointment) => void
}

// Rango horario visible
const HOUR_START = 7   // 07:00
const HOUR_END   = 21  // 21:00
const TOTAL_MINS = (HOUR_END - HOUR_START) * 60
const PX_PER_MIN = 2   // 2px por minuto → 60px por hora

const STATUS_COLORS: Record<string, string> = {
  confirmado:   '#0ea5e9',
  pendiente:    '#f59e0b',
  en_atencion:  '#8b5cf6',
  completado:   '#22c55e',
  cancelado:    '#ef4444',
  no_asistio:   '#6b7280',
  lista_espera: '#d97706',
}

function toArgMins(iso: string): number {
  // Convierte ISO UTC a minutos desde medianoche Argentina (UTC-3)
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d  = new Date(ms)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

function toArgDateStr(iso: string): string {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d  = new Date(ms)
  return format(d, 'yyyy-MM-dd')
}

export function WeekCalendar({ appointments, currentWeek, onWeekChange, onSelect }: Props) {
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }) // Lunes
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Agrupar appointments por fecha (Argentina)
  const byDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {}
    for (const a of appointments) {
      if (a.status === 'cancelado') continue
      const dateStr = toArgDateStr(a.starts_at)
      if (!map[dateStr]) map[dateStr] = []
      map[dateStr].push(a)
    }
    return map
  }, [appointments])

  // Horas del eje Y
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)
  const gridHeight = TOTAL_MINS * PX_PER_MIN

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header navegación */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button
          onClick={() => onWeekChange(subWeeks(currentWeek, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-sm font-semibold text-gray-900 capitalize">
          {format(weekStart, "d 'de' MMMM", { locale: es })}
          {' — '}
          {format(addDays(weekStart, 6), "d 'de' MMMM yyyy", { locale: es })}
        </span>
        <button
          onClick={() => onWeekChange(addWeeks(currentWeek, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Días header */}
      <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
        <div /> {/* espacio eje Y */}
        {days.map(day => {
          const isT = isToday(day)
          return (
            <div key={day.toISOString()} className="text-center py-2 border-l border-gray-50">
              <div className="text-xs text-gray-400 uppercase tracking-wide">
                {format(day, 'EEE', { locale: es })}
              </div>
              <div className={[
                'text-sm font-semibold mx-auto w-7 h-7 rounded-full flex items-center justify-center mt-0.5',
                isT ? 'bg-sky-600 text-white' : 'text-gray-900'
              ].join(' ')}>
                {format(day, 'd')}
              </div>
            </div>
          )
        })}
      </div>

      {/* Grilla + appointments */}
      <div className="overflow-y-auto" style={{ maxHeight: '560px' }}>
        <div className="relative grid" style={{ gridTemplateColumns: '48px repeat(7, 1fr)', height: gridHeight }}>

          {/* Eje Y — horas */}
          <div className="relative">
            {hours.map(h => (
              <div
                key={h}
                className="absolute w-full pr-2 text-right"
                style={{ top: (h - HOUR_START) * 60 * PX_PER_MIN - 8 }}
              >
                <span className="text-xs text-gray-400 font-medium">{h}:00</span>
              </div>
            ))}
          </div>

          {/* Columnas por día */}
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const appts   = byDate[dateStr] ?? []
            return (
              <div
                key={dateStr}
                className="relative border-l border-gray-50"
                style={{ height: gridHeight }}
              >
                {/* Líneas horizontales por hora */}
                {hours.map(h => (
                  <div
                    key={h}
                    className="absolute w-full border-t border-gray-50"
                    style={{ top: (h - HOUR_START) * 60 * PX_PER_MIN }}
                  />
                ))}
                {/* Línea de media hora */}
                {hours.map(h => (
                  <div
                    key={'h' + h}
                    className="absolute w-full border-t border-gray-50/60 border-dashed"
                    style={{ top: (h - HOUR_START) * 60 * PX_PER_MIN + 30 * PX_PER_MIN }}
                  />
                ))}

                {/* Appointments */}
                {appts.map(a => {
                  const startMins = toArgMins(a.starts_at)
                  const dur       = (a.service as { duration_minutes?: number } | undefined)?.duration_minutes ?? 30
                  const top       = (startMins - HOUR_START * 60) * PX_PER_MIN
                  const height    = Math.max(dur * PX_PER_MIN, 24)
                  const color     = (a.service as { color?: string } | undefined)?.color
                              ?? STATUS_COLORS[a.status]
                              ?? '#0ea5e9'
                  const isShort   = height < 40

                  if (top < 0 || top > gridHeight) return null

                  return (
                    <button
                      key={a.id}
                      onClick={() => onSelect(a)}
                      className="absolute left-0.5 right-0.5 rounded-lg text-left overflow-hidden transition-all hover:brightness-95 hover:shadow-md"
                      style={{
                        top,
                        height,
                        backgroundColor: color + '22',
                        borderLeft: '3px solid ' + color,
                      }}
                    >
                      <div className="px-1.5 py-0.5">
                        <div
                          className="text-xs font-semibold leading-tight truncate"
                          style={{ color }}
                        >
                          {a.patient_name.split(' ')[0]}
                        </div>
                        {!isShort && (
                          <div className="text-xs leading-tight truncate opacity-70" style={{ color }}>
                            {(a.service as { name?: string } | undefined)?.name}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
