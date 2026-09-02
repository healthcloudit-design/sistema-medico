const SANS = 'Inter, sans-serif'

type Cobertura = { img: string; alt: string } | { text: string }

// Coberturas de Bicentenario. Logos reales sobre tarjetas blancas de ancho fijo (el logo se
// contiene adentro, así ninguno se corta ni se desborda). Las que no son obra social con logo
// (Particular / Diagnóstico Norte) van como tarjeta de texto. Imágenes en /public/obras-sociales.
const COBERTURAS: Cobertura[] = [
  { img: '/obras-sociales/ioma.png',     alt: 'IOMA' },
  { img: '/obras-sociales/premedic.png', alt: 'Premedic' },
  { img: '/obras-sociales/ospm.png',     alt: 'OSPM — Obra Social del Personal Marítimo' },
  { img: '/obras-sociales/osdop.png',    alt: 'OSDOP' },
  { img: '/obras-sociales/sancor.png',   alt: 'Sancor Salud' },
  { img: '/obras-sociales/galeno.png',   alt: 'Galeno' },
  { img: '/obras-sociales/osde.png',     alt: 'OSDE' },
  { img: '/obras-sociales/pami.png',     alt: 'PAMI' },
  { text: 'PARTICULAR' },
  { img: '/obras-sociales/diagnostico-norte.png', alt: 'Diagnóstico Norte' },
]

const cardBase = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  height: '50px', margin: '0 7px', borderRadius: '12px',
  backgroundColor: '#fff', boxShadow: '0 3px 12px rgba(0,0,0,0.16)',
} as const

/**
 * Carrusel (marquee) de coberturas para el hero. Tarjetas blancas uniformes; el logo se contiene
 * dentro de un ancho fijo para que ninguno se corte. Se desliza solo y pausa al pasar el mouse.
 */
export function ObrasSocialesCarousel({ items = COBERTURAS }: { items?: Cobertura[] }) {
  const doubled = [...items, ...items]
  return (
    <div style={{ width: '100%' }}>
      <style>{`
        @keyframes ooss-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .ooss-track { display: flex; width: max-content; align-items: center; animation: ooss-scroll 40s linear infinite; }
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
          padding: '6px 0 14px',
          WebkitMaskImage: 'linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)',
          maskImage: 'linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)',
        }}
      >
        <div className="ooss-track">
          {doubled.map((c, i) => (
            'img' in c ? (
              <div key={i} aria-hidden={i >= items.length} style={{ ...cardBase, width: '150px' }}>
                <img src={c.img} alt={c.alt} style={{ maxHeight: '30px', maxWidth: '118px', width: 'auto', objectFit: 'contain', display: 'block' }} />
              </div>
            ) : (
              <div key={i} aria-hidden={i >= items.length} style={{ ...cardBase, padding: '0 22px' }}>
                <span style={{ fontFamily: SANS, fontSize: '12.5px', fontWeight: 700, letterSpacing: '0.04em', color: '#0F2A3F', whiteSpace: 'nowrap' }}>
                  {c.text}
                </span>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  )
}
