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
import { ModulesManager } from '../components/admin/ModulesManager'
import { CentrosManager } from '../components/admin/CentrosManager'
import { ReportsView }   from '../components/admin/ReportsView'
import { OrgSettings }   from '../components/admin/OrgSettings'

export function AdminPage() {
  const [user, setUser]               = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [view, setView]               = useState<AdminView>('dashboard')
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
    if (authLoading) return
    if (!user) { navigate('/', { replace: true }); return }
    if (!profile) return
    if (profile.role === 'medico')    navigate('/medico',    { replace: true })
    if (profile.role === 'recepcion') navigate('/recepcion', { replace: true })
  }, [user, authLoading, profile])

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <AdminLayout activeView={view} onNavigate={setView} userRole={profile?.role ?? 'admin'} userName={profile?.full_name ?? ''}>
      {view === 'dashboard'     && <Dashboard organizationId={(profile as any)?.organization_id ?? null} isSuperAdmin={profile?.role === 'superadmin'} />}
      {view === 'appointments'  && <AppointmentList />}
      {view === 'availability'  && <AvailabilityManager />}
      {view === 'services'      && <ServicesManager organizationId={(profile as any)?.organization_id ?? null} />}
      {view === 'professionals' && <ProfessionalsManager />}
      {view === 'users'         && (
        <UserManager
          isSuperAdmin={profile?.role === 'superadmin'}
          currentOrgId={(profile as any)?.organization_id ?? null}
        />
      )}
      {view === 'modules'       && <ModulesManager />}
      {view === 'centros'       && <CentrosManager userRole={profile?.role} />}
      {view === 'reportes'      && <ReportsView />}
      {view === 'configuracion' && <OrgSettings organizationId={(profile as any)?.organization_id ?? null} />}
    </AdminLayout>
  )
}
