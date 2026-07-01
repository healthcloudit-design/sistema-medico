import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { TimeSlot, Schedule, AvailabilityBlock } from '../types'
import { format, startOfDay, isBefore } from 'date-fns'

// Argentina siempre UTC-3 (sin DST)
const ARG_OFFSET_MS = -3 * 60 * 60 * 1000

function toArgTime(iso: string): string {
  const ms = new Date(iso).getTime() + ARG_OFFSET_MS
  const d = new Date(ms)
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`
}

export function useAvailability(
  professionalId: string | undefined,
  selectedDate: string | undefined,
  serviceDurationMinutes: number = 30,
) {
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!professionalId || !selectedDate) {
      setSlots([])
      return
    }

    const load = async () => {
      setLoading(true)
      try {
        const dayOfWeek = new Date(selectedDate + 'T12:00:00').getDay()
        const dayStart = `${selectedDate}T00:00:00-03:00`
        const dayEnd   = `${selectedDate}T23:59:59-03:00`

        const [scheduleRes, blockRes, apptRes] = await Promise.all([
          supabase
            .from('schedules')
            .select('*')
            .eq('professional_id', professionalId)
            .eq('day_of_week', dayOfWeek)
            .eq('active', true),
          supabase
            .from('availability_blocks')
            .select('*')
            .eq('professional_id', professionalId)
            .or(`blocked_date.eq.${selectedDate},and(blocked_start.lte.${dayEnd},blocked_end.gte.${dayStart})`),
          supabase
            .from('appointments')
            .select('starts_at, ends_at')
            .eq('professional_id', professionalId)
            .gte('starts_at', dayStart)
            .lte('starts_at', dayEnd)
            .neq('status', 'cancelado'),
        ])

        if (scheduleRes.error) throw scheduleRes.error
        if (apptRes.error) throw apptRes.error

        const blocks = (blockRes.data ?? []) as AvailabilityBlock[]

        if (blocks.some(b => b.blocked_date === selectedDate)) {
          setSlots([])
          setLoading(false)
          return
        }

        const schedules = (scheduleRes.data ?? []) as Schedule[]
        // Cada turno existente ocupa [starts_at, ends_at) — marcamos todos los slots dentro de ese rango
        const bookedRanges = (apptRes.data ?? []).map((a: { starts_at: string; ends_at: string | null }) => ({
          startMin: (() => { const t = toArgTime(a.starts_at); const [h,m] = t.split(':').map(Number); return h*60+m })(),
          endMin:   a.ends_at
            ? (() => { const t = toArgTime(a.ends_at!); const [h,m] = t.split(':').map(Number); return h*60+m })()
            : (() => { const t = toArgTime(a.starts_at); const [h,m] = t.split(':').map(Number); return h*60+m+30 })(),
        }))

        // Un slot (hora) está tomado si cae dentro de algún rango existente
        // O si los próximos N slots necesarios para el servicio nuevo no están todos libres
        const isSlotConflict = (slotMin: number) => {
          // ¿El slot cae dentro de un turno existente?
          if (bookedRanges.some(r => slotMin >= r.startMin && slotMin < r.endMin)) return true
          // ¿El nuevo turno (slotMin + duration) se superpondría con algún turno existente?
          const newEnd = slotMin + serviceDurationMinutes
          if (bookedRanges.some(r => slotMin < r.endMin && newEnd > r.startMin)) return true
          return false
        }

        const blockedRanges = blocks
          .filter(b => b.blocked_start && b.blocked_end)
          .map(b => ({
            start: toArgTime(b.blocked_start as string),
            end:   toArgTime(b.blocked_end as string),
          }))

        const isBlockedByRange = (hora: string) =>
          blockedRanges.some(r => hora >= r.start && hora < r.end)

        const now = new Date()
        const slotMap = new Map<string, TimeSlot>()

        for (const sch of schedules) {
          const [startH, startM] = sch.start_time.split(':').map(Number)
          const [endH, endM]     = sch.end_time.split(':').map(Number)
          const startMin = startH * 60 + startM
          const endMin   = endH   * 60 + endM
          const interval = Math.max(sch.interval_minutes ?? 30, 5)

          for (let m = startMin; m < endMin; m += interval) {
            const hh   = Math.floor(m / 60).toString().padStart(2, '0')
            const mm   = (m % 60).toString().padStart(2, '0')
            const hora = `${hh}:${mm}`

            const slotDt    = new Date(`${selectedDate}T${hora}:00-03:00`)
            const isPast    = isBefore(slotDt, now)
            const slotMin   = Math.floor(m)
            const isTaken   = isSlotConflict(slotMin)
            const isBlocked = isBlockedByRange(hora)

            if (!slotMap.has(hora)) {
              slotMap.set(hora, { hora, disponible: !isPast && !isTaken && !isBlocked })
            }
          }
        }

        setSlots(Array.from(slotMap.values()).sort((a, b) => a.hora.localeCompare(b.hora)))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [professionalId, selectedDate])

  useEffect(() => {
    if (!professionalId) {
      setAvailableDates(new Set())
      return
    }

    const loadDates = async () => {
      const [schedRes, blockRes] = await Promise.all([
        supabase
          .from('schedules')
          .select('day_of_week')
          .eq('professional_id', professionalId)
          .eq('active', true),
        supabase
          .from('availability_blocks')
          .select('blocked_date')
          .eq('professional_id', professionalId)
          .not('blocked_date', 'is', null),
      ])

      if (schedRes.error || blockRes.error) return

      const availDays = new Set(
        (schedRes.data ?? []).map((s: { day_of_week: number }) => s.day_of_week),
      )
      const blockedDates = new Set(
        (blockRes.data ?? []).map((b: { blocked_date: string }) => b.blocked_date),
      )

      const dates = new Set<string>()
      const today = startOfDay(new Date())
      const limit = new Date(today)
      limit.setMonth(limit.getMonth() + 2)

      const cursor = new Date(today)
      while (cursor <= limit) {
        const dateStr = format(cursor, 'yyyy-MM-dd')
        if (availDays.has(cursor.getDay()) && !blockedDates.has(dateStr)) {
          dates.add(dateStr)
        }
        cursor.setDate(cursor.getDate() + 1)
      }

      setAvailableDates(dates)
    }

    loadDates()
  }, [professionalId])

  return { slots, loading, availableDates }
}
