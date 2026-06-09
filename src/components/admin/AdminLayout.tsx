import { useState } from 'react'
import { LayoutDashboard, Calendar, Building2, Menu, X, LogOut, Stethoscope, Clock, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface NavItem {
  label: string
  icon: React.ElementType
  view: AdminView
}

export type AdminView = 'dashboard' | 'appointments' | 'availability' | 'services' | 'professionals' | 'users'

const NAV: NavItem[] = [
  { label: 'Dashboard',      icon: LayoutDashboard, view: 'dashboard' },
  { label: 'Turnos',         icon: Calendar,        view: 'appointments' },
  { label: 'Disponibilidad', icon: Clock,           view: 'availability' },
  { label: 'Servicios',      icon: Stethoscope,     view: 'services' },
  { label: 'Profesionales',  icon: Building2,       view: 'professionals' },
  { label: 'Usuarios',       icon: Users,           view: 'users' },
]

interface Props {
  children: React.ReactNode
  activeView: AdminView
  onNavigate: (view: AdminView) => void
  userRole?: string
}

export function AdminLayout({ children, activeView, onNavigate, userRole = 'admin' }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const isAdmin = ['admin', 'superadmin'].includes(userRole)
  const visibleNav = NAV.filter(item => item.view !== 'users' || isAdmin)

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
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesion
          </button>
        </div>
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
        <header className="lg:hidden sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <span className="font-bold text-gray-900">TurnOS</span>
        </header>
        <main className="p-4 lg:p-6 max-w-6xl mx-auto">
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
