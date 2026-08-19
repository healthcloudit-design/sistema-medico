import { useEffect, useState } from 'react'
import { CalendarPlus, Plus, Trash2 } from 'lucide-react'
import { format, parseISO, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import type { AvailabilityOpening } from '../../types'

interface Props {
  /** Profesional al que se le agregan aperturas (habilitaciones puntuales). */
  professionalId: string
}

/**
 * Permite habilitar días/horarios puntuales para un profesional (lo inverso a bloquear):
 * se elige una fecha y una franja (desde/hasta) y esos horarios quedan disponibles para reservar,
 * aunque el profesional no tenga horario semanal ese día. El intervalo entre turnos se toma
 * del horario habitual del profesional. Disponible para todos los tenants.
 */
export function AperturasManager({ professionalId }: Props) {
  const [openings, setOpenings] = useState<AvailabilityOpening[]>([])
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [newDate, setNewDate]   = useState('')
  const [newFrom, setNewFrom]   = useState('')
  const [newTo, setNewTo]       = useState('')
  const [newReason, setNewReason] = useState('')
  const [addError, setAddError] = useState('')
  const [deleteError, setDeleteError] = useState('')

  const today = startOfDay(new Date()).toISOString().slice(0, 10)
  const rangoInvalido = !!newFrom && !!newTo && newTo <= newFrom

  useEffect(() => {
    if (!professionalId) { setOpenings([]); return }
    setLoading(true)
    supabase
      .from('availability_openings')
      .select('*')
      .eq('professional_id', professionalId)
      .order('opening_date')
      .then(({ data }) => {
        setOpenings((data ?? []) as AvailabilityOpening[])
        setLoading(false)
      })
  }, [professionalId])

  const futureOpenings = openings.filter(o => o.opening_date >= today)

  const handleAdd = async () => {
    if (!newDate || !newFrom || !newTo || !professionalId) return
    setAddError('')
    if (newTo <= newFrom) { setAddError('El horario "Hasta" tiene que ser posterior al "Desde".'); return }
    setSaving(true)
    const { data, error } = await supabase
      .from('availability_openings')
      .insert({
        professional_id: professionalId,
        opening_date:    newDate,
        start_time:      newFrom,
        end_time:        newTo,
        reason:          newReason || null,
      })
      .select()
      .single()
    if (!error && data) {
      setOpenings(prev => [...prev, data as AvailabilityOpening]
        .sort((a, b) => (a.opening_date + a.start_time).localeCompare(b.opening_date + b.start_time)))
      setNewDate(''); setNewFrom(''); setNewTo(''); setNewReason('')
    } else if (error) {
      setAddError('No se pudo guardar la apertura. Intentá de nuevo.')
      console.error(error)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    setDeleteError('')
    const { error, count } = await supabase.from('availability_openings').delete({ count: 'exact' }).eq('id', id)
    if (error || !count) {
      setDeleteError('No se pudo eliminar la apertura. Recargá la página e intentá de nuevo.')
      return
    }
    setOpenings(prev => prev.filter(o => o.id !== id))
  }

  const hm = (t: string) => t.slice(0, 5)

  if (!professionalId) return null

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <CalendarPlus className="w-4 h-4 text-emerald-600" />
          Habilitar día / horario
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          Agrega disponibilidad puntual en una fecha, aunque el profesional no atienda ese día habitualmente.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input type="date" value={newDate} min={today} onChange={e => setNewDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
              <input type="time" value={newFrom} onChange={e => setNewFrom(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
              <input type="time" value={newTo} onChange={e => setNewTo(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${rangoInvalido ? 'border-red-300 focus:ring-red-400' : 'border-gray-200 focus:ring-emerald-400'}`} />
            </div>
          </div>
          {rangoInvalido && <p className="text-xs text-red-600">El horario "Hasta" tiene que ser posterior al "Desde".</p>}
          {addError && !rangoInvalido && <p className="text-xs text-red-600">{addError}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
            <input type="text" value={newReason} onChange={e => setNewReason(e.target.value)}
              placeholder="Ej: turno extra, sobreturno, agenda especial..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <button onClick={handleAdd} disabled={!newDate || !newFrom || !newTo || saving || rangoInvalido}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
            <Plus className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Habilitar horario'}
          </button>
        </div>
      </div>

      {deleteError && (
        <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{deleteError}</div>
      )}

      {loading ? (
        <div className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
      ) : futureOpenings.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Próximas habilitaciones</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {futureOpenings.map(o => (
              <div key={o.id} className="px-5 py-3.5 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {format(parseISO(o.opening_date), "EEEE d 'de' MMMM", { locale: es })}
                    <span className="text-gray-500 font-normal"> — {hm(o.start_time)} a {hm(o.end_time)}hs</span>
                  </div>
                  {o.reason && <div className="text-xs text-gray-400 mt-0.5">{o.reason}</div>}
                </div>
                <button onClick={() => handleDelete(o.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <CalendarPlus className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No hay días/horarios habilitados a futuro para este profesional</p>
        </div>
      )}
    </div>
  )
}
