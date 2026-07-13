// ─────────────────────────────────────────────────────────────────────────────
// tenantRegistry.ts
// Central config for per-slug visual identity.
// Category → Specialty → Tenant
// ─────────────────────────────────────────────────────────────────────────────

export type TenantCategory =
  | 'medical'
  | 'beauty'
  | 'vet'
  | 'sports'
  | 'general'

export type TenantSpecialty =
  | 'generalMedicine'
  | 'medicalCenter'
  | 'dermatology'
  | 'kinesiology'
  | 'psychology'
  | 'pediatrics'
  | 'dentistry'
  | 'ophthalmology'
  | 'beautySalon'
  | 'nails'
  | 'massage'
  | 'veterinary'
  | 'petGrooming'
  | 'sportsCourts'

export interface SpecialtyTheme {
  gradientFrom: string
  gradientTo:   string
  accent:       string
  pillBg:       string   // semi-transparent pill background
  iconColor:    string
}

export interface TenantConfig {
  slug:       string
  category:   TenantCategory
  specialty:  TenantSpecialty
  eyebrow:    string          // small label above title
  heroTitle:  string
  heroSub:    string
  ctaLabel:   string
  features:   [string, string][]  // [icon-keyword, text]
  theme:      SpecialtyTheme
}

// ── Specialty themes ──────────────────────────────────────────────────────────
const THEMES: Record<TenantSpecialty, SpecialtyTheme> = {
  ophthalmology: {
    gradientFrom: '#0C2D6B',
    gradientTo:   '#1565C0',
    accent:       '#1976D2',
    pillBg:       'rgba(25,118,210,0.15)',
    iconColor:    '#90CAF9',
  },
  pediatrics: {
    gradientFrom: '#1B4332',
    gradientTo:   '#2D6A4F',
    accent:       '#40916C',
    pillBg:       'rgba(64,145,108,0.15)',
    iconColor:    '#95D5B2',
  },
  dentistry: {
    gradientFrom: '#0C4A6E',
    gradientTo:   '#0369A1',
    accent:       '#0284C7',
    pillBg:       'rgba(2,132,199,0.15)',
    iconColor:    '#7DD3FC',
  },
  kinesiology: {
    gradientFrom: '#7C2D12',
    gradientTo:   '#B45309',
    accent:       '#D97706',
    pillBg:       'rgba(217,119,6,0.15)',
    iconColor:    '#FCD34D',
  },
  psychology: {
    gradientFrom: '#2E1065',
    gradientTo:   '#4C1D95',
    accent:       '#7C3AED',
    pillBg:       'rgba(124,58,237,0.15)',
    iconColor:    '#C4B5FD',
  },
  dermatology: {
    gradientFrom: '#134E4A',
    gradientTo:   '#0D9488',
    accent:       '#14B8A6',
    pillBg:       'rgba(20,184,166,0.15)',
    iconColor:    '#99F6E4',
  },
  generalMedicine: {
    gradientFrom: '#0B1E24',
    gradientTo:   '#1A3F4E',
    accent:       '#C9A96E',
    pillBg:       'rgba(201,169,110,0.15)',
    iconColor:    '#C9A96E',
  },
  medicalCenter: {
    gradientFrom: '#0B1E24',
    gradientTo:   '#1A3F4E',
    accent:       '#C9A96E',
    pillBg:       'rgba(201,169,110,0.15)',
    iconColor:    '#C9A96E',
  },
  beautySalon: {
    gradientFrom: '#4A0E2E',
    gradientTo:   '#831843',
    accent:       '#EC4899',
    pillBg:       'rgba(236,72,153,0.15)',
    iconColor:    '#FBCFE8',
  },
  nails: {
    gradientFrom: '#500724',
    gradientTo:   '#9D174D',
    accent:       '#F43F5E',
    pillBg:       'rgba(244,63,94,0.15)',
    iconColor:    '#FECDD3',
  },
  massage: {
    gradientFrom: '#1C1917',
    gradientTo:   '#44403C',
    accent:       '#A8956A',
    pillBg:       'rgba(168,149,106,0.15)',
    iconColor:    '#D6C9A8',
  },
  veterinary: {
    gradientFrom: '#1E3A5F',
    gradientTo:   '#1D4ED8',
    accent:       '#3B82F6',
    pillBg:       'rgba(59,130,246,0.15)',
    iconColor:    '#BFDBFE',
  },
  petGrooming: {
    gradientFrom: '#431407',
    gradientTo:   '#7C2D12',
    accent:       '#F97316',
    pillBg:       'rgba(249,115,22,0.15)',
    iconColor:    '#FED7AA',
  },
  sportsCourts: {
    gradientFrom: '#052E16',
    gradientTo:   '#14532D',
    accent:       '#16A34A',
    pillBg:       'rgba(22,163,74,0.15)',
    iconColor:    '#86EFAC',
  },
}

// ── Feature icon keywords map to lucide icon names rendered in TenantLanding ─
// Format: [lucide-icon-name, text]

const TENANT_CONFIGS: TenantConfig[] = [
  // ── MEDICAL: Ophthalmology ──────────────────────────────────────────────────
  {
    slug: 'oftalmologia',
    category: 'medical', specialty: 'ophthalmology',
    eyebrow: 'Oftalmología',
    heroTitle: 'Cuidamos tu salud visual',
    heroSub: 'Diagnóstico, control y prevención. Atención oftalmológica profesional con tecnología de vanguardia.',
    ctaLabel: 'Reservar consulta oftalmológica',
    features: [
      ['eye',        'Control y diagnóstico visual'],
      ['monitor',    'Tecnología oftalmológica de última generación'],
      ['shield',     'Prevención y seguimiento personalizado'],
      ['calendar',   'Turnos online sin espera'],
    ],
    theme: THEMES.ophthalmology,
  },

  // ── MEDICAL: Dermatology ────────────────────────────────────────────────────
  {
    slug: 'dermatologo',
    category: 'medical', specialty: 'dermatology',
    eyebrow: 'Dermatología',
    heroTitle: 'Cuidado médico para tu piel',
    heroSub: 'Diagnóstico dermatológico profesional. Tratamientos clínicos y estéticos bajo supervisión médica especializada.',
    ctaLabel: 'Reservar consulta dermatológica',
    features: [
      ['stethoscope', 'Diagnóstico dermatológico clínico'],
      ['sparkles',    'Tratamientos médicos y estéticos'],
      ['shield',      'Prevención y control de lesiones'],
      ['calendar',    'Turnos online rápidos'],
    ],
    theme: THEMES.dermatology,
  },
  {
    slug: 'dra-aguiar',
    category: 'medical', specialty: 'dermatology',
    eyebrow: 'Dermatología',
    heroTitle: 'Cuidado médico para tu piel',
    heroSub: 'Diagnóstico dermatológico profesional. Tratamientos clínicos y estéticos bajo supervisión médica.',
    ctaLabel: 'Reservar consulta',
    features: [
      ['stethoscope', 'Diagnóstico dermatológico clínico'],
      ['sparkles',    'Tratamientos médicos y estéticos'],
      ['shield',      'Prevención y control de lesiones'],
      ['calendar',    'Turnos online rápidos'],
    ],
    theme: THEMES.dermatology,
  },

  // ── MEDICAL: Kinesiology ────────────────────────────────────────────────────
  {
    slug: 'kinesiologia',
    category: 'medical', specialty: 'kinesiology',
    eyebrow: 'Kinesiología y Rehabilitación',
    heroTitle: 'Recuperá tu movilidad y calidad de vida',
    heroSub: 'Kinesiología, fisioterapia y rehabilitación personalizada. Volvé a moverte sin dolor.',
    ctaLabel: 'Reservar sesión',
    features: [
      ['activity',   'Rehabilitación física personalizada'],
      ['zap',        'Fisioterapia y electroterapia'],
      ['trending-up','Recuperación y rendimiento funcional'],
      ['calendar',   'Turnos online disponibles'],
    ],
    theme: THEMES.kinesiology,
  },

  // ── MEDICAL: Psychology ─────────────────────────────────────────────────────
  {
    slug: 'psicologia',
    category: 'medical', specialty: 'psychology',
    eyebrow: 'Psicología',
    heroTitle: 'Un espacio seguro para escucharte',
    heroSub: 'Atención psicológica profesional y confidencial. Acompañamiento terapéutico adaptado a tus necesidades.',
    ctaLabel: 'Reservar consulta',
    features: [
      ['heart',      'Atención empática y personalizada'],
      ['lock',       'Privacidad y confidencialidad garantizadas'],
      ['users',      'Psicoterapia individual y de pareja'],
      ['calendar',   'Turnos presenciales y online'],
    ],
    theme: THEMES.psychology,
  },

  // ── MEDICAL: Pediatrics ─────────────────────────────────────────────────────
  {
    slug: 'pediatria',
    category: 'medical', specialty: 'pediatrics',
    eyebrow: 'Pediatría',
    heroTitle: 'Acompañamos el crecimiento de tus hijos',
    heroSub: 'Atención pediátrica cercana, cálida y profesional. Controles, vacunas y seguimiento desde el nacimiento.',
    ctaLabel: 'Reservar turno pediátrico',
    features: [
      ['stethoscope', 'Controles de crecimiento y desarrollo'],
      ['shield',      'Vacunación y prevención'],
      ['heart',       'Atención cálida para toda la familia'],
      ['calendar',    'Turnos online sin espera'],
    ],
    theme: THEMES.pediatrics,
  },

  // ── MEDICAL: Dentistry ──────────────────────────────────────────────────────
  {
    slug: 'odontologia',
    category: 'medical', specialty: 'dentistry',
    eyebrow: 'Odontología',
    heroTitle: 'Tu sonrisa en las mejores manos',
    heroSub: 'Atención odontológica integral con tecnología moderna. Higiene, estética dental y tratamientos avanzados.',
    ctaLabel: 'Reservar consulta odontológica',
    features: [
      ['smile',      'Estética dental y blanqueamiento'],
      ['shield',     'Higiene y prevención bucal'],
      ['zap',        'Tecnología digital en odontología'],
      ['calendar',   'Turnos online disponibles'],
    ],
    theme: THEMES.dentistry,
  },

  // ── MEDICAL: General / Medical Center ──────────────────────────────────────
  {
    slug: 'medico-general',
    category: 'medical', specialty: 'generalMedicine',
    eyebrow: 'Medicina General',
    heroTitle: 'Tu salud, nuestra prioridad',
    heroSub: 'Atención médica integral de calidad. Diagnóstico, seguimiento y derivaciones especializadas.',
    ctaLabel: 'Reservar consulta médica',
    features: [
      ['stethoscope', 'Diagnóstico médico integral'],
      ['shield',      'Prevención y medicina preventiva'],
      ['users',       'Atención para toda la familia'],
      ['calendar',    'Turnos online 24/7'],
    ],
    theme: THEMES.generalMedicine,
  },
  {
    slug: 'centro-medico-demo',
    category: 'medical', specialty: 'medicalCenter',
    eyebrow: 'Centro Médico',
    heroTitle: 'Atención médica integral en un solo lugar',
    heroSub: 'Múltiples especialidades, un solo centro. Reservá tu turno en segundos.',
    ctaLabel: 'Reservar turno',
    features: [
      ['stethoscope', 'Múltiples especialidades médicas'],
      ['shield',      'Diagnóstico y prevención'],
      ['users',       'Atención para toda la familia'],
      ['calendar',    'Turnos online 24/7'],
    ],
    theme: THEMES.medicalCenter,
  },

  // ── BEAUTY: Beauty Salon ────────────────────────────────────────────────────
  {
    slug: 'acqua',
    category: 'beauty', specialty: 'beautySalon',
    eyebrow: 'Centro de Estética',
    heroTitle: 'Realzá tu belleza natural',
    heroSub: 'Tratamientos estéticos profesionales para sentirte increíble. Bienestar y belleza en un solo lugar.',
    ctaLabel: 'Reservar turno',
    features: [
      ['sparkles',   'Tratamientos faciales y corporales'],
      ['heart',      'Atención personalizada'],
      ['star',       'Productos premium de primera línea'],
      ['calendar',   'Turnos online disponibles'],
    ],
    theme: THEMES.beautySalon,
  },
  {
    slug: 'libre',
    category: 'beauty', specialty: 'beautySalon',
    eyebrow: 'Centro de Estética',
    heroTitle: 'Bienestar que se nota',
    heroSub: 'Tratamientos estéticos y de bienestar para cuidarte de adentro hacia afuera.',
    ctaLabel: 'Reservar turno',
    features: [
      ['sparkles',   'Tratamientos faciales y corporales'],
      ['heart',      'Atención personalizada y cercana'],
      ['star',       'Productos y técnicas premium'],
      ['calendar',   'Turnos online sin espera'],
    ],
    theme: THEMES.beautySalon,
  },

  // ── BEAUTY: Nails ───────────────────────────────────────────────────────────
  {
    slug: 'flavia-nails',
    category: 'beauty', specialty: 'nails',
    eyebrow: 'Nail Studio',
    heroTitle: 'Uñas que hablan por vos',
    heroSub: 'Nail art, manicura y diseños únicos. Convertimos tus manos en tu mejor accesorio.',
    ctaLabel: 'Reservar turno',
    features: [
      ['scissors',   'Manicura y nail art de diseño'],
      ['sparkles',   'Semipermanente y acrílico'],
      ['star',       'Diseños únicos y personalizados'],
      ['calendar',   'Turnos rápidos sin lista de espera'],
    ],
    theme: THEMES.nails,
  },

  // ── BEAUTY: Massage ─────────────────────────────────────────────────────────
  {
    slug: 'masajes',
    category: 'beauty', specialty: 'massage',
    eyebrow: 'Centro de Masajes',
    heroTitle: 'Liberá tu cuerpo del estrés',
    heroSub: 'Masajes relajantes, terapéuticos y descontracturantes. Bienestar total en un ambiente tranquilo.',
    ctaLabel: 'Reservar sesión de masajes',
    features: [
      ['wind',       'Masajes relajantes y terapéuticos'],
      ['activity',   'Descontracturante y deportivo'],
      ['heart',      'Ambiente privado y acogedor'],
      ['calendar',   'Turnos disponibles hoy'],
    ],
    theme: THEMES.massage,
  },

  // ── VET: Veterinary ─────────────────────────────────────────────────────────
  {
    slug: 'san-roque-vet',
    category: 'vet', specialty: 'veterinary',
    eyebrow: 'Clínica Veterinaria',
    heroTitle: 'La salud de tu mascota en las mejores manos',
    heroSub: 'Atención veterinaria integral. Consultas, vacunación, cirugías y seguimiento para tu compañero.',
    ctaLabel: 'Reservar turno veterinario',
    features: [
      ['stethoscope', 'Consultas y diagnóstico clínico'],
      ['shield',      'Vacunación y desparasitación'],
      ['heart',       'Cirugías y tratamientos especializados'],
      ['calendar',    'Turnos online disponibles'],
    ],
    theme: THEMES.veterinary,
  },

  // ── VET: Pet Grooming ───────────────────────────────────────────────────────
  {
    slug: 'pelukitas',
    category: 'vet', specialty: 'petGrooming',
    eyebrow: 'Peluquería Canina y Felina',
    heroTitle: 'Tu mascota merece verse increíble',
    heroSub: 'Baño, corte, peluquería canina y felina profesional. Tu compañero sale hermoso y feliz.',
    ctaLabel: 'Reservar turno de peluquería',
    features: [
      ['scissors',   'Baño y corte profesional'],
      ['sparkles',   'Grooming y estética para mascotas'],
      ['heart',      'Trato cariñoso y cuidado especial'],
      ['calendar',   'Turnos disponibles esta semana'],
    ],
    theme: THEMES.petGrooming,
  },

  // ── SPORTS: Courts ──────────────────────────────────────────────────────────
  {
    slug: 'canchas-demo',
    category: 'sports', specialty: 'sportsCourts',
    eyebrow: 'Reserva de Canchas',
    heroTitle: 'Reservá tu cancha en segundos',
    heroSub: 'Canchas disponibles en tiempo real. Organizá tu próximo partido sin llamadas ni esperas.',
    ctaLabel: 'Reservar cancha',
    features: [
      ['dumbbell',   'Canchas de fútbol, pádel y más'],
      ['zap',        'Disponibilidad en tiempo real'],
      ['users',      'Ideal para grupos y equipos'],
      ['calendar',   'Reservas online 24/7'],
    ],
    theme: THEMES.sportsCourts,
  },
]

// ── Lookup helpers ────────────────────────────────────────────────────────────
const REGISTRY_MAP = new Map<string, TenantConfig>(
  TENANT_CONFIGS.map(c => [c.slug, c])
)

export function getTenantConfig(slug: string): TenantConfig | null {
  return REGISTRY_MAP.get(slug) ?? null
}

// Returns theme for a specialty (used in WaitingRoomScreen)
export function getSpecialtyTheme(specialty: TenantSpecialty): SpecialtyTheme {
  return THEMES[specialty]
}
