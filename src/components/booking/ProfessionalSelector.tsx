import { useEffect, useState } from 'react'
import { ChevronLeft, UserCircle, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { alpha } from '../../lib/color'
import type { Professional, Service, TenantType } from '../../types'

const GOLD = '#C9A96E'

interface Props {
  service: Service
  selected?: Professional
  onSelect: (professional: Professional) => void
  onConfirm: () => void
  onBack: () => void
  accentColor?: string
  tenantType?: TenantType
  darkMode?: boolean
}

export function ProfessionalSelector({ service, selected, onSelect, onConfirm, onBack, accentColor = '#0ea5e9', tenantType = 'medical', darkMode = false }: Props) {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const isCancha = tenantType === 'cancha'
  const accent   = darkMode ? GOLD : accentColor

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
    <div style={{ padding: '24px', color: darkMode ? '#fca5a5' : '#b91c1c', backgroundColor: darkMode ? 'rgba(239,68,68,0.08)' : '#fef2f2', borderRadius: '12px', fontSize: '14px' }}>
      Error al cargar {isCancha ? 'canchas' : 'profesionales'}: {error}
    </div>
  )

  if (loading) return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[1, 2].map(i => (
        <div key={i} style={{ height: '80px', backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : '#f3f4f6', borderRadius: '16px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ))}
    </div>
  )

  const dark = {
    card: '#141414',
    cardSel: 'rgba(201,169,110,0.08)',
    border: 'rgba(255,255,255,0.07)',
    borderSel: 'rgba(201,169,110,0.4)',
    text: '#fff',
    sub: 'rgba(255,255,255,0.5)',
    pad: '24px 20px 28px',
  }

  return (
    <div style={{ padding: darkMode ? dark.pad : '0' }}>

      {/* Back */}
      {darkMode ? (
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid rgba(201,169,110,0.3)', borderRadius: '8px', padding: '7px 14px', color: GOLD, fontFamily: 'Inter, sans-serif', fontSize: '13px', cursor: 'pointer', marginBottom: '28px' }}>
          <ChevronLeft size={14} /> Volver
        </button>
      ) : (
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-colors mb-4" style={{ color: accentColor, backgroundColor: alpha(accentColor, 0.08) }}>
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
      )}

      {/* Title */}
      {darkMode ? (
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '22px', fontStyle: 'italic', fontWeight: 400, color: '#fff', margin: 0 }}>
            {isCancha ? 'Elegí tu cancha' : 'Elegí tu profesional'}
          </h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginTop: '6px' }}>
            {isCancha ? `Disponible para: ${service.name}` : `Todos atienden ${service.name}`}
          </p>
        </div>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{isCancha ? 'Elegí tu cancha' : 'Elegi un profesional'}</h2>
          <p className="text-sm text-gray-500 mb-4">{isCancha ? `Disponible para: ${service.name}` : `Todos atienden: `}{!isCancha && <strong>{service.name}</strong>}</p>
        </>
      )}

      {professionals.length === 0 ? (
        <div style={{ backgroundColor: darkMode ? 'rgba(251,191,36,0.08)' : '#fffbeb', color: darkMode ? '#d97706' : '#b45309', borderRadius: '12px', padding: '14px 16px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
          No hay {isCancha ? 'canchas' : 'profesionales'} disponibles para este servicio.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {professionals.map(p => {
            const isSel = selected?.id === p.id
            return (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                style={darkMode ? {
                  display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderRadius: '14px', border: isSel ? `1px solid ${GOLD}` : `1px solid ${dark.border}`, backgroundColor: isSel ? dark.cardSel : dark.card, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', width: '100%'
                } : {
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '16px', border: `2px solid ${isSel ? accentColor : '#f3f4f6'}`, backgroundColor: isSel ? alpha(accentColor, 0.06) : '#fff', boxShadow: isSel ? 'none' : '0 1px 3px rgba(0,0,0,0.06)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', width: '100%'
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  backgroundColor: darkMode ? (isSel ? GOLD : 'rgba(201,169,110,0.12)') : (isSel ? accentColor : alpha(accentColor, 0.12))
                }}>
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt={p.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : isSel ? (
                    <CheckCircle size={20} style={{ color: darkMode ? '#0B0B0B' : '#fff' }} />
                  ) : (
                    <UserCircle size={20} style={{ color: darkMode ? GOLD : accentColor }} />
                  )}
                </div>
                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: '14px', color: darkMode ? dark.text : '#111827' }}>{p.full_name}</div>
                  {p.specialty && !isCancha && <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: darkMode ? dark.sub : '#6b7280', marginTop: '2px' }}>{p.specialty}</div>}
                  {p.bio && <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: darkMode ? 'rgba(255,255,255,0.3)' : '#9ca3af', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '260px' }}>{p.bio}</div>}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <button
          onClick={onConfirm}
          style={{
            width: '100%', marginTop: '16px', border: 'none', borderRadius: '12px', padding: '15px', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '14px', letterSpacing: '0.04em', cursor: 'pointer',
            backgroundColor: darkMode ? GOLD : accentColor,
            color: darkMode ? '#0B0B0B' : '#fff',
          }}
        >
          {isCancha ? `Reservar ${selected.full_name}` : `Continuar con ${selected.full_name}`}
        </button>
      )}
    </div>
  )
}
