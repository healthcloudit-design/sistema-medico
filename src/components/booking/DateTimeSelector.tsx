import { useState } from 'react'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { format, addDays, startOfWeek, isBefore, startOfDay, parseISO, isSameDay, subWeeks, addWeeks } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Professional } from '../../types'
import { useAvailability } from '../../hooks/useAvailability'
import { alpha } from '../../lib/color'

const GOLD = '#C9A96E'
const DK   = { card: '#141414', border: 'rgba(255,255,255,0.07)', text: '#fff', muted: 'rgba(255,255,255,0.28)' }
const DAYS  = ['Lu','Ma','Mi','Ju','Vi','Sá','Do']

interface Props {
  professional: Professional
  selectedDate?: string
  selectedTime?: string
  serviceDurationMinutes?: number
  onSelect: (fecha: string, hora: string) => void
  onBack: () => void
  accentColor?: string
  darkMode?: boolean
}

export function DateTimeSelector({
  professional, selectedDate, selectedTime,
  serviceDurationMinutes = 30, onSelect, onBack,
  accentColor = '#0ea5e9', darkMode = false,
}: Props) {
  const today        = startOfDay(new Date())
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [localDate, setLocalDate] = useState(selectedDate)
  const [localTime, setLocalTime] = useState(selectedTime)

  const { slots, loading, availableDates } = useAvailability(professional.id, localDate, serviceDurationMinutes)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const accent   = darkMode ? GOLD : accentColor

  const prevWeek = () => setWeekStart(w => subWeeks(w, 1))
  const nextWeek = () => setWeekStart(w => addWeeks(w, 1))
  const isPrevDisabled = isBefore(addDays(weekStart, 6), today) // whole week is past

  const weekLabel = (() => {
    const s = weekStart
    const e = addDays(weekStart, 6)
    if (s.getMonth() === e.getMonth())
      return `${format(s,'d')} – ${format(e,'d')} ${format(e,'MMMM', { locale:es })}`
    return `${format(s,"d MMM",{locale:es})} – ${format(e,"d MMM",{locale:es})}`
  })()

  // ── Dark mode ──────────────────────────────────────────────────────────────
  if (darkMode) return (
    <div style={{ padding:'24px 20px 28px' }}>
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:'6px', background:'none', border:`1px solid rgba(201,169,110,0.3)`, borderRadius:'8px', padding:'7px 14px', color:GOLD, fontSize:'13px', cursor:'pointer', marginBottom:'28px' }}>
        <ChevronLeft size={14}/> Volver
      </button>

      {/* Week calendar */}
      <div style={{ backgroundColor:DK.card, border:`1px solid ${DK.border}`, borderRadius:'16px', padding:'20px', marginBottom:'16px' }}>
        {/* Week nav */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'18px' }}>
          <button onClick={prevWeek} disabled={isPrevDisabled}
            style={{ background:'none', border:`1px solid ${DK.border}`, borderRadius:'8px', padding:'6px', color: isPrevDisabled ? 'rgba(255,255,255,0.1)' : DK.muted, cursor: isPrevDisabled ? 'default' : 'pointer', display:'flex', alignItems:'center' }}>
            <ChevronLeft size={16}/>
          </button>
          <span style={{ fontSize:'13px', fontWeight:500, color:DK.text, textTransform:'capitalize', letterSpacing:'0.03em' }}>
            {weekLabel}
          </span>
          <button onClick={nextWeek}
            style={{ background:'none', border:`1px solid ${DK.border}`, borderRadius:'8px', padding:'6px', color:DK.muted, cursor:'pointer', display:'flex', alignItems:'center' }}>
            <ChevronRight size={16}/>
          </button>
        </div>

        {/* Day columns */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'6px' }}>
          {weekDays.map((day, i) => {
            const dateStr     = format(day,'yyyy-MM-dd')
            const isPast      = isBefore(day, today)
            const isAvailable = availableDates.has(dateStr)
            const isSelected  = localDate === dateStr
            const isToday     = isSameDay(day, new Date())
            return (
              <button key={dateStr}
                onClick={() => { if (isAvailable && !isPast) { setLocalDate(dateStr); setLocalTime(undefined) } }}
                disabled={!isAvailable || isPast}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', padding:'10px 4px', borderRadius:'10px', border:'none', cursor: isAvailable && !isPast ? 'pointer' : 'default', transition:'all 0.15s',
                  ...(isSelected
                    ? { backgroundColor:GOLD }
                    : isAvailable && !isPast
                      ? { backgroundColor:'rgba(201,169,110,0.1)', border:'1px solid rgba(201,169,110,0.2)' }
                      : { backgroundColor:'transparent' })
                }}>
                <span style={{ fontSize:'10px', letterSpacing:'0.05em', fontWeight:500,
                  color: isSelected ? '#0B0B0B' : isToday ? GOLD : isPast ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.35)' }}>
                  {DAYS[i]}
                </span>
                <span style={{ fontSize:'14px', fontWeight: isSelected||isToday ? 700 : 400,
                  color: isSelected ? '#0B0B0B' : isAvailable && !isPast ? '#E8D4A8' : 'rgba(255,255,255,0.15)' }}>
                  {format(day,'d')}
                </span>
                {isAvailable && !isPast && !isSelected && (
                  <span style={{ width:'4px', height:'4px', borderRadius:'50%', backgroundColor:GOLD }}/>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Time slots */}
      {localDate && (
        <div style={{ backgroundColor:DK.card, border:`1px solid ${DK.border}`, borderRadius:'16px', padding:'20px', marginBottom:'16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'16px' }}>
            <Clock size={14} style={{ color:GOLD }}/>
            <span style={{ fontSize:'13px', fontWeight:500, color:'rgba(255,255,255,0.6)', letterSpacing:'0.02em' }}>
              {format(parseISO(localDate),"d 'de' MMMM",{locale:es})}
            </span>
          </div>
          {loading ? (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
              {Array.from({length:8}).map((_,i) => (
                <div key={i} style={{ height:'40px', backgroundColor:'rgba(255,255,255,0.05)', borderRadius:'8px' }}/>
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p style={{ textAlign:'center', fontSize:'13px', color:DK.muted, padding:'16px 0' }}>No hay horarios disponibles</p>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
              {slots.map(slot => (
                <button key={slot.hora} onClick={() => slot.disponible && setLocalTime(slot.hora)} disabled={!slot.disponible}
                  style={{ padding:'10px 4px', borderRadius:'8px', fontSize:'13px', fontWeight:500, border:'none', cursor: slot.disponible ? 'pointer' : 'default', transition:'all 0.15s',
                    ...(!slot.disponible
                      ? { backgroundColor:'transparent', color:'rgba(255,255,255,0.12)', textDecoration:'line-through' }
                      : localTime === slot.hora
                        ? { backgroundColor:GOLD, color:'#0B0B0B' }
                        : { backgroundColor:'rgba(201,169,110,0.07)', color:GOLD, border:'1px solid rgba(201,169,110,0.2)' }) }}>
                  {slot.hora}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {localDate && localTime && (
        <button onClick={() => onSelect(localDate, localTime)}
          style={{ width:'100%', backgroundColor:GOLD, color:'#0B0B0B', border:'none', borderRadius:'12px', padding:'16px', fontWeight:600, fontSize:'14px', letterSpacing:'0.04em', cursor:'pointer' }}>
          Confirmar — {format(parseISO(localDate),"d/MM",{locale:es})} a las {localTime}hs
        </button>
      )}
    </div>
  )

  // ── Light mode ──────────────────────────────────────────────────────────────
  return (
    <div>
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-colors mb-4"
        style={{ color:accentColor, backgroundColor:alpha(accentColor,0.08) }}>
        <ChevronLeft className="w-4 h-4"/> Volver
      </button>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Elegí fecha y hora</h2>
      <p className="text-sm text-gray-500 mb-4">Los días con disponibilidad están marcados con un punto</p>

      {/* Week strip */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevWeek} disabled={isPrevDisabled}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
            style={{ background: isPrevDisabled ? '#f9fafb' : '#f3f4f6' }}>
            <ChevronLeft className="w-4 h-4 text-gray-600"/>
          </button>
          <span className="font-semibold text-gray-900 capitalize text-sm">{weekLabel}</span>
          <button onClick={nextWeek} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ChevronRight className="w-4 h-4 text-gray-600"/>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((day, i) => {
            const dateStr     = format(day,'yyyy-MM-dd')
            const isPast      = isBefore(day, today)
            const isAvailable = availableDates.has(dateStr)
            const isSelected  = localDate === dateStr
            const isToday     = isSameDay(day, new Date())
            return (
              <button key={dateStr}
                onClick={() => { if (isAvailable && !isPast) { setLocalDate(dateStr); setLocalTime(undefined) } }}
                disabled={!isAvailable || isPast}
                className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all"
                style={isSelected
                  ? { backgroundColor:accent, color:'#fff' }
                  : isAvailable && !isPast
                    ? { backgroundColor:alpha(accent,0.08), border:`1px solid ${alpha(accent,0.2)}`, cursor:'pointer' }
                    : { cursor:'not-allowed', opacity:0.35 }}>
                <span className="text-[10px] font-medium" style={{ color: isSelected ? '#fff' : isToday ? accent : '#9ca3af' }}>
                  {DAYS[i]}
                </span>
                <span className="text-sm font-semibold" style={{ color: isSelected ? '#fff' : isAvailable&&!isPast ? '#111827' : '#d1d5db' }}>
                  {format(day,'d')}
                </span>
                {isAvailable && !isPast && !isSelected && (
                  <span className="w-1 h-1 rounded-full" style={{ backgroundColor:accent }}/>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Time slots */}
      {localDate && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color:accent }}/>
            Horarios — {format(parseISO(localDate),"d 'de' MMMM",{locale:es})}
          </h3>
          {loading ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({length:8}).map((_,i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse"/>)}
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No hay horarios disponibles</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slots.map(slot => (
                <button key={slot.hora} onClick={() => slot.disponible && setLocalTime(slot.hora)} disabled={!slot.disponible}
                  className="py-2 rounded-xl text-sm font-medium transition-all"
                  style={!slot.disponible
                    ? { backgroundColor:'#f9fafb', color:'#d1d5db', textDecoration:'line-through', cursor:'not-allowed' }
                    : localTime === slot.hora
                      ? { backgroundColor:accent, color:'#fff' }
                      : { backgroundColor:alpha(accent,0.08), color:accent }}>
                  {slot.hora}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {localDate && localTime && (
        <button onClick={() => onSelect(localDate,localTime)}
          className="w-full text-white py-3.5 rounded-2xl font-semibold transition-colors shadow-sm"
          style={{ backgroundColor:accent }}>
          Continuar — {format(parseISO(localDate),"d/MM",{locale:es})} a las {localTime}hs
        </button>
      )}
    </div>
  )
}
