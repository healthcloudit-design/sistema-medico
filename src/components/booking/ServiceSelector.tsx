import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Service } from '../../types'

interface Props {
  selected?: Service
  onSelect: (service: Service) => void
}

export function ServiceSelector({ selected, onSelect }: Props) {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('services')
      .select('*')
      .eq('active', true)
      .order('name')
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return }
        setServices((data ?? []) as Service[])
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>
  )

  if (error) return (
    <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">
      Error al cargar servicios: {error}
    </div>
  )

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">¿Qué servicio necesita?</h2>
      <p className="text-sm text-gray-500 mb-4">Seleccione el tipo de consulta</p>
      <div className="space-y-3">
        {services.map(s => (
          <button
            key={s.id}
            onClick={() => onSelect(s)}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200
              ${selected?.id === s.id
                ? 'border-sky-500 bg-sky-50'
                : 'border-gray-100 bg-white hover:border-sky-200 hover:bg-sky-50/50 shadow-sm'}`}
          >
            <div className="flex items-start gap-3">
              <span
                className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                style={{ backgroundColor: s.color ?? '#0ea5e9' }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900">{s.name}</div>
                {s.description && <div className="text-sm text-gray-500 mt-0.5">{s.description}</div>}
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3.5 h-3.5" />{s.duration_minutes} min
                  </span>
                  {s.price && (
                    <span className="text-xs text-gray-400">
                      ${s.price.toLocaleString('es-AR')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
