import { useEffect, useState } from 'react'
import { ChevronLeft, Building2, MapPin, Phone, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Consultorio, Servicio } from '../../types'

interface Props {
  servicio: Servicio
  selected?: Consultorio
  onSelect: (consultorio: Consultorio) => void
  onConfirm: () => void
  onBack: () => void
}

export function ConsultorioSelector({ servicio, selected, onSelect, onConfirm, onBack }: Props) {
  const [consultorios, setConsultorios] = useState<Consultorio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('servicios')
      .select('consultorio_id, consultorios(*)')
      .eq('nombre', servicio.nombre)
      .eq('activo', true)
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return }
        const cs = (data ?? [])
          .map((row: Record<string, unknown>) => row.consultorios as Consultorio)
          .filter(c => c && c.activo)
        setConsultorios(cs)
        setLoading(false)
      })
  }, [servicio.nombre])

  if (error) return (
    <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">Error al cargar consultorios: {error}</div>
  )

  if (loading) return (
    <div className="space-y-3">
      {[1,2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>
  )

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-sky-600 bg-sky-50 hover:bg-sky-100 px-3 py-2 rounded-xl transition-colors mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Volver
      </button>

      <h2 className="text-lg font-semibold text-gray-900 mb-1">Seleccione el consultorio</h2>
      <p className="text-sm text-gray-500 mb-4">Elegí dónde querés atenderte</p>

      <div className="space-y-3">
        {consultorios.map(c => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200
              ${selected?.id === c.id
                ? 'border-sky-500 bg-sky-50'
                : 'border-gray-100 bg-white hover:border-sky-200 hover:bg-sky-50/50 shadow-sm'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                ${selected?.id === c.id ? 'bg-sky-600' : 'bg-sky-100'}`}>
                {selected?.id === c.id
                  ? <CheckCircle className="w-5 h-5 text-white" />
                  : <Building2 className="w-5 h-5 text-sky-600" />}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{c.nombre}</div>
                {c.direccion && (
                  <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                    <MapPin className="w-3 h-3" />{c.direccion}
                  </div>
                )}
                {c.telefono && (
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <Phone className="w-3 h-3" />{c.telefono}
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <button
          onClick={onConfirm}
          className="w-full mt-4 bg-sky-600 text-white py-3.5 rounded-2xl font-semibold hover:bg-sky-700 transition-colors"
        >
          Continuar con {selected.nombre}
        </button>
      )}
    </div>
  )
}
