import { useEffect, useState } from 'react'
import { CalendarX, Plus, Trash2 } from 'lucide-react'
import { format, parseISO, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import type { AvailabilityBlock } from '../../types'

interface Professional { id: string; full_name: string; specialty?: string }

interface Props { organizationId: string }

export function RecepcionBloqueos({ organizationId }: Props) {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [selectedProId, setSelectedProId] = useState('')
  const [blocks, setBlocks]               = useState<AvailabilityBlock[]>([])
  const [loadingBlocks, setLoadingBlocks] = useState(false)
  const [saving, setSaving]               = useState(false)
  const [mode, setMode]                   = useState<'dia' | 'bloque'>('dia')
  const [newDate, setNewDate]             = useState('')
  const [newTimeFrom, setNewTimeFrom]     = useState('')
  const [newTimeTo, setNewTimeTo]         = useState('')
  const [newReason, setNewReason]         = useState('')

  const today = startOfDay(new Date()).toISOString().slice(0, 10)

  useEffect(() => {
    supabase
      .from('professionals')
      .select('id, full_name, specialty')
      .eq('organization_id', organizationId)
      .eq('active', true)
      .order('full_name')
      .then(({ data }) => {
        setProfessionals((data ?? []) as Professional[])
        if (data && data.length > 0) setSelectedProId(data[0].id)
      })
  }, [organizationId])

  useEffect(() => {
    if (!selectedProId) return
    setLoadingBlocks(true)
    supabase
      .from('availability_blocks')
      .select('*')
      .eq('professional_id', selectedProId)
      .order('blocked_date')
      .then(({ data }) => {
        setBlocks((data ?? []) as AvailabilityBlock[])
        setLoadingBlocks(false)
      })
  }, [selectedProId])

  const futureBlocks = blocks.filter(b => (b.blocked_date ?? '') >= today)

  const handleAdd = async () => {
    if (!newDate || !selectedProId) return
    setSaving(true)
    const payload: Record<string, unknown> = {
      professional_id: selectedProId,
      blocked_date:    newDate,
      reason:          newReason || null,
    }
    if (mode === 'bloque' && newTimeFrom && newTimeTo) {
      payload.start_time = newTimeFrom
      payload.end_time   = newTimeTo
    }
    const { data, error } = await supabase
      .from('availability_blocks')
      .insert(payload)
      .select()
      .single()
    if (!error && data) {
      setBlocks(prev => [...prev, data as AvailabilityBlock].sort((a, b) =>
        (a.blocked_date ?? '').localeCompare(b.blocked_date ?? '')))
      setNewDate(''); setNewReason(''); setNewTimeFrom(''); setNewTimeTo('')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('availability_blocks').delete().eq('id', id)
    setBlocks(prev => prev.filter(b => b.id !== id))
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Profesional</label>
        <select
          value={selectedProId}
          onChange={e => setSelectedProId(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          {professionals.map(p => (
            <option key={p.id} value={p.id}>{p.full_name}{p.specialty ? ` — ${p.specialty}` : ''}</option>
          ))}
        </select>
      </div>

      {selectedProId && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CalendarX className="w-4 h-4 text-red-500" />
            Bloquear disponibilidad
          </h3>
          <div className="flex gap-2 mb-4">
            {(['dia', 'bloque'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${
                  mode === m
                    ? m === 'dia' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}>
                {m === 'dia' ? 'Día completo' : 'Bloque horario'}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input type="date" value={newDate} min={today} onChange={e => setNewDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
            </div>
            {mode === 'bloque' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                  <input type="time" value={newTimeFrom} onChange={e => setNewTimeFrom(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                  <input type="time" value={newTimeTo} onChange={e => setNewTimeTo(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
              <input type="text" value={newReason} onChange={e => setNewReason(e.target.value)}
                placeholder="Ej: Vacaciones, capacitación, licencia..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
            </div>
            <button onClick={handleAdd} disabled={!newDate || saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
              <Plus className="w-4 h-4" />
              {saving ? 'Guardando...' : mode === 'dia' ? 'Bloquear día' : 'Bloquear horario'}
            </button>
          </div>
        </div>
      )}

      {loadingBlocks ? (
        <div className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
      ) : futureBlocks.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Próximos bloqueos</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {futureBlocks.map(b => (
              <div key={b.id} className="px-5 py-3.5 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {format(parseISO(b.blocked_date ?? ''), "EEEE d 'de' MMMM", { locale: es })}
                    {(b as any).start_time && (b as any).end_time && (
                      <span className="text-gray-500 font-normal"> — {(b as any).start_time} a {(b as any).end_time}hs</span>
                    )}
                  </div>
                  {b.reason && <div className="text-xs text-gray-400 mt-0.5">{b.reason}</div>}
                </div>
                <button onClick={() => handleDelete(b.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : selectedProId ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <CalendarX className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No hay bloqueos próximos para este profesional</p>
        </div>
      ) : null}
    </div>
  )
}
