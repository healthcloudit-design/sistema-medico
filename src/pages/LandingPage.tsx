import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Shield, Zap, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useProfile'
import type { User } from '@supabase/supabase-js'
import { Button } from '../components/ui/Button'

const FEATURES = [
  { icon: Calendar, text: 'Turnos online 24/7'          },
  { icon: Users,    text: 'Multi-centro y multi-rol'    },
  { icon: Zap,      text: 'Confirmacion por email'      },
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
    if (role === 'superadmin' || role === 'globaladmin' || role === 'admin') navigate('/admin',     { replace: true })
    if (role === 'comercial')                                                   navigate('/admin',     { replace: true })
    if (role === 'recepcion')                                                   navigate('/recepcion', { replace: true })
    if (role === 'medico')                                                      navigate('/profesional', { replace: true })
  }, [profile])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError('Email o contrasena incorrectos.')
    setLoading(false)
  }

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50 flex flex-col">

      {/* Header */}
      <header className="px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <div className="w-8 h-8 bg-sky-600 rounded-lg flex items-center justify-center">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">TurnOS</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

          {/* Left: hero */}
          <div>
            <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
              Gestion de turnos
              <span className="text-sky-600"> inteligente</span>
            </h1>
            <p className="text-gray-500 text-lg mb-8">
              Plataforma de reservas online para centros medicos, estetica y mas.
              Cada cliente, su propio sistema.
            </p>
            <div className="space-y-3">
              {FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-gray-600">
                  <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-sky-600" />
                  </div>
                  <span className="text-sm font-medium">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: login */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Iniciar sesion</h2>
            <p className="text-sm text-gray-400 mb-6">Accede a tu panel de gestion</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Contrasena</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
              )}
              <Button type="submit" loading={loading} size="lg" className="w-full !bg-sky-600 hover:!bg-sky-700">
                Ingresar
              </Button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-6">
              Si no tenes acceso, contacta al administrador del sistema.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center">
        <p className="text-xs text-gray-400">TurnOS &copy; {new Date().getFullYear()} — Sistema de turnos online</p>
      </footer>
    </div>
  )
}
