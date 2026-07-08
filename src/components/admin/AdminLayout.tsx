import { useState } from 'react'
import {
  LayoutDashboard, Calendar, Building2, Store, Menu, X,
  LogOut, Stethoscope, Clock, Users, Puzzle, BarChart2, ChevronRight,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ── PRAXIS Agenda design tokens ──────────────────────────────────────────────
export const PA = {
  P900: '#0B1E24',
  P800: '#0F2830',
  P700: '#14323D',
  P600: '#1A3F4E',
  P500: '#1e4d5e',
  GOLD: '#C9A96E',
  GOLD_DIM: '#C9A96E22',
  GOLD_BORDER: '#C9A96E55',
  T_HI: '#FFFFFF',
  T_MED: 'rgba(255,255,255,0.55)',
  T_LOW: 'rgba(255,255,255,0.25)',
  BORDER: 'rgba(255,255,255,0.07)',
  BG: '#F4F5F7',
  CARD: '#FFFFFF',
  TEXT: '#111827',
  TEXT_SEC: '#6B7280',
  BORDER_LIGHT: '#E5E7EB',
} as const

export type AdminView =
  | 'dashboard' | 'appointments' | 'availability' | 'services'
  | 'professionals' | 'users' | 'modules' | 'centros' | 'reportes'

interface NavItem {
  label: string
  icon: React.ElementType
  view: AdminView
  superadminOnly?: boolean
}

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
  superadmin:  'Super Admin',
  globaladmin: 'Global Admin',
  comercial:   'Comercial',
  admin:       'Admin',
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

// ── Wordmark ─────────────────────────────────────────────────────────────────
function PraxisWordmark() {
  return (
    <div className="flex items-baseline gap-1 select-none">
      <span className="font-extrabold text-base tracking-tight text-white"
        style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '-0.02em' }}>
        PRAXIS
      </span>
      <span className="font-light text-sm tracking-wide" style={{ color: PA.GOLD, fontFamily: "'Inter', sans-serif", letterSpacing: '0.04em' }}>
        Agenda
      </span>
    </div>
  )
}

// ── Role pill ─────────────────────────────────────────────────────────────────
function RolePill({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: PA.GOLD_DIM, color: PA.GOLD, border: `1px solid ${PA.GOLD_BORDER}` }}>
      {ROLE_LABEL[role] ?? role}
    </span>
  )
}

// ── Nav button ────────────────────────────────────────────────────────────────
function NavBtn({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
      style={{
        backgroundColor: active ? PA.GOLD_DIM : 'transparent',
        color: active ? PA.GOLD : PA.T_MED,
        border: 'none', cursor: 'pointer', textAlign: 'left',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'
          ;(e.currentTarget as HTMLElement).style.color = PA.T_HI
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = PA.T_MED
        }
      }}
    >
      <Icon size={15} className="flex-shrink-0" />
      <span className="flex-1">{item.label}</span>
      {active && <ChevronRight size={12} style={{ opacity: 0.5 }} />}
    </button>
  )
}

// ── Sidebar inner content (shared desktop + mobile) ───────────────────────────
function SidebarContent({
  activeView, onNavigate, userRole, userName, onClose, onLogout,
}: {
  activeView: AdminView; onNavigate: (v: AdminView) => void
  userRole: string; userName: string; onClose?: () => void; onLogout: () => void
}) {
  const isSuperadmin = userRole === 'superadmin'
  const isAdmin      = ['admin', 'superadmin'].includes(userRole)

  const visibleNav = NAV.filter(item => {
    if (item.superadminOnly) return isSuperadmin || userRole === 'globaladmin'
    if (item.view === 'users') return isAdmin || userRole === 'globaladmin'
    return true
  })

  const mgmtItems = visibleNav.filter(i => !i.superadminOnly)
  const sysItems  = visibleNav.filter(i => i.superadminOnly)

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: PA.P800 }}>

      {/* Brand */}
      <div className="flex items-center justify-between px-4 py-5"
        style={{ borderBottom: `1px solid ${PA.BORDER}` }}>
        <PraxisWordmark />
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-md transition-colors"
            style={{ color: PA.T_MED, background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        <div className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-widest"
          style={{ color: PA.T_LOW, letterSpacing: '0.12em' }}>
          Gestión
        </div>
        {mgmtItems.map(item => (
          <NavBtn key={item.view} item={item} active={activeView === item.view}
            onClick={() => { onNavigate(item.view); onClose?.() }} />
        ))}
        {sysItems.length > 0 && (
          <>
            <div className="px-3 pb-2 pt-4 text-xs font-semibold uppercase tracking-widest"
              style={{ color: PA.T_LOW, letterSpacing: '0.12em' }}>
              Sistema
            </div>
            {sysItems.map(item => (
              <NavBtn key={item.view} item={item} active={activeView === item.view}
                onClick={() => { onNavigate(item.view); onClose?.() }} />
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 px-4 py-3"
        style={{ borderTop: `1px solid ${PA.BORDER}` }}>
        <div className="min-w-0">
          <div className="text-xs font-medium truncate mb-1" style={{ color: PA.T_HI, maxWidth: '120px' }}>
            {userName || '—'}
          </div>
          <RolePill role={userRole} />
        </div>
        <button onClick={onLogout}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-all flex-shrink-0"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: PA.T_MED }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239,68,68,0.15)'; (e.currentTarget as HTMLElement).style.color = '#f87171' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = PA.T_MED }}
          title="Cerrar sesión"
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export function AdminLayout({
  children, activeView, onNavigate, userRole = 'admin', userName = '',
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const handleLogout = () => supabase.auth.signOut()

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: PA.BG }}>

      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside className="hidden lg:flex flex-col w-56 fixed inset-y-0 left-0 z-20"
        style={{ boxShadow: '2px 0 12px rgba(0,0,0,0.18)' }}>
        <SidebarContent
          activeView={activeView} onNavigate={onNavigate}
          userRole={userRole} userName={userName} onLogout={handleLogout}
        />
      </aside>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 lg:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile sidebar ── */}
      <aside
        className="fixed inset-y-0 left-0 w-64 z-40 lg:hidden transition-transform duration-250"
        style={{
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          boxShadow: mobileOpen ? '4px 0 24px rgba(0,0,0,0.3)' : 'none',
        }}
      >
        <SidebarContent
          activeView={activeView} onNavigate={onNavigate}
          userRole={userRole} userName={userName}
          onClose={() => setMobileOpen(false)} onLogout={handleLogout}
        />
      </aside>

      {/* ── Content area ── */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-56">

        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-10 flex items-center justify-between px-4 py-3"
          style={{
            backgroundColor: PA.P800,
            borderBottom: `1px solid ${PA.BORDER}`,
            boxShadow: '0 1px 8px rgba(0,0,0,0.2)',
          }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: PA.T_MED, padding: '4px' }}>
              <Menu size={20} />
            </button>
            <PraxisWordmark />
          </div>
          <button onClick={handleLogout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: PA.T_MED, padding: '4px' }}>
            <LogOut size={16} />
          </button>
        </header>

        {/* Desktop top bar */}
        <header className="hidden lg:flex sticky top-0 z-10 items-center justify-between px-7 py-3"
          style={{
            backgroundColor: PA.CARD,
            borderBottom: `1px solid ${PA.BORDER_LIGHT}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{getGreeting()},</span>
            <span className="text-sm font-semibold text-gray-900">{userName || '—'}</span>
            <RolePill role={userRole} />
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
            style={{ borderColor: PA.BORDER_LIGHT, color: PA.TEXT_SEC, backgroundColor: 'transparent' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#fca5a5'; el.style.color = '#dc2626'; el.style.backgroundColor = '#fef2f2' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = PA.BORDER_LIGHT; el.style.color = PA.TEXT_SEC; el.style.backgroundColor = 'transparent' }}
          >
            <LogOut size={14} /> Cerrar sesión
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-5 lg:p-7 w-full max-w-6xl mx-auto box-border">
          {children}
        </main>
      </div>
    </div>
  )
}
