import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { alpha } from '../../lib/color'
import type { Service } from '../../types'

interface Props {
  selected?: Service
  onSelect: (service: Service) => void
  orgId: string
  tenantType?: import('../../types').TenantType
  accentColor?: string
}

// Real photo URLs from Unsplash (stable CDN links, no API key required)
const CATEGORY_IMAGES: Record<string, string> = {
  // Beauty / hair
  'Peluquería':   'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=480&h=360&fit=crop&auto=format',
  'Peluqueria':   'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=480&h=360&fit=crop&auto=format',
  // Nails
  'Manicuría':    'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=480&h=360&fit=crop&auto=format',
  'Manicuria':    'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=480&h=360&fit=crop&auto=format',
  'Manos':        'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=480&h=360&fit=crop&auto=format',
  'Nail Art':     'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=480&h=360&fit=crop&auto=format',
  'Semi':         'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=480&h=360&fit=crop&auto=format',
  'Esculpidas':   'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=480&h=360&fit=crop&auto=format',
  'Kapping':      'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=480&h=360&fit=crop&auto=format',
  // Feet
  'Pedicuría':    'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=480&h=360&fit=crop&auto=format',
  'Pedicuria':    'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=480&h=360&fit=crop&auto=format',
  // Massage / spa
  'Masajes':      'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=480&h=360&fit=crop&auto=format',
  'Reflexología': 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=480&h=360&fit=crop&auto=format',
  'Reflexologia': 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=480&h=360&fit=crop&auto=format',
  'Drenaje':      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=480&h=360&fit=crop&auto=format',
  // Facial / aesthetic
  'Facial':       'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=480&h=360&fit=crop&auto=format',
  'Aparatología': 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=480&h=360&fit=crop&auto=format',
  'Aparatologia': 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=480&h=360&fit=crop&auto=format',
  // Barber
  'Barbería':     'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=480&h=360&fit=crop&auto=format',
  'Barberia':     'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=480&h=360&fit=crop&auto=format',
  // Medical
  'Consultas':    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=480&h=360&fit=crop&auto=format',
  'Diagnóstico':  'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=480&h=360&fit=crop&auto=format',
  'Diagnostico':  'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=480&h=360&fit=crop&auto=format',
  'Tratamientos': 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=480&h=360&fit=crop&auto=format',
  'Procedimientos':'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=480&h=360&fit=crop&auto=format',
  // Sports / canchas
  'Fútbol':       'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=480&h=360&fit=crop&auto=format',
  'Futbol':       'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=480&h=360&fit=crop&auto=format',
  'Pádel':        'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=480&h=360&fit=crop&auto=format',
  'Padel':        'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=480&h=360&fit=crop&auto=format',
  'Tenis':        'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=480&h=360&fit=crop&auto=format',
}

// Fallback gradient for categories without a photo
const CATEGORY_GRADIENTS: Record<string, { from: string; to: string; text: string }> = {
  'Peluquería':   { from: '#fce7f3', to: '#f9a8d4', text: '#be185d' },
  'Manicuría':    { from: '#fff1f2', to: '#fecdd3', text: '#be123c' },
  'Masajes':      { from: '#f0fdfa', to: '#99f6e4', text: '#0f766e' },
  'Facial':       { from: '#fdf2f8', to: '#f5d0fe', text: '#a21caf' },
  'Consultas':    { from: '#eff6ff', to: '#bfdbfe', text: '#1d4ed8' },
  'Tratamientos': { from: '#f5f3ff', to: '#ddd6fe', text: '#6d28d9' },
  'Procedimientos':{ from: '#fff7ed', to: '#fed7aa', text: '#c2410c' },
  'Fútbol':       { from: '#f0fdf4', to: '#bbf7d0', text: '#15803d' },
  'Pádel':        { from: '#f0fdfa', to: '#a5f3fc', text: '#0e7490' },
  'Tenis':        { from: '#fefce8', to: '#fde68a', text: '#b45309' },
}

function getCategoryImage(cat: string): string | null {
  return CATEGORY_IMAGES[cat] ?? null
}

function getCategoryGradient(cat: string) {
  return CATEGORY_GRADIENTS[cat] ?? { from: '#f8fafc', to: '#e2e8f0', text: '#475569' }
}

export function ServiceSelector({ selected, onSelect, orgId, tenantType = 'medical', accentColor = '#0ea5e9' }: Props) {
  const [services, setServices]       = useState<Service[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [selectedCat, setSelectedCat] = useState<string | null>(null)

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

  // Show category grid for: beauty/estetica/cancha tenants always,
  // OR any tenant that has more than 1 category defined
  const isBeauty = tenantType === 'beauty' || tenantType === 'estetica' || tenantType === 'cancha'
  const showCategoryGrid = isBeauty || categories.length > 1

  const filteredServices = useMemo(
    () => showCategoryGrid && selectedCat ? services.filter(s => s.category === selectedCat) : services,
    [services, showCategoryGrid, selectedCat],
  )

  if (loading) return (
    <div className="grid grid-cols-2 gap-4">
      {[1, 2, 3, 4].map(i => <div key={i} className="aspect-[4/3] bg-gray-200 rounded-2xl animate-pulse" />)}
    </div>
  )

  if (error) return (
    <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">Error al cargar servicios: {error}</div>
  )

  // ── Category grid ──
  if (showCategoryGrid && !selectedCat) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          {tenantType === 'cancha' ? 'Que deporte querés jugar?' : 'Que servicio buscás?'}
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          {tenantType === 'cancha' ? 'Elegí el deporte para ver canchas disponibles' : 'Elegí una categoría para comenzar'}
        </p>
        <div className="grid grid-cols-2 gap-4">
          {categories.map(cat => {
            const img   = getCategoryImage(cat)
            const grad  = getCategoryGradient(cat)
            const count = services.filter(s => s.category === cat).length
            return (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className="relative rounded-2xl overflow-hidden hover:shadow-lg active:scale-95 transition-all duration-200 aspect-[4/3] group"
              >
                {/* Background: real photo or gradient fallback */}
                {img ? (
                  <img
                    src={img}
                    alt={cat}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(135deg, ${grad.from} 0%, ${grad.to} 100%)` }}
                  />
                )}
                {/* Dark gradient overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/5" />
                {/* Text */}
                <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
                  <div className="text-white font-bold text-base leading-tight drop-shadow">{cat}</div>
                  <div className="text-white/70 text-xs mt-0.5">{count} {count === 1 ? 'opción' : 'opciones'}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Service list ──
  return (
    <div>
      {showCategoryGrid && selectedCat && (
        <button
          onClick={() => setSelectedCat(null)}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-colors mb-4"
          style={{ color: accentColor, backgroundColor: alpha(accentColor, 0.08) }}
        >
          <ChevronLeft className="w-4 h-4" />
          {selectedCat}
        </button>
      )}
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        {tenantType === 'cancha'
          ? `Turnos de ${selectedCat}`
          : showCategoryGrid && selectedCat
            ? `Servicios de ${selectedCat}`
            : 'Que servicio necesita?'}
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        {tenantType === 'cancha'
          ? 'Elegí la duración del turno'
          : 'Tocá el servicio para continuar'}
      </p>
      {filteredServices.length === 0 ? (
        <div className="bg-amber-50 text-amber-700 text-sm px-4 py-3 rounded-xl">
          No hay servicios disponibles en esta categoría por el momento.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredServices.map(s => (
            <button
              key={s.id}
              onClick={() => onSelect(s)}
              className="w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 shadow-sm hover:shadow-md"
              style={
                selected?.id === s.id
                  ? { borderColor: accentColor, backgroundColor: alpha(accentColor, 0.06) }
                  : { borderColor: '#e5e7eb', backgroundColor: '#fff' }
              }
            >
              <div className="flex items-start gap-3">
                <span className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: s.color ?? accentColor }} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">{s.name}</div>
                  {s.description && <div className="text-sm text-gray-500 mt-0.5">{s.description}</div>}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3.5 h-3.5" />{s.duration_minutes} min
                    </span>
                    {s.price != null && s.price > 0 && (
                      <span className="text-xs font-medium text-gray-500">${s.price.toLocaleString('es-AR')}</span>
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
