import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useProfile'
import type { User } from '@supabase/supabase-js'
import { AdminLayout, type AdminView } from '../components/admin/AdminLayout'
import { Dashboard } from '../components/admin/Dashboard'
import { AppointmentList } from '../components/admin/AppointmentList'
import { AvailabilityManager } from '../components/admin/AvailabilityManager'
import { ServicesManager } from '../components/admin/ServicesManager'
import { ProfessionalsManager } from '../components/admin/ProfessionalsManager'
import { UserManager } from '../components/admin/UserManager'
import { Calendar } from 'lucide-react'
import { Button } from '../components/ui/Button'

export function AdminPage() {
  const [user, setUser]         = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [view, setView]         = useState<AdminView>('dashboard')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
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
    if (profile.role === 'medico')    navigate('/medico', { replace: true })
    if (profile.role === 'recepcion') navigate('/recepcion', { replace: true })
  }, [profile])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError('Credenciales incorrectas.')
    setLoginLoading(false)
  }

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-9 h-9 bg-sky-600 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">TurnOS</span>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="admin@ejemplo.com" required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Contrasena</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="..." required
              />
            </div>
            {authError && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{authError}</div>}
            <Button type="submit" loading={loginLoading} size="lg" className="w-full">Ingresar</Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout activeView={view} onNavigate={setView} userRole={profile?.role ?? 'admin'}>
      {view === 'dashboard'     && <Dashboard />}
      {view === 'appointments'  && <AppointmentList />}
      {view === 'availability'  && <AvailabilityManager />}
      {view === 'services'      && <ServicesManager />}
      {view === 'professionals' && <ProfessionalsManager />}
      {view === 'users'         && <UserManager />}
    </AdminLayout>
  )
}
