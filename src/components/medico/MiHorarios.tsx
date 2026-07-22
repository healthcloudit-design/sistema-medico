import { useEffect, useState } from 'react'
import { Plus, Trash2, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Schedule } from '../../types'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']

interface Props { professionalId: string }

export function MiHorarios({ professionalId }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [newSched, setNewSched]   = useState({
    day_of_week: 1, start_time: '09:00', end_time: '17:00', interval_minutes: 30,
  })

  useEffect(() => {
    supabase
      .from('schedules')
      .select('*')
      .eq('professional_id', professionalId)
      .order('day_of_week')
      .then(({ data }) => {
        setSchedules((data ?? []) as Schedule[])
        setLoading(false)
      })
  }, [professionalId])

  const addSchedule = async () => {
    setSaving(true)
    const { data, error } = await supabase
      .from('schedules')
      .insert({
        professional_id:  professionalId,
        day_of_week:      newSched.day_of_week,
        start_time:       newSched.start_time,
        end_time:         newSched.end_time,
        interval_minutes: newSched.interval_minutes,
        active:           true,
      })
      .select()
      .single()
    if (!error && data) {
      setSchedules(prev => [...prev, data as Schedule].sort((a, b) => a.day_of_week - b.day_of_week))
    }
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

  if (loading) return <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <Clock className="w-4 h-4 text-sky-600" />
        <h3 className="font-semibold text-gray-900">Mis horarios semanales</h3>
      </div>

      {schedules.length === 0 ? (
        <div className="p-6 text-center text-gray-400 text-sm">Todavía no tenés horarios cargados</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {schedules.map(s => (
            <div key={s.id} className={`px-5 py-3 flex items-center gap-4 ${s.active ? '' : 'opacity-50'}`}>
              <div className="w-24 text-sm font-medium text-gray-700">{DIAS[s.day_of_week]}</div>
              <div className="flex-1 text-sm text-gray-500">
                {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}hs - cada {s.interval_minutes} min
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
            {[15, 20, 30, 45, 60].map(v => <option key={v} value={v}>{v} min</option>)}
          </select>
        </div>
        <button onClick={addSchedule} disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
          <Plus className="w-4 h-4" /> {saving ? 'Guardando...' : 'Agregar horario'}
        </button>
      </div>
    </div>
  )
}
