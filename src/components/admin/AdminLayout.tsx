import { useState } from 'react'
import { LayoutDashboard, Calendar, Building2, Store, Menu, X, LogOut, Stethoscope, Clock, Users, Puzzle, BarChart2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { GreetingBanner } from '../shared/GreetingBanner'

// ── Praxis brand tokens ───────────────────────────────────────
const P_TEAL = '#1a4a52'
const P_GOLD = '#c9a97e'
const P_TEAL_LIGHT = '#1a4a5218'
const P_GOLD_LIGHT = '#c9a97e22'

interface NavItem {
  label: string
  icon: React.ElementType
  view: AdminView
  superadminOnly?: boolean
}

export type AdminView = 'dashboard' | 'appointments' | 'availability' | 'services' | 'professionals' | 'users' | 'modules' | 'centros' | 'reportes'

const NAV: NavItem[] = [
  { label: 'Dashboard',      icon: LayoutDashboard, view: 'dashboard'     },
  { label: 'Turnos',         icon: Calendar,        view: 'appointments'  },
  { label: 'Disponibilidad', icon: Clock,           view: 'availability'  },
  { label: 'Servicios',      icon: Stethoscope,     view: 'services'      },
  { label: 'Profesionales',  icon: Building2,       view: 'professionals' },
  { label: 'Usuarios',       icon: Users,           view: 'users'         },
  { label: 'Centros',        icon: Store,           view: 'centros',      superadminOnly: true },
  { label: 'Reportes',       icon: BarChart2,       view: 'reportes',     superadminOnly: true },
  { label: 'Módulos',        icon: Puzzle,          view: 'modules',      superadminOnly: true },
]

const ROLE_LABEL: Record<string, string> = {
  superadmin: 'Super Admin',
  globaladmin: 'Global Admin',
  comercial: 'Comercial',
  admin: 'Admin',
}

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
  const isPraxis     = ['superadmin', 'globaladmin', 'comercial'].includes(userRole)

  const visibleNav = NAV.filter(item => {
    if (item.superadminOnly) return isSuperadmin || userRole === 'globaladmin'
    if (item.view === 'users') return isAdmin || userRole === 'globaladmin'
    return true
  })

  const handleLogout = () => supabase.auth.signOut()

  // ── Sidebar logo section ─────────────────────────────────────
  const SidebarBrand = () => isPraxis ? (
    <div className="p-5 border-b" style={{ borderColor: `${P_GOLD}33` }}>
      <img src="/praxis_logo.png" alt="Praxis Operativa" className="h-8 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
      <p className="text-xs mt-2 font-medium" style={{ color: P_GOLD }}>Sistema de Turnos</p>
    </div>
  ) : (
    <div className="p-5 border-b border-gray-100">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-sky-600 rounded-lg flex items-center justify-center">
          <Calendar className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-gray-900">TurnOS</span>
      </div>
    </div>
  )

  // ── Mobile header brand ──────────────────────────────────────
  const MobileHeaderBrand = () => isPraxis ? (
    <img src="/praxis_logo.png" alt="Praxis Operativa" className="h-7 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
  ) : (
    <span className="font-bold text-gray-900">TurnOS</span>
  )

  // ── Sidebar styles ───────────────────────────────────────────
  const sidebarBg    = isPraxis ? P_TEAL    : 'white'
  const sidebarBorder = isPraxis ? 'transparent' : '#f3f4f6'

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-60 fixed inset-y-0 left-0 z-20"
        style={{ backgroundColor: sidebarBg, borderRight: `1px solid ${sidebarBorder}` }}
      >
        <SidebarBrand />
        <nav className="flex-1 p-3 space-y-1">
          {visibleNav.map(item => (
            <NavButton
              key={item.view}
              item={item}
              active={activeView === item.view}
              isPraxis={isPraxis}
              onClick={() => onNavigate(item.view)}
            />
          ))}
        </nav>
        {/* Role badge bottom */}
        <div className="p-4 border-t" style={{ borderColor: isPraxis ? `${P_GOLD}33` : '#f3f4f6' }}>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={isPraxis
              ? { backgroundColor: P_GOLD_LIGHT, color: P_GOLD }
              : { backgroundColor: '#f0f9ff', color: '#0284c7' }}
          >
            {ROLE_LABEL[userRole] ?? userRole}
          </span>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 transform transition-transform duration-300 lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ backgroundColor: sidebarBg, borderRight: `1px solid ${sidebarBorder}` }}
      >
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: isPraxis ? `${P_GOLD}33` : '#f3f4f6' }}>
          <MobileHeaderBrand />
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded-lg transition-colors"
            style={isPraxis ? { color: P_GOLD } : { color: '#6b7280' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {visibleNav.map(item => (
            <NavButton
              key={item.view}
              item={item}
              active={activeView === item.view}
              isPraxis={isPraxis}
              onClick={() => { onNavigate(item.view); setMobileOpen(false) }}
            />
          ))}
        </nav>
        <div className="p-4 border-t" style={{ borderColor: isPraxis ? `${P_GOLD}33` : '#f3f4f6' }}>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={isPraxis
              ? { backgroundColor: P_GOLD_LIGHT, color: P_GOLD }
              : { backgroundColor: '#f0f9ff', color: '#0284c7' }}
          >
            {ROLE_LABEL[userRole] ?? userRole}
          </span>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:pl-60">

        {/* Desktop header */}
        <header
          className="hidden lg:flex sticky top-0 z-10 px-6 py-3 items-center justify-between"
          style={isPraxis
            ? { backgroundColor: '#f0f4f5', borderBottom: `1px solid ${P_TEAL}22` }
            : { backgroundColor: 'white', borderBottom: '1px solid #f3f4f6' }}
        >
          <div className="flex items-center gap-3">
            <div>
              <span className="text-sm text-gray-500">{getGreeting()},</span>
              <span className="ml-1.5 font-semibold text-gray-900">{userName || '—'}</span>
            </div>
            {isPraxis && (
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: P_TEAL_LIGHT, color: P_TEAL }}
              >
                {ROLE_LABEL[userRole]}
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl transition-colors text-gray-500 hover:text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </header>

        {/* Mobile header */}
        <header
          className="lg:hidden sticky top-0 z-10 px-4 py-3 flex items-center justify-between"
          style={isPraxis
            ? { backgroundColor: P_TEAL, borderBottom: `1px solid ${P_GOLD}33` }
            : { backgroundColor: 'white', borderBottom: '1px solid #f3f4f6' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-1.5 rounded-lg"
              style={isPraxis ? { color: P_GOLD } : { color: '#4b5563' }}
            >
              <Menu className="w-5 h-5" />
            </button>
            {isPraxis
              ? <img src="/praxis_logo.png" alt="Praxis" className="h-6 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
              : <span className="font-bold text-gray-900">TurnOS</span>
            }
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm hidden sm:block" style={isPraxis ? { color: P_GOLD } : { color: '#6b7280' }}>
              {userName}
            </span>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg transition-colors"
              style={isPraxis ? { color: P_GOLD } : { color: '#6b7280' }}
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

function NavButton({ item, active, isPraxis, onClick }: {
  item: NavItem; active: boolean; isPraxis: boolean; onClick: () => void
}) {
  const Icon = item.icon

  const activeStyle = isPraxis
    ? { backgroundColor: P_GOLD_LIGHT, color: P_GOLD }
    : { backgroundColor: '#f0f9ff', color: '#0284c7' }

  const inactiveStyle = isPraxis
    ? { color: 'rgba(255,255,255,0.65)' }
    : { color: '#6b7280' }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm rounded-xl transition-all font-medium"
      style={active ? activeStyle : inactiveStyle}
      onMouseEnter={e => {
        if (!active) Object.assign((e.currentTarget as HTMLElement).style,
          isPraxis ? { backgroundColor: 'rgba(255,255,255,0.08)', color: 'white' } : { backgroundColor: '#f9fafb', color: '#374151' })
      }}
      onMouseLeave={e => {
        if (!active) Object.assign((e.currentTarget as HTMLElement).style,
          isPraxis ? { backgroundColor: 'transparent', color: 'rgba(255,255,255,0.65)' } : { backgroundColor: 'transparent', color: '#6b7280' })
      }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {item.label}
    </button>
  )
}
