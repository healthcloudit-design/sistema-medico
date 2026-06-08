import { useEffect, useState } from 'react'
import { ChevronLeft, UserCircle, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Professional, Service } from '../../types'

interface Props {
  service: Service
  selected?: Professional
  onSelect: (professional: Professional) => void
  onConfirm: () => void
  onBack: () => void
}

export function ProfessionalSelector({ service, selected, onSelect, onConfirm, onBack }: Props) {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('professional_services')
      .select('professional_id, professionals(*)')
      .eq('service_id', service.id)
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return }
        const ps = (data ?? [])
          .map((row: Record<string, unknown>) => row.professionals as Professional)
          .filter(p => p && p.active)
        setProfessionals(ps)
        setLoading(false)
      })
  }, [service.id])

  if (error) return (
    <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">
      Error al cargar profesionales: {error}
    </div>
  )

  if (loading) return (
    <div className="space-y-3">
      {[1, 2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
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

      <h2 className="text-lg font-semibold text-gray-900 mb-1">Elegi un profesional</h2>
      <p className="text-sm text-gray-500 mb-4">Todos atienden: <strong>{service.name}</strong></p>

      {professionals.length === 0 ? (
        <div className="bg-amber-50 text-amber-700 text-sm px-4 py-3 rounded-xl">
          No hay profesionales disponibles para este servicio por el momento.
        </div>
      ) : (
        <div className="space-y-3">
          {professionals.map(p => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200
                ${selected?.id === p.id
                  ? 'border-sky-500 bg-sky-50'
                  : 'border-gray-100 bg-white hover:border-sky-200 hover:bg-sky-50/50 shadow-sm'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                  ${selected?.id === p.id ? 'bg-sky-600' : 'bg-sky-100'}`}>
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt={p.full_name} className="w-10 h-10 rounded-full object-cover" />
                  ) : selected?.id === p.id ? (
                    <CheckCircle className="w-5 h-5 text-white" />
                  ) : (
                    <UserCircle className="w-5 h-5 text-sky-600" />
                  )}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{p.full_name}</div>
                  {p.specialty && <div className="text-sm text-gray-500 mt-0.5">{p.specialty}</div>}
                  {p.bio && <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{p.bio}</div>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <button
          onClick={onConfirm}
          className="w-full mt-4 bg-sky-600 text-white py-3.5 rounded-2xl font-semibold hover:bg-sky-700 transition-colors"
        >
          Continuar con {selected.full_name}
        </button>
      )}
    </div>
  )
}
