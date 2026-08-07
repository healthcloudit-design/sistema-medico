import { useEffect, useState } from 'react'
import { Plus, Trash2, CalendarX } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import type { Professional, AvailabilityBlock } from '../../types'
import { Button } from '../ui/Button'
import { WeeklyScheduleEditor } from './WeeklyScheduleEditor'

function toArgTime(iso: string): string {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d = new Date(ms)
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`
}

export function AvailabilityManager() {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newBlock, setNewBlock] = useState({ blocked_date: '', reason: '' })
  const [blockError, setBlockError] = useState('')

  useEffect(() => {
    supabase
      .from('professionals')
      .select('*')
      .eq('active', true)
      .order('full_name')
      .then(({ data }) => {
        const ps = (data ?? []) as Professional[]
        setProfessionals(ps)
        if (ps.length > 0) setSelectedId(ps[0].id)
        setLoading(false)
      })
  }, [])

  const blockSortDate = (b: AvailabilityBlock) => b.blocked_date ?? (b.blocked_start ? b.blocked_start.slice(0, 10) : '')

  const loadBlocks = async () => {
    if (!selectedId) return
    const { data } = await supabase.from('availability_blocks').select('*').eq('professional_id', selectedId)
    setBlocks(((data ?? []) as AvailabilityBlock[]).sort((a, b) => blockSortDate(a).localeCompare(blockSortDate(b))))
  }

  useEffect(() => {
    setBlockError('')
    loadBlocks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const addBlock = async () => {
    if (!newBlock.blocked_date) return
    if (!selectedId) { setBlockError('Elegi un profesional antes de bloquear una fecha.'); return }
    setSaving(true); setBlockError('')
    const { data, error } = await supabase
      .from('availability_blocks')
      .insert({
        professional_id: selectedId,
        blocked_date:    newBlock.blocked_date,
        reason:          newBlock.reason || null,
      })
      .select()
      .single()
    if (error) setBlockError('No se pudo bloquear la fecha: ' + error.message)
    if (data) setBlocks(prev => [...prev, data as AvailabilityBlock].sort((a, b) => blockSortDate(a).localeCompare(blockSortDate(b))))
    setNewBlock({ blocked_date: '', reason: '' })
    setSaving(false)
  }

  const deleteBlock = async (id: string) => {
    setBlockError('')
    const { error, count } = await supabase.from('availability_blocks').delete({ count: 'exact' }).eq('id', id)
    if (error) { setBlockError('No se pudo eliminar el bloqueo: ' + error.message); return }
    if (!count) { setBlockError('No se pudo eliminar el bloqueo (sin permisos o ya no existe). Recargá la página e intentá de nuevo.'); await loadBlocks(); return }
    setBlocks(prev => prev.filter(b => b.id !== id))
  }

  const selectedProfessional = professionals.find(p => p.id === selectedId)

  if (loading) return <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Disponibilidad</h1>
        <p className="text-sm text-gray-500">Configurá horarios y dias bloqueados por profesional</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <label className="text-sm font-medium text-gray-700 block mb-2">Profesional</label>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          {professionals.map(p => (
            <option key={p.id} value={p.id}>{p.full_name}{p.specialty ? ` (${p.specialty})` : ''}</option>
          ))}
        </select>
      </div>

      {selectedProfessional && (
        <div className="flex items-center gap-2 mb-5 px-4 py-2.5 rounded-xl bg-sky-50 border border-sky-100">
          <span className="text-sm text-sky-700">
            Estas editando el horario de <span className="font-semibold">{selectedProfessional.full_name}</span>
            {selectedProfessional.specialty ? ` (${selectedProfessional.specialty})` : ''}
          </span>
        </div>
      )}

      {selectedId && (
        <div className="mb-5">
          <WeeklyScheduleEditor professionalId={selectedId} />
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <CalendarX className="w-4 h-4 text-red-400" />
          <h2 className="font-semibold text-gray-900">Dias bloqueados</h2>
        </div>

        {blockError && (
          <div className="mx-5 mt-4 px-4 py-2.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
            {blockError}
          </div>
        )}

        {blocks.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No hay dias bloqueados</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {blocks.map(b => {
              const dateStr = blockSortDate(b)
              return (
                <div key={b.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="text-sm font-medium text-gray-700 w-40">
                    {dateStr ? format(parseISO(dateStr), "d 'de' MMMM", { locale: es }) : '—'}
                    {b.blocked_start && b.blocked_end && (
                      <span className="text-gray-400 font-normal"> {toArgTime(b.blocked_start)}–{toArgTime(b.blocked_end)}</span>
                    )}
                  </div>
                  <div className="flex-1 text-sm text-gray-400">{b.reason ?? 'Sin motivo'}</div>
                  <button
                    onClick={() => deleteBlock(b.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
        <div className="p-5 border-t border-gray-50 flex gap-3">
          <input
            type="date"
            value={newBlock.blocked_date}
            onChange={e => setNewBlock(p => ({ ...p, blocked_date: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <input
            value={newBlock.reason}
            placeholder="Motivo (opcional)"
            onChange={e => setNewBlock(p => ({ ...p, reason: e.target.value }))}
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <Button onClick={addBlock} loading={saving} size="sm">
            <Plus className="w-4 h-4" /> Bloquear
          </Button>
        </div>
      </div>
    </div>
  )
}
