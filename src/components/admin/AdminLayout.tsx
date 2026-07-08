import { useState } from 'react'
import {
  LayoutDashboard, Calendar, Building2, Store, Menu, X,
  LogOut, Stethoscope, Clock, Users, Puzzle, BarChart2, ChevronRight,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ── PRAXIS Agenda design tokens ──────────────────────────────────────────────
export const PA = {
  // Petroleum blue scale
  P900: '#0B1E24',
  P800: '#0F2830',
  P700: '#14323D',
  P600: '#1A3F4E',
  P500: '#1e4d5e',
  // Gold
  GOLD: '#C9A96E',
  GOLD_DIM: '#C9A96E33',
  GOLD_BORDER: '#C9A96E55',
  // Text
  T_HI: '#FFFFFF',
  T_MED: 'rgba(255,255,255,0.55)',
  T_LOW: 'rgba(255,255,255,0.25)',
  // UI
  BORDER: 'rgba(255,255,255,0.07)',
  BORDER2: 'rgba(255,255,255,0.12)',
  // Content area
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
function PraxisWordmark({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', userSelect: 'none' }}>
      <span style={{
        fontFamily: "'Inter', sans-serif", fontWeight: 800,
        fontSize: '16px', letterSpacing: '-0.02em', color: PA.T_HI,
      }}>PRAXIS</span>
      {!collapsed && (
        <span style={{
          fontFamily: "'Inter', sans-serif", fontWeight: 300,
          fontSize: '14px', letterSpacing: '0.04em', color: PA.GOLD,
        }}>Agenda</span>
      )}
    </div>
  )
}

// ── Nav button ───────────────────────────────────────────────────────────────
function NavBtn({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        width: '100%', padding: '9px 12px', borderRadius: '8px',
        fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: active ? 500 : 400,
        border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
        backgroundColor: active
          ? PA.GOLD_DIM
          : hov ? 'rgba(255,255,255,0.06)' : 'transparent',
        color: active ? PA.GOLD : hov ? PA.T_HI : PA.T_MED,
      }}
    >
      <Icon size={15} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {active && <ChevronRight size={12} style={{ opacity: 0.5 }} />}
    </button>
  )
}

// ── Role pill ────────────────────────────────────────────────────────────────
function RolePill({ role }: { role: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: '999px',
      fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 500,
      backgroundColor: PA.GOLD_DIM, color: PA.GOLD, border: `1px solid ${PA.GOLD_BORDER}`,
      letterSpacing: '0.02em',
    }}>
      {ROLE_LABEL[role] ?? role}
    </span>
  )
}

// ── Sidebar content ──────────────────────────────────────────────────────────
function SidebarContent({ activeView, onNavigate, userRole, userName, onClose, onLogout }: {
  activeView: AdminView; onNavigate: (v: AdminView) => void
  userRole: string; userName: string; onClose?: () => void; onLogout: () => void
}) {
  const isSuperadmin = userRole === 'superadmin'
  const isAdmin = ['admin', 'superadmin'].includes(userRole)

  const visibleNav = NAV.filter(item => {
    if (item.superadminOnly) return isSuperadmin || userRole === 'globaladmin'
    if (item.view === 'users') return isAdmin || userRole === 'globaladmin'
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: PA.P800 }}>

      {/* Brand header */}
      <div style={{
        padding: '20px 16px 16px',
        borderBottom: `1px solid ${PA.BORDER}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <PraxisWordmark />
        {onClose && (
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: PA.T_MED, padding: '4px', borderRadius: '6px',
          }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {/* Group divider */}
        <div style={{ padding: '4px 12px 8px', fontFamily: "'Inter', sans-serif", fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: PA.T_LOW }}>
          Gestión
        </div>
        {visibleNav.slice(0, 6).map(item => (
          <NavBtn key={item.view} item={item} active={activeView === item.view}
            onClick={() => { onNavigate(item.view); onClose?.() }} />
        ))}
        {visibleNav.length > 6 && (
          <>
            <div style={{ padding: '12px 12px 8px', fontFamily: "'Inter', sans-serif", fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: PA.T_LOW, marginTop: '4px' }}>
              Sistema
            </div>
            {visibleNav.slice(6).map(item => (
              <NavBtn key={item.view} item={item} active={activeView === item.view}
                onClick={() => { onNavigate(item.view); onClose?.() }} />
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px 16px', borderTop: `1px solid ${PA.BORDER}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '8px',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 500, color: PA.T_HI, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
            {userName || '—'}
          </div>
          <RolePill role={userRole} />
        </div>
        <button onClick={onLogout} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '32px', height: '32px', borderRadius: '8px', border: 'none',
          backgroundColor: 'transparent', cursor: 'pointer', color: PA.T_MED,
          flexShrink: 0, transition: 'all 0.15s',
        }}
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

// ── Main layout ──────────────────────────────────────────────────────────────
export function AdminLayout({ children, activeView, onNavigate, userRole = 'admin', userName = '' }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const handleLogout = () => supabase.auth.signOut()

  return (
    <div style={{ minHeight: '100vh', backgroundColor: PA.BG, display: 'flex' }}>

      {/* ─ Desktop sidebar ─ */}
      <aside style={{
        display: 'none', width: '220px', position: 'fixed',
        inset: '0 auto 0 0', zIndex: 20, boxShadow: '2px 0 12px rgba(0,0,0,0.15)',
      }}
        className="lg-sidebar"
      >
        <style>{`
          @media (min-width: 1024px) {
            .lg-sidebar { display: flex !important; flex-direction: column; }
            .lg-content { padding-left: 220px !important; }
            .mobile-header { display: none !important; }
          }
        `}</style>
        <SidebarContent
          activeView={activeView} onNavigate={onNavigate}
          userRole={userRole} userName={userName} onLogout={handleLogout}
        />
      </aside>

      {/* ─ Mobile overlay ─ */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 30, backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* ─ Mobile sidebar ─ */}
      <aside style={{
        position: 'fixed', inset: '0 auto 0 0', width: '260px', zIndex: 40,
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: mobileOpen ? '4px 0 24px rgba(0,0,0,0.25)' : 'none',
      }}>
        <SidebarContent
          activeView={activeView} onNavigate={onNavigate}
          userRole={userRole} userName={userName}
          onClose={() => setMobileOpen(false)} onLogout={handleLogout}
        />
      </aside>

      {/* ─ Content ─ */}
      <div className="lg-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Mobile header */}
        <header className="mobile-header" style={{
          position: 'sticky', top: 0, zIndex: 10,
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: PA.P800, borderBottom: `1px solid ${PA.BORDER}`,
          boxShadow: '0 1px 8px rgba(0,0,0,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setMobileOpen(true)} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: PA.T_MED, padding: '4px',
            }}>
              <Menu size={20} />
            </button>
            <PraxisWordmark />
          </div>
          <button onClick={handleLogout} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: PA.T_MED, padding: '4px',
          }}>
            <LogOut size={16} />
          </button>
        </header>

        {/* Desktop top bar */}
        <header style={{
          display: 'none', position: 'sticky', top: 0, zIndex: 10,
          padding: '12px 28px',
          backgroundColor: PA.CARD, borderBottom: `1px solid ${PA.BORDER_LIGHT}`,
          alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
          className="lg-topbar"
        >
          <style>{`@media (min-width: 1024px) { .lg-topbar { display: flex !important; } }`}</style>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', color: PA.TEXT_SEC }}>
              {getGreeting()},
            </span>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 600, color: PA.TEXT }}>
              {userName || '—'}
            </span>
            <RolePill role={userRole} />
          </div>
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 14px', borderRadius: '8px', border: `1px solid ${PA.BORDER_LIGHT}`,
            backgroundColor: 'transparent', cursor: 'pointer',
            fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 500, color: PA.TEXT_SEC,
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#fca5a5'; el.style.color = '#dc2626'; el.style.backgroundColor = '#fef2f2' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = PA.BORDER_LIGHT; el.style.color = PA.TEXT_SEC; el.style.backgroundColor = 'transparent' }}
          >
            <LogOut size={14} /> Cerrar sesión
          </button>
        </header>

        <main style={{ padding: '28px 28px 60px', maxWidth: '1200px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
