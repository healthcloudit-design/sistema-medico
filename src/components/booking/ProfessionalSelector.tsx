import { useEffect, useState } from 'react'
import { ChevronLeft, UserCircle, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { alpha } from '../../lib/color'
import type { Professional, Service, TenantType } from '../../types'

interface Props {
  service: Service
  selected?: Professional
  onSelect: (professional: Professional) => void
  onConfirm: () => void
  onBack: () => void
  accentColor?: string
  tenantType?: TenantType
}

export function ProfessionalSelector({ service, selected, onSelect, onConfirm, onBack, accentColor = '#0ea5e9', tenantType = 'medical' }: Props) {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const isCancha = tenantType === 'cancha'

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
      Error al cargar {isCancha ? 'canchas' : 'profesionales'}: {error}
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
        className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-colors mb-4"
        style={{ color: accentColor, backgroundColor: alpha(accentColor, 0.08) }}
      >
        <ChevronLeft className="w-4 h-4" /> Volver
      </button>

      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        {isCancha ? 'Elegí tu cancha' : 'Elegi un profesional'}
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        {isCancha
          ? `Disponible para: ${service.name}`
          : `Todos atienden: `}
        {!isCancha && <strong>{service.name}</strong>}
      </p>

      {professionals.length === 0 ? (
        <div className="bg-amber-50 text-amber-700 text-sm px-4 py-3 rounded-xl">
          No hay {isCancha ? 'canchas' : 'profesionales'} disponibles para este servicio por el momento.
        </div>
      ) : (
        <div className="space-y-3">
          {professionals.map(p => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className="w-full text-left p-4 rounded-2xl border-2 transition-all duration-200"
              style={
                selected?.id === p.id
                  ? { borderColor: accentColor, backgroundColor: alpha(accentColor, 0.06) }
                  : { borderColor: '#f3f4f6', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
              }
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={
                    selected?.id === p.id
                      ? { backgroundColor: accentColor }
                      : { backgroundColor: alpha(accentColor, 0.12) }
                  }
                >
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt={p.full_name} className="w-10 h-10 rounded-full object-cover" />
                  ) : selected?.id === p.id ? (
                    <CheckCircle className="w-5 h-5 text-white" />
                  ) : (
                    <UserCircle className="w-5 h-5" style={{ color: accentColor }} />
                  )}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{p.full_name}</div>
                  {p.specialty && !isCancha && <div className="text-sm text-gray-500 mt-0.5">{p.specialty}</div>}
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
          className="w-full mt-4 text-white py-3.5 rounded-2xl font-semibold transition-colors"
          style={{ backgroundColor: accentColor }}
        >
          {isCancha ? `Reservar ${selected.full_name}` : `Continuar con ${selected.full_name}`}
        </button>
      )}
    </div>
  )
}
