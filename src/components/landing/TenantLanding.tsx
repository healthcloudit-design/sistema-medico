import {
  Calendar, Shield, Zap, Users, Heart, Activity, Sparkles,
  Scissors, Dumbbell, Eye, Stethoscope, Star, Wind, Lock,
  Monitor, TrendingUp, Smile,
} from 'lucide-react'
import type { TenantConfig } from '../../config/tenantRegistry'
import type { Organization } from '../../types'

// Map keyword → lucide component
const ICON_MAP: Record<string, React.ElementType> = {
  eye:          Eye,
  monitor:      Monitor,
  shield:       Shield,
  calendar:     Calendar,
  stethoscope:  Stethoscope,
  sparkles:     Sparkles,
  heart:        Heart,
  lock:         Lock,
  users:        Users,
  activity:     Activity,
  zap:          Zap,
  'trending-up':TrendingUp,
  scissors:     Scissors,
  star:         Star,
  wind:         Wind,
  dumbbell:     Dumbbell,
  smile:        Smile,
}

interface Props {
  config: TenantConfig
  org:    Organization
  onStart: () => void
}

export function TenantLanding({ config, org, onStart }: Props) {
  const { theme } = config
  const logoUrl   = org.logo_url ?? null

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F4F5F7' }}>

      {/* ── Hero ── */}
      <div style={{ background: `linear-gradient(145deg, ${theme.gradientFrom} 0%, ${theme.gradientTo} 100%)`, position: 'relative', overflow: 'hidden' }}>
        {/* Decorative circles */}
        <div style={{ position:'absolute', top:'-60px', right:'-60px', width:'280px', height:'280px', borderRadius:'50%', backgroundColor:'rgba(255,255,255,0.04)' }}/>
        <div style={{ position:'absolute', bottom:'-40px', left:'-40px', width:'180px', height:'180px', borderRadius:'50%', backgroundColor:'rgba(255,255,255,0.03)' }}/>

        <div className="max-w-2xl mx-auto px-5 pt-12 pb-14" style={{ position:'relative', zIndex:1 }}>
          {/* Logo */}
          {logoUrl ? (
            <img src={logoUrl} alt={org.name} className="w-20 h-20 rounded-2xl object-contain bg-white shadow-xl p-1.5 mb-6"/>
          ) : (
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-2xl font-bold text-white"
              style={{ backgroundColor: theme.pillBg, border:'1px solid rgba(255,255,255,0.15)' }}>
              {org.name.charAt(0)}
            </div>
          )}

          {/* Eyebrow pill */}
          <div className="inline-flex items-center gap-1.5 mb-4 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest"
            style={{ backgroundColor: theme.pillBg, color: theme.iconColor, border:`1px solid ${theme.iconColor}33` }}>
            {config.eyebrow}
          </div>

          {/* Org name */}
          <div className="text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>{org.name}</div>

          {/* Hero title */}
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight" style={{ letterSpacing:'-0.02em' }}>
            {config.heroTitle}
          </h1>

          {/* Subtitle */}
          <p className="text-base mb-8 leading-relaxed max-w-lg" style={{ color:'rgba(255,255,255,0.65)' }}>
            {config.heroSub}
          </p>

          {/* CTA */}
          <button onClick={onStart}
            className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl font-bold text-sm shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: theme.accent === theme.gradientTo ? '#fff' : theme.accent, color: theme.accent === theme.gradientTo ? theme.gradientFrom : '#fff', boxShadow:`0 8px 32px ${theme.accent}44` }}>
            <Calendar size={16}/>
            {config.ctaLabel}
          </button>
        </div>
      </div>

      {/* ── Features ── */}
      <div className="max-w-2xl mx-auto w-full px-5 py-10">
        <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color:'#94A3B8' }}>
          Por qué elegirnos
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {config.features.map(([iconKey, text]) => {
            const Icon = ICON_MAP[iconKey] ?? Calendar
            return (
              <div key={text} className="flex items-center gap-3 rounded-xl p-4"
                style={{ backgroundColor:'#fff', border:'1px solid #E2E8F0', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${theme.accent}14` }}>
                  <Icon size={16} style={{ color: theme.accent }}/>
                </div>
                <span className="text-sm font-medium" style={{ color:'#374151' }}>{text}</span>
              </div>
            )
          })}
        </div>

        {/* Secondary CTA */}
        <div className="mt-8 text-center">
          <button onClick={onStart}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90"
            style={{ backgroundColor: theme.accent }}>
            <Calendar size={14}/>
            {config.ctaLabel}
          </button>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="mt-auto border-t py-5 text-center" style={{ borderColor:'#E2E8F0', backgroundColor:'#fff' }}>
        <p className="text-xs" style={{ color:'#CBD5E1' }}>
          Turnos online impulsados por{' '}
          <span className="font-semibold" style={{ color:'#0F2830' }}>PRAXIS Agenda</span>
        </p>
      </div>

      {/* ── Mobile sticky CTA ── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 z-20"
        style={{ backgroundColor:'#fff', borderTop:'1px solid #E2E8F0', boxShadow:'0 -4px 20px rgba(0,0,0,0.08)' }}>
        <button onClick={onStart}
          className="w-full py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2"
          style={{ backgroundColor: theme.accent }}>
          <Calendar size={16}/> {config.ctaLabel}
        </button>
      </div>
    </div>
  )
}
