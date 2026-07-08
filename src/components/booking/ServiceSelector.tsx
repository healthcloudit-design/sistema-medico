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

// ── Category hero images (4:3 full-width cards) ───────────────────────────
const CATEGORY_IMAGES: Record<string, string> = {
  'Peluquería':    'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=480&h=360&fit=crop&auto=format',
  'Peluqueria':    'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=480&h=360&fit=crop&auto=format',
  'Manicuría':     'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=480&h=360&fit=crop&auto=format',
  'Manicuria':     'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=480&h=360&fit=crop&auto=format',
  'Manos':         'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=480&h=360&fit=crop&auto=format',
  'Nail Art':      'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=480&h=360&fit=crop&auto=format',
  'Semi':          'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=480&h=360&fit=crop&auto=format',
  'Esculpidas':    'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=480&h=360&fit=crop&auto=format',
  'Kapping':       'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=480&h=360&fit=crop&auto=format',
  'Pedicuría':     'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=480&h=360&fit=crop&auto=format',
  'Pedicuria':     'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=480&h=360&fit=crop&auto=format',
  'Masajes':       'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=480&h=360&fit=crop&auto=format',
  'Reflexología':  'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=480&h=360&fit=crop&auto=format',
  'Reflexologia':  'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=480&h=360&fit=crop&auto=format',
  'Drenaje':       'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=480&h=360&fit=crop&auto=format',
  'Facial':        'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=480&h=360&fit=crop&auto=format',
  'Aparatología':  'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=480&h=360&fit=crop&auto=format',
  'Aparatologia':  'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=480&h=360&fit=crop&auto=format',
  'Barbería':      'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=480&h=360&fit=crop&auto=format',
  'Barberia':      'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=480&h=360&fit=crop&auto=format',
  // Medical categories: gradient fallback (no reliable free photo)
  'Fútbol':        'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=480&h=360&fit=crop&auto=format',
  'Futbol':        'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=480&h=360&fit=crop&auto=format',
  'Pádel':         'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=480&h=360&fit=crop&auto=format',
  'Padel':         'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=480&h=360&fit=crop&auto=format',
  'Tenis':         'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=480&h=360&fit=crop&auto=format',
}

// ── Service thumbnail images — keyword-based (small, 160x160) ─────────────
// Array of [keyword, url] — first match wins
const SERVICE_KEYWORD_IMAGES: [string, string][] = [
  // Hair
  ['keratina',    'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=160&h=160&fit=crop&auto=format'],
  ['alisado',     'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=160&h=160&fit=crop&auto=format'],
  ['brushing',    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=160&h=160&fit=crop&auto=format'],
  ['secado',      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=160&h=160&fit=crop&auto=format'],
  ['color',       'https://images.unsplash.com/photo-1522337660859-02dc82f4c5b9?w=160&h=160&fit=crop&auto=format'],
  ['tintura',     'https://images.unsplash.com/photo-1522337660859-02dc82f4c5b9?w=160&h=160&fit=crop&auto=format'],
  ['mechas',      'https://images.unsplash.com/photo-1522337660859-02dc82f4c5b9?w=160&h=160&fit=crop&auto=format'],
  ['rayos',       'https://images.unsplash.com/photo-1522337660859-02dc82f4c5b9?w=160&h=160&fit=crop&auto=format'],
  ['corte',       'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=160&h=160&fit=crop&auto=format'],
  ['lavado',      'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=160&h=160&fit=crop&auto=format'],
  ['ondas',       'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=160&h=160&fit=crop&auto=format'],
  // Nails
  ['semipermanente','https://images.unsplash.com/photo-1604654894610-df63bc536371?w=160&h=160&fit=crop&auto=format'],
  ['esculpidas',  'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=160&h=160&fit=crop&auto=format'],
  ['kapping',     'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=160&h=160&fit=crop&auto=format'],
  ['manicur',     'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=160&h=160&fit=crop&auto=format'],
  ['pedicur',     'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=160&h=160&fit=crop&auto=format'],
  ['nail art',    'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=160&h=160&fit=crop&auto=format'],
  ['esmalte',     'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=160&h=160&fit=crop&auto=format'],
  // Aesthetic / medical — short IDs removed (no thumbnail; falls back to category image)
  ['peeling',     'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=160&h=160&fit=crop&auto=format'],
  // Massage / spa
  ['drenaje',     'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=160&h=160&fit=crop&auto=format'],
  ['reflexolog',  'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=160&h=160&fit=crop&auto=format'],
  ['masaje',      'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=160&h=160&fit=crop&auto=format'],
  // Sports
  ['padel',       'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=160&h=160&fit=crop&auto=format'],
  ['pádel',       'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=160&h=160&fit=crop&auto=format'],
  ['tenis',       'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=160&h=160&fit=crop&auto=format'],
  ['fútbol',      'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=160&h=160&fit=crop&auto=format'],
  ['futbol',      'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=160&h=160&fit=crop&auto=format'],
]

function getServiceThumb(serviceName: string, catImg: string | null): string | null {
  const lower = serviceName.toLowerCase()
  for (const [kw, url] of SERVICE_KEYWORD_IMAGES) {
    if (lower.includes(kw)) return url
  }
  return catImg // fallback: same image as parent category
}

// Fallback gradient for categories without a photo
const CATEGORY_GRADIENTS: Record<string, { from: string; to: string }> = {
  'Peluquería':    { from: '#fce7f3', to: '#f9a8d4' },
  'Manicuría':     { from: '#fff1f2', to: '#fecdd3' },
  'Masajes':       { from: '#f0fdfa', to: '#99f6e4' },
  'Facial':        { from: '#fdf2f8', to: '#f5d0fe' },
  'Consultas':     { from: '#eff6ff', to: '#bfdbfe' },
  'Tratamientos':  { from: '#f5f3ff', to: '#ddd6fe' },
  'Procedimientos':{ from: '#fff7ed', to: '#fed7aa' },
}

function getCategoryImage(cat: string): string | null {
  return CATEGORY_IMAGES[cat] ?? null
}

function getCategoryGradient(cat: string) {
  return CATEGORY_GRADIENTS[cat] ?? { from: '#f8fafc', to: '#e2e8f0' }
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

  const isBeauty       = tenantType === 'beauty' || tenantType === 'estetica' || tenantType === 'cancha'
  const showCatGrid    = isBeauty || categories.length > 1
  const catImg         = selectedCat ? getCategoryImage(selectedCat) : null

  const filteredServices = useMemo(
    () => showCatGrid && selectedCat ? services.filter(s => s.category === selectedCat) : services,
    [services, showCatGrid, selectedCat],
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
  if (showCatGrid && !selectedCat) {
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/5" />
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
      {showCatGrid && selectedCat && (
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
          : showCatGrid && selectedCat
            ? `Servicios de ${selectedCat}`
            : 'Que servicio necesita?'}
      </h2>
      <p className="text-sm text-gray-500 mb-4">Tocá el servicio para continuar</p>

      {filteredServices.length === 0 ? (
        <div className="bg-amber-50 text-amber-700 text-sm px-4 py-3 rounded-xl">
          No hay servicios disponibles en esta categoría por el momento.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredServices.map(s => {
            const thumb    = getServiceThumb(s.name, catImg)
            const isSelected = selected?.id === s.id
            return (
              <button
                key={s.id}
                onClick={() => onSelect(s)}
                className="w-full text-left rounded-2xl border-2 overflow-hidden transition-all duration-200 hover:shadow-md"
                style={
                  isSelected
                    ? { borderColor: accentColor, backgroundColor: alpha(accentColor, 0.04) }
                    : { borderColor: '#e5e7eb', backgroundColor: '#fff' }
                }
              >
                <div className="flex items-stretch">
                  {/* Thumbnail */}
                  {thumb && (
                    <div className="w-24 flex-shrink-0 relative overflow-hidden">
                      <img
                        src={thumb}
                        alt={s.name}
                        className="w-full h-full object-cover"
                        style={{ minHeight: '88px' }}
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-black/20" style={{ backgroundColor: alpha(accentColor, 0.25) }} />
                      )}
                    </div>
                  )}
                  {/* Content */}
                  <div className="flex-1 p-4">
                    <div className="font-semibold text-gray-900 text-sm leading-snug">{s.name}</div>
                    {s.description && (
                      <div className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{s.description}</div>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />{s.duration_minutes} min
                      </span>
                      {s.price != null && s.price > 0 && (
                        <span className="text-xs font-medium" style={{ color: accentColor }}>
                          ${s.price.toLocaleString('es-AR')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
