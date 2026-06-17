import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Service } from '../../types'

interface Props {
  selected?: Service
  onSelect: (service: Service) => void
  orgId: string
  tenantType?: 'medical' | 'beauty' | 'general'
}

const CATEGORY_META: Record<string, { emoji: string; gradient: string; border: string; text: string }> = {
  'Peluqueria': { emoji: '✂️', gradient: 'from-pink-50 to-fuchsia-50', border: 'border-pink-200',  text: 'text-pink-700'  },
  'Manos':      { emoji: '💅', gradient: 'from-rose-50 to-pink-50',    border: 'border-rose-200',  text: 'text-rose-700'  },
  'Barberia':   { emoji: '🪒', gradient: 'from-slate-50 to-zinc-50',   border: 'border-slate-300', text: 'text-slate-700' },
}

const CATEGORY_META_ES: Record<string, { emoji: string; gradient: string; border: string; text: string }> = {
  'Peluquería': { emoji: '✂️', gradient: 'from-pink-50 to-fuchsia-50', border: 'border-pink-200',  text: 'text-pink-700'  },
  'Manos':           { emoji: '💅', gradient: 'from-rose-50 to-pink-50',    border: 'border-rose-200',  text: 'text-rose-700'  },
  'Barbería':   { emoji: '🪒', gradient: 'from-slate-50 to-zinc-50',   border: 'border-slate-300', text: 'text-slate-700' },
}

const DEFAULT_CAT_META = { emoji: '💈', gradient: 'from-sky-50 to-blue-50', border: 'border-sky-200', text: 'text-sky-700' }

function getCatMeta(cat: string) {
  return CATEGORY_META_ES[cat] ?? CATEGORY_META[cat] ?? DEFAULT_CAT_META
}

export function ServiceSelector({ selected, onSelect, orgId, tenantType = 'medical' }: Props) {
  const [services, setServices]     = useState<Service[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [selectedCat, setSelectedCat] = useState<string | null>(null)

  const isBeauty = tenantType === 'beauty'

  useEffect(() => {
    setLoading(true)
    supabase
      .from('services')
      .select('*')
      .eq('active', true)
      .eq('organization_id', orgId)
      .order('name')
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return }
        setServices((data ?? []) as Service[])
        setLoading(false)
      })
  }, [orgId])

  const categories = useMemo(
    () => [...new Set(services.map(s => s.category).filter(Boolean))] as string[],
    [services],
  )

  const filteredServices = useMemo(
    () => isBeauty && selectedCat ? services.filter(s => s.category === selectedCat) : services,
    [services, isBeauty, selectedCat],
  )

  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>
  )

  if (error) return (
    <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">Error al cargar servicios: {error}</div>
  )

  if (isBeauty && !selectedCat) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Que servicio buscas?</h2>
        <p className="text-sm text-gray-500 mb-5">Elegi una categoria para comenzar</p>
        <div className="grid grid-cols-2 gap-4">
          {categories.map(cat => {
            const meta  = getCatMeta(cat)
            const count = services.filter(s => s.category === cat).length
            return (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className={`bg-gradient-to-br ${meta.gradient} border-2 ${meta.border} rounded-2xl p-6 flex flex-col items-center gap-3 hover:shadow-md transition-all duration-200 active:scale-95`}
              >
                <span className="text-5xl leading-none">{meta.emoji}</span>
                <div className="text-center">
                  <div className={`font-semibold text-base ${meta.text}`}>{cat}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{count} {count === 1 ? 'servicio' : 'servicios'}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      {isBeauty && selectedCat && (
        <button
          onClick={() => setSelectedCat(null)}
          className="flex items-center gap-1.5 text-sm font-medium text-sky-600 bg-sky-50 hover:bg-sky-100 px-3 py-2 rounded-xl transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" /> {selectedCat}
        </button>
      )}
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        {isBeauty ? `Servicios de ${selectedCat}` : 'Que servicio necesita?'}
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        {isBeauty ? 'Toca el servicio para continuar' : 'Seleccione el tipo de consulta'}
      </p>
      {filteredServices.length === 0 ? (
        <div className="bg-amber-50 text-amber-700 text-sm px-4 py-3 rounded-xl">
          No hay servicios disponibles en esta categoria por el momento.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredServices.map(s => (
            <button
              key={s.id}
              onClick={() => onSelect(s)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200
                ${selected?.id === s.id
                  ? 'border-sky-500 bg-sky-50'
                  : 'border-gray-100 bg-white hover:border-sky-200 hover:bg-sky-50/50 shadow-sm'}`}
            >
              <div className="flex items-start gap-3">
                <span className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: s.color ?? '#0ea5e9' }} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">{s.name}</div>
                  {s.description && <div className="text-sm text-gray-500 mt-0.5">{s.description}</div>}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3.5 h-3.5" />{s.duration_minutes} min
                    </span>
                    {s.price != null && s.price > 0 && (
                      <span className="text-xs text-gray-400">${s.price.toLocaleString('es-AR')}</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
