import { useEffect, useState } from 'react'
import { Plus, Trash2, CalendarX } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Professional, Schedule, AvailabilityBlock } from '../../types'
import { Button } from '../ui/Button'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']

export function AvailabilityManager() {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newSched, setNewSched] = useState({
    day_of_week: 1, start_time: '09:00', end_time: '17:00', interval_minutes: 30,
  })
  const [newBlock, setNewBlock] = useState({ blocked_date: '', reason: '' })

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

  useEffect(() => {
    if (!selectedId) return
    Promise.all([
      supabase.from('schedules').select('*').eq('professional_id', selectedId).order('day_of_week'),
      supabase.from('availability_blocks').select('*').eq('professional_id', selectedId)
        .not('blocked_date', 'is', null).order('blocked_date'),
    ]).then(([sRes, bRes]) => {
      setSchedules((sRes.data ?? []) as Schedule[])
      setBlocks((bRes.data ?? []) as AvailabilityBlock[])
    })
  }, [selectedId])

  const addSchedule = async () => {
    setSaving(true)
    const { data } = await supabase
      .from('schedules')
      .insert({
        professional_id:  selectedId,
        day_of_week:      newSched.day_of_week,
        start_time:       newSched.start_time,
        end_time:         newSched.end_time,
        interval_minutes: newSched.interval_minutes,
        active:           true,
      })
      .select()
      .single()
    if (data) setSchedules(prev => [...prev, data as Schedule].sort((a, b) => a.day_of_week - b.day_of_week))
    setSaving(false)
  }

  const deleteSchedule = async (id: string) => {
    await supabase.from('schedules').delete().eq('id', id)
    setSchedules(prev => prev.filter(s => s.id !== id))
  }

  const toggleSchedule = async (s: Schedule) => {
    await supabase.from('schedules').update({ active: !s.active }).eq('id', s.id)
    setSchedules(prev => prev.map(x => x.id === s.id ? { ...x, active: !s.active } : x))
  }

  const addBlock = async () => {
    if (!newBlock.blocked_date) return
    setSaving(true)
    const { data } = await supabase
      .from('availability_blocks')
      .insert({
        professional_id: selectedId,
        blocked_date:    newBlock.blocked_date,
        reason:          newBlock.reason || null,
      })
      .select()
      .single()
    if (data) setBlocks(prev => [...prev, data as AvailabilityBlock].sort((a, b) => (a.blocked_date ?? '').localeCompare(b.blocked_date ?? '')))
    setNewBlock({ blocked_date: '', reason: '' })
    setSaving(false)
  }

  const deleteBlock = async (id: string) => {
    await supabase.from('availability_blocks').delete().eq('id', id)
    setBlocks(prev => prev.filter(b => b.id !== id))
  }

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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Horarios semanales</h2>
        </div>
        {schedules.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No hay horarios configurados</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {schedules.map(s => (
              <div key={s.id} className={`px-5 py-3 flex items-center gap-4 ${s.active ? '' : 'opacity-50'}`}>
                <div className="w-24 text-sm font-medium text-gray-700">{DIAS[s.day_of_week]}</div>
                <div className="flex-1 text-sm text-gray-500">
                  {s.start_time.slice(0,5)} - {s.end_time.slice(0,5)}hs - cada {s.interval_minutes} min
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleSchedule(s)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium ${s.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {s.active ? 'Activo' : 'Inactivo'}
                  </button>
                  <button
                    onClick={() => deleteSchedule(s.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="p-5 border-t border-gray-50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <select
              value={newSched.day_of_week}
              onChange={e => setNewSched(p => ({ ...p, day_of_week: Number(e.target.value) }))}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <input type="time" value={newSched.start_time}
              onChange={e => setNewSched(p => ({ ...p, start_time: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            <input type="time" value={newSched.end_time}
              onChange={e => setNewSched(p => ({ ...p, end_time: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            <select
              value={newSched.interval_minutes}
              onChange={e => setNewSched(p => ({ ...p, interval_minutes: Number(e.target.value) }))}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {[15,20,30,45,60].map(v => <option key={v} value={v}>{v} min</option>)}
            </select>
          </div>
          <Button onClick={addSchedule} loading={saving} size="sm">
            <Plus className="w-4 h-4" /> Agregar horario
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <CalendarX className="w-4 h-4 text-red-400" />
          <h2 className="font-semibold text-gray-900">Dias bloqueados</h2>
        </div>
        {blocks.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No hay dias bloqueados</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {blocks.map(b => (
              <div key={b.id} className="px-5 py-3 flex items-center gap-3">
                <div className="text-sm font-medium text-gray-700 w-28">{b.blocked_date}</div>
                <div className="flex-1 text-sm text-gray-400">{b.reason ?? 'Sin motivo'}</div>
                <button
                  onClick={() => deleteBlock(b.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
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
