import { useState } from 'react'
import { LayoutDashboard, Calendar, Building2, Store, Menu, X, LogOut, Stethoscope, Clock, Users, Puzzle, BarChart2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { GreetingBanner } from '../shared/GreetingBanner'

interface NavItem {
  label: string
  icon: React.ElementType
  view: AdminView
  superadminOnly?: boolean
}

export type AdminView = 'dashboard' | 'appointments' | 'availability' | 'services' | 'professionals' | 'users' | 'modules' | 'centros' | 'reportes'

const NAV: NavItem[] = [
  { label: 'Dashboard',      icon: LayoutDashboard, view: 'dashboard' },
  { label: 'Turnos',         icon: Calendar,        view: 'appointments' },
  { label: 'Disponibilidad', icon: Clock,           view: 'availability' },
  { label: 'Servicios',      icon: Stethoscope,     view: 'services' },
  { label: 'Profesionales',  icon: Building2,       view: 'professionals' },
  { label: 'Usuarios',       icon: Users,           view: 'users' },
  { label: 'Centros',         icon: Store,           view: 'centros',       superadminOnly: true },
  { label: 'Reportes',        icon: BarChart2,       view: 'reportes',      superadminOnly: true },
  { label: 'Módulos',        icon: Puzzle,          view: 'modules',       superadminOnly: true },
]

interface Props {
  children: React.ReactNode
  activeView: AdminView
  onNavigate: (view: AdminView) => void
  userRole?: string
  userName?: string
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 13) return 'Buen día'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

export function AdminLayout({ children, activeView, onNavigate, userRole = 'admin', userName = '' }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const isSuperadmin = userRole === 'superadmin'
  const isAdmin      = ['admin', 'superadmin'].includes(userRole)

  const visibleNav = NAV.filter(item => {
    if (item.superadminOnly) return isSuperadmin || userRole === 'globaladmin'
    if (item.view === 'users') return isAdmin
    return true
  })

  const handleLogout = () => supabase.auth.signOut()

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-gray-100 fixed inset-y-0 left-0 z-20">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-sky-600 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">TurnOS</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {visibleNav.map(item => (
            <NavButton key={item.view} item={item} active={activeView === item.view} onClick={() => onNavigate(item.view)} />
          ))}
        </nav>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-gray-100 transform transition-transform duration-300 lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-sky-600 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">TurnOS</span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {visibleNav.map(item => (
            <NavButton
              key={item.view}
              item={item}
              active={activeView === item.view}
              onClick={() => { onNavigate(item.view); setMobileOpen(false) }}
            />
          ))}
        </nav>
      </aside>

      <div className="flex-1 lg:pl-60">
        {/* Header desktop */}
        <header className="hidden lg:flex sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-3 items-center justify-between">
          <div>
            <span className="text-sm text-gray-500">{getGreeting()},</span>
            <span className="ml-1.5 font-semibold text-gray-900">{userName || '—'}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </header>

        {/* Header mobile */}
        <header className="lg:hidden sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100">
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <span className="font-bold text-gray-900">TurnOS</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 hidden sm:block">{userName}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="p-4 lg:p-6 max-w-6xl mx-auto">
          {activeView === 'dashboard' && (
            <div className="mb-6">
              <GreetingBanner userName={userName} />
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-sm rounded-xl transition-colors ${active ? 'bg-sky-50 text-sky-700 font-medium' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {item.label}
    </button>
  )
}
