import { useEffect, useState } from 'react'
import { Plus, Trash2, CalendarX } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Consultorio, HorarioTemplate, DiasBloqueados } from '../../types'
import { Button } from '../ui/Button'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export function AvailabilityManager() {
  const [consultorios, setConsultorios] = useState<Consultorio[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [horarios, setHorarios] = useState<HorarioTemplate[]>([])
  const [bloqueados, setBloqueados] = useState<DiasBloqueados[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newH, setNewH] = useState({ dia_semana: 1, hora_inicio: '09:00', hora_fin: '17:00', intervalo_minutos: 30 })
  const [newBloqueo, setNewBloqueo] = useState({ fecha: '', motivo: '' })

  useEffect(() => {
    supabase.from('consultorios').select('*').eq('activo', true).order('nombre').then(({ data }) => {
      const cs = (data ?? []) as Consultorio[]
      setConsultorios(cs)
      if (cs.length > 0) setSelectedId(cs[0].id)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    Promise.all([
      supabase.from('horarios_template').select('*').eq('consultorio_id', selectedId).order('dia_semana'),
      supabase.from('dias_bloqueados').select('*').eq('consultorio_id', selectedId).order('fecha'),
    ]).then(([hRes, bRes]) => {
      setHorarios((hRes.data ?? []) as HorarioTemplate[])
      setBloqueados((bRes.data ?? []) as DiasBloqueados[])
    })
  }, [selectedId])

  const addHorario = async () => {
    setSaving(true)
    const { data } = await supabase.from('horarios_template').insert({ consultorio_id: selectedId, ...newH }).select().single()
    if (data) setHorarios(prev => [...prev, data as HorarioTemplate].sort((a, b) => a.dia_semana - b.dia_semana))
    setSaving(false)
  }

  const deleteHorario = async (id: string) => {
    await supabase.from('horarios_template').delete().eq('id', id)
    setHorarios(prev => prev.filter(h => h.id !== id))
  }

  const toggleHorario = async (h: HorarioTemplate) => {
    await supabase.from('horarios_template').update({ activo: !h.activo }).eq('id', h.id)
    setHorarios(prev => prev.map(x => x.id === h.id ? { ...x, activo: !h.activo } : x))
  }

  const addBloqueo = async () => {
    if (!newBloqueo.fecha) return
    setSaving(true)
    const { data } = await supabase.from('dias_bloqueados').insert({
      consultorio_id: selectedId, fecha: newBloqueo.fecha, motivo: newBloqueo.motivo || null
    }).select().single()
    if (data) setBloqueados(prev => [...prev, data as DiasBloqueados].sort((a, b) => a.fecha.localeCompare(b.fecha)))
    setNewBloqueo({ fecha: '', motivo: '' })
    setSaving(false)
  }

  const deleteBloqueo = async (id: string) => {
    await supabase.from('dias_bloqueados').delete().eq('id', id)
    setBloqueados(prev => prev.filter(b => b.id !== id))
  }

  if (loading) return <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Disponibilidad</h1>
        <p className="text-sm text-gray-500">Configurá horarios y días bloqueados</p>
      </div>

      {/* Selector consultorio */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <label className="text-sm font-medium text-gray-700 block mb-2">Consultorio</label>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
          {consultorios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {/* Horarios */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Horarios semanales</h2>
        </div>
        {horarios.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No hay horarios configurados</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {horarios.map(h => (
              <div key={h.id} className={`px-5 py-3 flex items-center gap-4 ${h.activo ? '' : 'opacity-50'}`}>
                <div className="w-24 text-sm font-medium text-gray-700">{DIAS[h.dia_semana]}</div>
                <div className="flex-1 text-sm text-gray-500">{h.hora_inicio.slice(0,5)} — {h.hora_fin.slice(0,5)}hs · cada {h.intervalo_minutos} min</div>
                <div className="flex gap-2">
                  <button onClick={() => toggleHorario(h)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium ${h.activo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {h.activo ? 'Activo' : 'Inactivo'}
                  </button>
                  <button onClick={() => deleteHorario(h.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="p-5 border-t border-gray-50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <select value={newH.dia_semana} onChange={e => setNewH(p => ({ ...p, dia_semana: Number(e.target.value) }))}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
              {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <input type="time" value={newH.hora_inicio} onChange={e => setNewH(p => ({ ...p, hora_inicio: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            <input type="time" value={newH.hora_fin} onChange={e => setNewH(p => ({ ...p, hora_fin: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            <select value={newH.intervalo_minutos} onChange={e => setNewH(p => ({ ...p, intervalo_minutos: Number(e.target.value) }))}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
              {[15,20,30,45,60].map(v => <option key={v} value={v}>{v} min</option>)}
            </select>
          </div>
          <Button onClick={addHorario} loading={saving} size="sm"><Plus className="w-4 h-4" /> Agregar horario</Button>
        </div>
      </div>

      {/* Días bloqueados */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <CalendarX className="w-4 h-4 text-red-400" />
          <h2 className="font-semibold text-gray-900">Días bloqueados</h2>
        </div>
        {bloqueados.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No hay días bloqueados</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {bloqueados.map(b => (
              <div key={b.id} className="px-5 py-3 flex items-center gap-3">
                <div className="text-sm font-medium text-gray-700 w-28">{b.fecha}</div>
                <div className="flex-1 text-sm text-gray-400">{b.motivo ?? 'Sin motivo'}</div>
                <button onClick={() => deleteBloqueo(b.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="p-5 border-t border-gray-50 flex gap-3">
          <input type="date" value={newBloqueo.fecha} onChange={e => setNewBloqueo(p => ({ ...p, fecha: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
          <input value={newBloqueo.motivo} placeholder="Motivo (opcional)" onChange={e => setNewBloqueo(p => ({ ...p, motivo: e.target.value }))}
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
          <Button onClick={addBloqueo} loading={saving} size="sm"><Plus className="w-4 h-4" /> Bloquear</Button>
        </div>
      </div>
    </div>
  )
}
