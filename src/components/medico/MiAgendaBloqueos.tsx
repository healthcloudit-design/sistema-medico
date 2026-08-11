import { useEffect, useState } from 'react'
import { CalendarX, Plus, Trash2 } from 'lucide-react'
import { format, parseISO, isAfter, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import type { AvailabilityBlock } from '../../types'

interface Props {
  professionalId: string
}

function toArgTime(iso: string): string {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d = new Date(ms)
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`
}

export function MiAgendaBloqueos({ professionalId }: Props) {
  const [blocks, setBlocks]         = useState<AvailabilityBlock[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [newDate, setNewDate]       = useState('')
  const [newReason, setNewReason]   = useState('')
  const [newTimeFrom, setNewTimeFrom] = useState('')
  const [newTimeTo, setNewTimeTo]     = useState('')
  const [mode, setMode]             = useState<'dia' | 'bloque'>('dia')
  const [addError, setAddError]     = useState('')

  const today = startOfDay(new Date()).toISOString().slice(0, 10)
  const rangoInvalido = mode === 'bloque' && !!newTimeFrom && !!newTimeTo && newTimeTo <= newTimeFrom

  useEffect(() => {
    supabase
      .from('availability_blocks')
      .select('*')
      .eq('professional_id', professionalId)
      .order('blocked_date')
      .then(({ data }) => {
        setBlocks((data ?? []) as AvailabilityBlock[])
        setLoading(false)
      })
  }, [professionalId])

  const blockSortDate = (b: AvailabilityBlock) => b.blocked_date ?? (b.blocked_start ? b.blocked_start.slice(0, 10) : '')
  const futureBlocks = blocks.filter(b => blockSortDate(b) >= today)
  const pastBlocks   = blocks.filter(b => blockSortDate(b) < today)

  const handleAdd = async () => {
    if (!newDate) return
    setAddError('')
    if (mode === 'bloque' && newTimeFrom && newTimeTo && newTimeTo <= newTimeFrom) {
      setAddError('El horario "Hasta" tiene que ser posterior al "Desde".')
      return
    }
    setSaving(true)
    const payload: Record<string, unknown> = {
      professional_id: professionalId,
      blocked_date:    newDate,
      reason:          newReason || null,
    }
    if (mode === 'bloque' && newTimeFrom && newTimeTo) {
      payload.blocked_date  = null
      payload.blocked_start = `${newDate}T${newTimeFrom}:00-03:00`
      payload.blocked_end   = `${newDate}T${newTimeTo}:00-03:00`
    }
    const { data, error } = await supabase
      .from('availability_blocks')
      .insert(payload)
      .select()
      .single()
    if (!error && data) {
      setBlocks(prev => [...prev, data as AvailabilityBlock].sort((a, b) =>
        blockSortDate(a).localeCompare(blockSortDate(b))))
      setNewDate(''); setNewReason(''); setNewTimeFrom(''); setNewTimeTo('')
    } else if (error) {
      setAddError('No se pudo guardar el bloqueo. Intentá de nuevo.')
      console.error(error)
    }
    setSaving(false)
  }

  const [deleteError, setDeleteError] = useState('')

  const handleDelete = async (id: string) => {
    setDeleteError('')
    const { error, count } = await supabase.from('availability_blocks').delete({ count: 'exact' }).eq('id', id)
    if (error || !count) {
      setDeleteError('No se pudo eliminar el bloqueo. Recargá la página e intentá de nuevo.')
      return
    }
    setBlocks(prev => prev.filter(b => b.id !== id))
  }

  if (loading) return (
    <div className="space-y-3">
      {[1,2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Formulario nuevo bloqueo */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CalendarX className="w-4 h-4 text-red-500" />
          Bloquear disponibilidad
        </h3>

        {/* Modo */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('dia')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${
              mode === 'dia'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            Día completo
          </button>
          <button
            onClick={() => setMode('bloque')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${
              mode === 'bloque'
                ? 'bg-orange-50 text-orange-700 border-orange-200'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            Bloque horario
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={newDate}
              min={today}
              onChange={e => setNewDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>

          {mode === 'bloque' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                <input
                  type="time"
                  value={newTimeFrom}
                  onChange={e => setNewTimeFrom(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                <input
                  type="time"
                  value={newTimeTo}
                  onChange={e => setNewTimeTo(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${rangoInvalido ? 'border-red-300 focus:ring-red-400' : 'border-gray-200 focus:ring-orange-400'}`}
                />
              </div>
            </div>
          )}

          {rangoInvalido && (
            <p className="text-xs text-red-600">El horario "Hasta" tiene que ser posterior al "Desde".</p>
          )}
          {addError && !rangoInvalido && (
            <p className="text-xs text-red-600">{addError}</p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
            <input
              type="text"
              value={newReason}
              onChange={e => setNewReason(e.target.value)}
              placeholder="Ej: Vacaciones, evento, turno médico..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>

          <button
            onClick={handleAdd}
            disabled={!newDate || saving || rangoInvalido}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {saving ? 'Guardando...' : mode === 'dia' ? 'Bloquear día' : 'Bloquear horario'}
          </button>
        </div>
      </div>

      {deleteError && (
        <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {/* Lista de bloqueos futuros */}
      {futureBlocks.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Próximos bloqueos</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {futureBlocks.map(b => {
              const dateStr = b.blocked_date ?? (b.blocked_start ? b.blocked_start.slice(0, 10) : '')
              return (
                <div key={b.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      {dateStr && format(parseISO(dateStr), "EEEE d 'de' MMMM", { locale: es })}
                      {b.blocked_start && b.blocked_end && (
                        <span className="text-gray-500 font-normal">
                          {' — '}{toArgTime(b.blocked_start)} a {toArgTime(b.blocked_end)}hs
                        </span>
                      )}
                    </div>
                    {b.reason && (
                      <div className="text-xs text-gray-400 mt-0.5">{b.reason}</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {futureBlocks.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <CalendarX className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No tenés días bloqueados próximamente</p>
        </div>
      )}
    </div>
  )
}
