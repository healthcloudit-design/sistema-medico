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
  excludeAppointmentId?: string,
  serviceId?: string,
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

        const [scheduleRes, blockRes, apptRes, serviceRes, professionalRes, openingsRes, allSchedRes] = await Promise.all([
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
          (() => {
            let q = supabase
              .from('appointments')
              .select('id, starts_at, ends_at, service_id, status, services(requiere_atencion_completa, resource_group)')
              .eq('professional_id', professionalId)
              .gte('starts_at', dayStart)
              .lte('starts_at', dayEnd)
              .neq('status', 'cancelado')
            if (excludeAppointmentId) q = q.neq('id', excludeAppointmentId)
            return q
          })(),
          serviceId
            ? supabase.from('services').select('capacity, waitlist_limit, requiere_atencion_completa, last_start_overrides, resource_group, block_duration_minutes').eq('id', serviceId).single()
            : Promise.resolve({ data: null, error: null }),
          supabase.from('professionals').select('concurrent_capacity').eq('id', professionalId).single(),
          // Aperturas puntuales (habilitar dias/horarios) para ESTA fecha
          supabase.from('availability_openings').select('start_time, end_time').eq('professional_id', professionalId).eq('opening_date', selectedDate),
          // Todos los intervalos del profesional, para derivar el intervalo de las aperturas
          supabase.from('schedules').select('interval_minutes').eq('professional_id', professionalId).eq('active', true),
        ])

        if (scheduleRes.error) throw scheduleRes.error
        if (apptRes.error) throw apptRes.error

        const blocks = (blockRes.data ?? []) as AvailabilityBlock[]

        if (blocks.some(b => b.blocked_date === selectedDate)) {
          setSlots([])
          setLoading(false)
          return
        }

        const capacity      = (serviceRes?.data as { capacity?: number } | null)?.capacity ?? 1
        const waitlistLimit = (serviceRes?.data as { waitlist_limit?: number } | null)?.waitlist_limit ?? 0
        const isGroupService = !!serviceId && capacity > 1
        const candidateRequiereAtencion = (serviceRes?.data as { requiere_atencion_completa?: boolean } | null)?.requiere_atencion_completa ?? true

        // ── Modelo de RECURSOS (grupos) — solo aplica a servicios con resource_group
        //    configurado (ej: Acqua). Para el resto, candGroup = null y todo el
        //    comportamiento clásico de abajo queda EXACTAMENTE igual (tenant-safe).
        const candGroup = (serviceRes?.data as { resource_group?: string | null } | null)?.resource_group ?? null
        const isGrouped = !!candGroup
        // block_duration_minutes del servicio manda si está definido; si no, el valor recibido.
        const effDuration = (serviceRes?.data as { block_duration_minutes?: number | null } | null)?.block_duration_minutes ?? serviceDurationMinutes

        // Override opcional del último horario de inicio para ESTE servicio en ESTE día de semana
        const lastStartOverrides = (serviceRes?.data as { last_start_overrides?: Record<string, string> | null } | null)?.last_start_overrides
        const lastStartOverride  = lastStartOverrides?.[String(dayOfWeek)]
        const lastStartOverrideMin = lastStartOverride
          ? (() => { const [h, m] = lastStartOverride.split(':').map(Number); return h * 60 + m })()
          : null

        // Cupo del profesional (clásico): cuántos clientes en simultáneo. default 1.
        const professionalCapacity = (professionalRes?.data as { concurrent_capacity?: number } | null)?.concurrent_capacity ?? 1
        const isMultiCapacityProfessional = professionalCapacity > 1

        const allAppts = (apptRes.data ?? []) as { id: string; starts_at: string; ends_at: string | null; service_id: string; status: string; services: { requiere_atencion_completa?: boolean; resource_group?: string | null } | null }[]

        const toMin = (iso: string) => { const t = toArgTime(iso); const [h,m] = t.split(':').map(Number); return h*60+m }

        // ── Rangos ocupados del MISMO grupo de recurso (para el modelo nuevo) ──
        // Choca solo con turnos del mismo grupo; grupos distintos no bloquean.
        const sameGroupActiveRanges = isGrouped
          ? allAppts
              .filter(a => ((a.services?.resource_group ?? null) === candGroup) && a.status !== 'lista_espera')
              .map(a => ({ startMin: toMin(a.starts_at), endMin: a.ends_at ? toMin(a.ends_at) : toMin(a.starts_at) + effDuration }))
          : []

        // Para servicios con cupo clásico (capacity>1 sin grupo): los del mismo servicio no bloquean entre sí.
        const otherServiceAppts = isGroupService ? allAppts.filter(a => a.service_id !== serviceId) : allAppts
        const sameServiceAppts  = isGroupService ? allAppts.filter(a => a.service_id === serviceId) : []

        // Cada turno existente ocupa [starts_at, ends_at)
        const bookedRanges = otherServiceAppts.map(a => ({
          startMin: toMin(a.starts_at),
          endMin:   a.ends_at ? toMin(a.ends_at) : toMin(a.starts_at) + 30,
        }))

        const isSlotConflict = (slotMin: number) => {
          if (bookedRanges.some(r => slotMin >= r.startMin && slotMin < r.endMin)) return true
          const newEnd = slotMin + effDuration
          if (bookedRanges.some(r => slotMin < r.endMin && newEnd > r.startMin)) return true
          return false
        }

        const sameServiceActiveRanges = sameServiceAppts
          .filter(a => a.status !== 'lista_espera')
          .map(a => ({ startMin: toMin(a.starts_at), endMin: a.ends_at ? toMin(a.ends_at) : toMin(a.starts_at) + effDuration }))
        const sameServiceWaitlistRanges = sameServiceAppts
          .filter(a => a.status === 'lista_espera')
          .map(a => ({ startMin: toMin(a.starts_at), endMin: a.ends_at ? toMin(a.ends_at) : toMin(a.starts_at) + effDuration }))

        const activeAt = (ranges: { startMin: number; endMin: number }[], t: number) =>
          ranges.filter(r => r.startMin <= t && r.endMin > t).length

        const wouldExceedCapacity = (ranges: { startMin: number; endMin: number }[], slotMin: number, cap: number) => {
          const newEnd = slotMin + effDuration
          const overlapping = ranges.filter(r => r.startMin < newEnd && r.endMin > slotMin)
          if (overlapping.length + 1 <= cap) return false
          const points = [slotMin, ...overlapping.map(r => Math.max(r.startMin, slotMin))]
          return points.some(t => activeAt(overlapping, t) + 1 > cap)
        }

        // ── Cupo general del profesional (clásico, solo si concurrent_capacity > 1) ──
        const allActiveRanges = isMultiCapacityProfessional
          ? allAppts
              .filter(a => a.status !== 'lista_espera')
              .map(a => ({
                startMin: toMin(a.starts_at),
                endMin: a.ends_at ? toMin(a.ends_at) : toMin(a.starts_at) + 30,
                requiereAtencionCompleta: a.services?.requiere_atencion_completa ?? true,
              }))
          : []
        const attentionRanges = allActiveRanges.filter(r => r.requiereAtencionCompleta)

        const blockedRanges = blocks
          .filter(b => b.blocked_start && b.blocked_end)
          .map(b => ({
            start: toArgTime(b.blocked_start as string),
            end:   toArgTime(b.blocked_end as string),
          }))

        const isBlockedByRange = (hora: string) =>
          blockedRanges.some(r => hora >= r.start && hora < r.end)

        // Calcula si un slot está tomado, según el modelo que corresponda.
        const slotIsTaken = (slotMin: number) =>
          isGrouped
            ? wouldExceedCapacity(sameGroupActiveRanges, slotMin, capacity)
            : isMultiCapacityProfessional
              ? wouldExceedCapacity(allActiveRanges, slotMin, professionalCapacity)
                || (candidateRequiereAtencion && wouldExceedCapacity(attentionRanges, slotMin, 1))
              : isSlotConflict(slotMin)

        // Arma el TimeSlot para una hora dada (unifica grilla semanal y aperturas).
        const buildSlot = (hora: string, slotMin: number, isPast: boolean, isBlocked: boolean): TimeSlot => {
          const isTaken = slotIsTaken(slotMin)
          if (isGrouped) {
            const activos = activeAt(sameGroupActiveRanges, slotMin)
            return {
              hora,
              disponible: !isPast && !isBlocked && !isTaken,
              cuposRestantes: capacity > 1 ? (!isPast && !isBlocked && !isTaken ? Math.max(capacity - activos, 0) : undefined) : undefined,
            }
          }
          if (isGroupService) {
            const activosAhora   = activeAt(sameServiceActiveRanges, slotMin)
            const excedeCupo     = wouldExceedCapacity(sameServiceActiveRanges, slotMin, capacity)
            const enEspera       = activeAt(sameServiceWaitlistRanges, slotMin)
            const hayCupo        = !excedeCupo && !isTaken
            const hayListaEspera = !hayCupo && enEspera < waitlistLimit
            return {
              hora,
              disponible:      !isPast && !isBlocked && !isTaken && hayCupo,
              cuposRestantes:  !isPast && !isBlocked && !isTaken ? Math.max(capacity - activosAhora, 0) : undefined,
              enListaDeEspera: !isPast && !isBlocked && !isTaken && hayListaEspera,
            }
          }
          return { hora, disponible: !isPast && !isTaken && !isBlocked }
        }

        const schedules = (scheduleRes.data ?? []) as Schedule[]
        const now = new Date()
        const slotMap = new Map<string, TimeSlot>()

        for (const sch of schedules) {
          const [startH, startM] = sch.start_time.split(':').map(Number)
          const [endH, endM]     = sch.end_time.split(':').map(Number)
          const startMin = startH * 60 + startM
          const interval = Math.max(sch.interval_minutes ?? 30, 5)
          const endMin = lastStartOverrideMin != null
            ? Math.min(endH * 60 + endM, lastStartOverrideMin + interval)
            : endH * 60 + endM

          for (let m = startMin; m < endMin; m += interval) {
            const hh   = Math.floor(m / 60).toString().padStart(2, '0')
            const mm   = (m % 60).toString().padStart(2, '0')
            const hora = `${hh}:${mm}`
            const slotDt    = new Date(`${selectedDate}T${hora}:00-03:00`)
            const isPast    = isBefore(slotDt, now)
            const slotMin   = Math.floor(m)
            const isBlocked = isBlockedByRange(hora)
            if (!slotMap.has(hora)) {
              slotMap.set(hora, buildSlot(hora, slotMin, isPast, isBlocked))
            }
          }
        }

        // ── Aperturas puntuales ────────────────────────────────────────────────
        const openings = (openingsRes?.data ?? []) as { start_time: string; end_time: string }[]
        if (openings.length > 0) {
          const intervals = ((allSchedRes?.data ?? []) as { interval_minutes: number }[])
            .map(s => s.interval_minutes).filter(n => typeof n === 'number' && n > 0)
          const openingInterval = Math.max(intervals.length ? Math.min(...intervals) : (effDuration || 30), 5)
          const parseHM = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
          for (const op of openings) {
            const opStart = parseHM(op.start_time)
            const opEnd   = parseHM(op.end_time)
            for (let m = opStart; m < opEnd; m += openingInterval) {
              const hh = Math.floor(m / 60).toString().padStart(2, '0')
              const mm = (m % 60).toString().padStart(2, '0')
              const hora = `${hh}:${mm}`
              if (slotMap.has(hora)) continue
              const slotDt  = new Date(`${selectedDate}T${hora}:00-03:00`)
              const isPast  = isBefore(slotDt, now)
              const isBlocked = isBlockedByRange(hora)
              slotMap.set(hora, buildSlot(hora, m, isPast, isBlocked))
            }
          }
        }

        setSlots(Array.from(slotMap.values()).sort((a, b) => a.hora.localeCompare(b.hora)))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [professionalId, selectedDate, excludeAppointmentId, serviceId])

  useEffect(() => {
    if (!professionalId) {
      setAvailableDates(new Set())
      return
    }

    const loadDates = async () => {
      const [schedRes, blockRes, openRes] = await Promise.all([
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
        supabase
          .from('availability_openings')
          .select('opening_date')
          .eq('professional_id', professionalId),
      ])

      if (schedRes.error || blockRes.error) return

      const availDays = new Set(
        (schedRes.data ?? []).map((s: { day_of_week: number }) => s.day_of_week),
      )
      const blockedDates = new Set(
        (blockRes.data ?? []).map((b: { blocked_date: string }) => b.blocked_date),
      )
      const openingDates = new Set(
        (openRes?.data ?? []).map((o: { opening_date: string }) => o.opening_date),
      )

      const dates = new Set<string>()
      const today = startOfDay(new Date())
      const limit = new Date(today)
      limit.setMonth(limit.getMonth() + 2)

      const cursor = new Date(today)
      while (cursor <= limit) {
        const dateStr = format(cursor, 'yyyy-MM-dd')
        if ((availDays.has(cursor.getDay()) || openingDates.has(dateStr)) && !blockedDates.has(dateStr)) {
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
