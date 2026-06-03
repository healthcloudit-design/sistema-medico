import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { TimeSlot, HorarioTemplate, DiasBloqueados, Turno } from '../types'
import { format, addMinutes, parseISO, isBefore, startOfDay } from 'date-fns'

export function useAvailability(
  consultorioId: string | undefined,
  selectedDate: string | undefined
) {
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set())

  // Cargar slots del día seleccionado
  useEffect(() => {
    if (!consultorioId || !selectedDate) { setSlots([]); return }

    const load = async () => {
      setLoading(true)
      try {
        const dateObj = parseISO(selectedDate)
        const dayOfWeek = dateObj.getDay()

        const [horarioRes, bloqueadoRes, turnosRes] = await Promise.all([
          supabase
            .from('horarios_template')
            .select('*')
            .eq('consultorio_id', consultorioId)
            .eq('dia_semana', dayOfWeek)
            .eq('activo', true),
          supabase
            .from('dias_bloqueados')
            .select('*')
            .eq('consultorio_id', consultorioId)
            .eq('fecha', selectedDate),
          supabase
            .from('turnos')
            .select('hora')
            .eq('consultorio_id', consultorioId)
            .eq('fecha', selectedDate)
            .not('estado', 'eq', 'cancelado'),
        ])

        if (horarioRes.error) throw horarioRes.error
        if (bloqueadoRes.error) throw bloqueadoRes.error
        if (turnosRes.error) throw turnosRes.error

        // Si el día está bloqueado, no hay slots
        if ((bloqueadoRes.data ?? []).length > 0) { setSlots([]); setLoading(false); return }

        const horarios = (horarioRes.data ?? []) as HorarioTemplate[]
        const turnosTomados = new Set((turnosRes.data ?? []).map((t: { hora: string }) => t.hora.slice(0, 5)))
        const now = new Date()

        const slotMap = new Map<string, TimeSlot>()

        for (const h of horarios) {
          const [startH, startM] = h.hora_inicio.split(':').map(Number)
          const [endH, endM] = h.hora_fin.split(':').map(Number)
          const startMin = startH * 60 + startM
          const endMin = endH * 60 + endM

          const intervalo = Math.max(h.intervalo_minutos, 5) // evitar loop infinito si intervalo es 0
          for (let m = startMin; m < endMin; m += intervalo) {
            const hh = Math.floor(m / 60).toString().padStart(2, '0')
            const mm = (m % 60).toString().padStart(2, '0')
            const hora = `${hh}:${mm}`

            const slotDt = new Date(dateObj)
            slotDt.setHours(Number(hh), Number(mm), 0, 0)
            const isPast = isBefore(slotDt, now)
            const isTaken = turnosTomados.has(hora)

            if (!slotMap.has(hora) || (!isPast && !isTaken)) {
              slotMap.set(hora, { hora, disponible: !isPast && !isTaken })
            }
          }
        }

        setSlots(Array.from(slotMap.values()).sort((a, b) => a.hora.localeCompare(b.hora)))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [consultorioId, selectedDate])

  // Calcular días disponibles (próximos 2 meses)
  useEffect(() => {
    if (!consultorioId) return

    const loadDates = async () => {
      const [horarioRes, bloqueadosRes] = await Promise.all([
        supabase.from('horarios_template').select('dia_semana').eq('consultorio_id', consultorioId).eq('activo', true),
        supabase.from('dias_bloqueados').select('fecha').eq('consultorio_id', consultorioId),
      ])

      if (horarioRes.error || bloqueadosRes.error) {
        console.error('Error cargando disponibilidad:', horarioRes.error ?? bloqueadosRes.error)
        return
      }

      const diasDisponibles = new Set((horarioRes.data ?? []).map((h: { dia_semana: number }) => h.dia_semana))
      const diasBloqueados = new Set((bloqueadosRes.data ?? []).map((d: { fecha: string }) => d.fecha))

      const dates = new Set<string>()
      const today = startOfDay(new Date())
      const limit = new Date(today)
      limit.setMonth(limit.getMonth() + 2)

      const cursor = new Date(today)
      while (cursor <= limit) {
        const dateStr = format(cursor, 'yyyy-MM-dd')
        if (diasDisponibles.has(cursor.getDay()) && !diasBloqueados.has(dateStr)) {
          dates.add(dateStr)
        }
        cursor.setDate(cursor.getDate() + 1)
      }

      setAvailableDates(dates)
    }

    loadDates()
  }, [consultorioId])

  return { slots, loading, availableDates }
}
