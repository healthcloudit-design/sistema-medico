const SANS = 'Inter, sans-serif'

// Obras sociales / coberturas de Bicentenario. Chips dibujadas de forma uniforme
// (mismo estilo para todas) para que el set sea coherente entre sí.
const OBRAS_SOCIALES = [
  'IOMA',
  'PREMEDIC',
  'OSPM (Marítimos)',
  'OSDOP',
  'SANCOR SALUD',
  'GALENO',
  'OSDE',
  'PAMI',
  'PARTICULAR',
  'DIAGNÓSTICO NORTE (Imágenes)',
]

/**
 * Carrusel (marquee) de coberturas para el hero. Estilo frosted-glass sobre fondo oscuro,
 * cada chip con una crucecita en el color de marca + el nombre. Se desliza solo y pausa al hover.
 */
export function ObrasSocialesCarousel({ accent = '#C9A96E', items = OBRAS_SOCIALES }: { accent?: string; items?: string[] }) {
  const doubled = [...items, ...items]
  return (
    <div style={{ width: '100%' }}>
      <style>{`
        @keyframes ooss-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .ooss-track { display: flex; width: max-content; animation: ooss-scroll 34s linear infinite; }
        .ooss-viewport:hover .ooss-track { animation-play-state: paused; }
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <span style={{ fontFamily: SANS, fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
          Trabajamos con
        </span>
      </div>

      <div
        className="ooss-viewport"
        style={{
          overflow: 'hidden',
          WebkitMaskImage: 'linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)',
          maskImage: 'linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)',
        }}
      >
        <div className="ooss-track">
          {doubled.map((name, i) => (
            <div
              key={i}
              aria-hidden={i >= items.length}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, margin: '0 6px',
                padding: '8px 16px', borderRadius: '100px',
                backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)',
                backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '6px', backgroundColor: accent, flexShrink: 0 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0B0B0B" strokeWidth="3.2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </span>
              <span style={{ fontFamily: SANS, fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em', color: '#fff', whiteSpace: 'nowrap' }}>
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
