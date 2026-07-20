import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Shield, Zap, Users, Mail, MessageCircle, Linkedin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useProfile'
import type { User } from '@supabase/supabase-js'
import { Button } from '../components/ui/Button'

// Colores Praxis
const PRAXIS_TEAL = '#1a4a52'
const PRAXIS_GOLD = '#c9a97e'

const FEATURES = [
  { icon: Calendar, text: 'Turnos online 24/7'          },
  { icon: Users,    text: 'Multi-centro y multi-rol'    },
  { icon: Zap,      text: 'Confirmación por email y WhatsApp' },
  { icon: Shield,   text: 'Acceso seguro por rol'       },
]

export function LandingPage() {
  const [user, setUser]               = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const navigate = useNavigate()

  const { profile, loading: profileLoading } = useProfile(user)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!profile) return
    const role = profile.role
    if (role === 'superadmin' || role === 'globaladmin' || role === 'admin') navigate('/admin',       { replace: true })
    if (role === 'comercial')                                                  navigate('/admin',       { replace: true })
    if (role === 'recepcion')                                                  navigate('/recepcion',   { replace: true })
    if (role === 'medico')                                                     navigate('/profesional', { replace: true })
  }, [profile])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError('Email o contraseña incorrectos.')
    setLoading(false)
  }

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: PRAXIS_TEAL }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: PRAXIS_GOLD }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f7f8f9' }}>

      {/* Header */}
      <header className="px-6 py-4 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <img src={`${import.meta.env.BASE_URL}praxis_logo.png`} alt="Praxis Operativa" className="h-9 w-auto" />
          <span
            className="text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full"
            style={{ color: PRAXIS_TEAL, backgroundColor: `${PRAXIS_TEAL}14` }}
          >
            Sistema de Turnos
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

          {/* Left: hero */}
          <div>
            <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: `${PRAXIS_GOLD}22`, color: '#8a6d3b' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PRAXIS_GOLD }} />
              Plataforma multicentro
            </div>
            <h1 className="text-4xl font-bold leading-tight mb-4" style={{ color: PRAXIS_TEAL }}>
              Gestión de turnos
              <span className="block" style={{ color: PRAXIS_GOLD }}>hecha a medida</span>
            </h1>
            <p className="text-gray-500 text-base mb-8 leading-relaxed">
              Cada organización, su propio sistema. Reservas online 24/7,
              pantalla de sala de espera, recordatorios automáticos y panel
              de gestión para profesionales y recepción.
            </p>
            <div className="space-y-3 mb-10">
              {FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-gray-600">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${PRAXIS_TEAL}14` }}>
                    <Icon className="w-4 h-4" style={{ color: PRAXIS_TEAL }} />
                  </div>
                  <span className="text-sm font-medium">{text}</span>
                </div>
              ))}
            </div>

            {/* Contact block */}
            <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: `${PRAXIS_TEAL}22`, backgroundColor: `${PRAXIS_TEAL}08` }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: PRAXIS_TEAL }}>¿Necesitás ayuda?</p>
              <div className="space-y-2">
                <a href="mailto:contacto@praxisoperativa.com"
                  className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  <Mail className="w-4 h-4 flex-shrink-0" style={{ color: PRAXIS_GOLD }} />
                  contacto@praxisoperativa.com
                </a>
                <a href="https://wa.me/5491156169164" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  <MessageCircle className="w-4 h-4 flex-shrink-0" style={{ color: PRAXIS_GOLD }} />
                  WhatsApp · 11 5616-9164
                </a>
                <a href="https://www.linkedin.com/company/praxisoperativa" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  <Linkedin className="w-4 h-4 flex-shrink-0" style={{ color: PRAXIS_GOLD }} />
                  linkedin.com/company/praxisoperativa
                </a>
              </div>
            </div>
          </div>

          {/* Right: login card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Card header bar */}
            <div className="h-2 w-full" style={{ background: `linear-gradient(90deg, ${PRAXIS_TEAL}, ${PRAXIS_GOLD})` }} />
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-1" style={{ color: PRAXIS_TEAL }}>Iniciar sesión</h2>
              <p className="text-sm text-gray-400 mb-7">Accedé a tu panel de gestión</p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-shadow"
                    style={{ '--tw-ring-color': PRAXIS_TEAL } as React.CSSProperties}
                    onFocus={e => e.currentTarget.style.borderColor = PRAXIS_TEAL}
                    onBlur={e => e.currentTarget.style.borderColor = ''}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-shadow"
                    onFocus={e => e.currentTarget.style.borderColor = PRAXIS_TEAL}
                    onBlur={e => e.currentTarget.style.borderColor = ''}
                  />
                </div>
                {error && (
                  <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-100">{error}</div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-60"
                  style={{ background: `linear-gradient(90deg, ${PRAXIS_TEAL}, #2a6a76)` }}
                >
                  {loading ? 'Ingresando...' : 'Ingresar'}
                </button>
              </form>

              <p className="text-center text-xs text-gray-400 mt-7 leading-relaxed">
                ¿No tenés acceso? Contactá al administrador del sistema<br />
                o escribinos a{' '}
                <a href="mailto:contacto@praxisoperativa.com" className="underline hover:text-gray-600" style={{ color: PRAXIS_TEAL }}>
                  contacto@praxisoperativa.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-5 border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}praxis_logo.png`} alt="Praxis Operativa" className="h-6 w-auto opacity-70" />
            <span className="text-xs text-gray-400">Sistema de Turnos · {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="mailto:contacto@praxisoperativa.com" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              contacto@praxisoperativa.com
            </a>
            <a href="https://wa.me/5491156169164" target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              WhatsApp
            </a>
            <a href="https://www.linkedin.com/company/praxisoperativa" target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
