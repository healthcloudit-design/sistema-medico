// ServiceSelector — sin botón volver (primer paso)
import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Servicio } from '../../types'

interface Props {
  selected?: Servicio
  onSelect: (servicio: Servicio) => void
}

export function ServiceSelector({ selected, onSelect }: Props) {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('servicios')
      .select('*')
      .eq('activo', true)
      .order('nombre')
      .then(({ data, error: err }) => {
        if (err) {
          console.error('Error cargando servicios:', err)
          setError(err.message)
          setLoading(false)
          return
        }
        // Deduplicar por nombre (mismo servicio en varios consultorios)
        const seen = new Map<string, Servicio>()
        for (const s of (data ?? []) as Servicio[]) {
          if (!seen.has(s.nombre)) seen.set(s.nombre, s)
        }
        setServicios(Array.from(seen.values()))
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
        {servicios.map(s => (
          <button
            key={s.id}
            onClick={() => onSelect(s)}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200
              ${selected?.nombre === s.nombre
                ? 'border-sky-500 bg-sky-50'
                : 'border-gray-100 bg-white hover:border-sky-200 hover:bg-sky-50/50 shadow-sm'}`}
          >
            <div className="flex items-start gap-3">
              {s.icono && <span className="text-2xl mt-0.5 flex-shrink-0">{s.icono}</span>}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900">{s.nombre}</div>
                {s.descripcion && <div className="text-sm text-gray-500 mt-0.5">{s.descripcion}</div>}
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3.5 h-3.5" />{s.duracion_minutos} min
                  </span>
                  {s.precio && (
                    <span className="text-xs text-gray-400">
                      ${s.precio.toLocaleString('es-AR')}
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
