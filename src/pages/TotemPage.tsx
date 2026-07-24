import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Calendar, Search, X, CheckCircle, XCircle, ChevronRight, User, CalendarOff, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type View = 'home' | 'lookup' | 'results' | 'cancel-confirm' | 'done'

interface OrgInfo { name: string; primary_color: string | null; tenant_type: string | null }
interface ApptResult {
  id: string
  patient_name: string
  starts_at: string
  status: string
  service_name: string
  professional_name: string
  service_color: string | null
}

// Tenants que usan la experiencia premium (misma regla que BookingFlow/PremiumBookingFlow)
const PREMIUM_TENANT_TYPES = ['beauty', 'estetica', 'medical', 'petshop', 'veterinary', 'cancha']

// ── Tokens del tema oscuro (mismos que PremiumBookingFlow) ──────────────────
const DARK       = '#0B0B0B'
const T_CARD     = '#141414'
const T_CARD2    = '#1A1A1A'
const T_BORDER   = 'rgba(255,255,255,0.08)'
const T_BORDER2  = 'rgba(255,255,255,0.14)'
const T_TEXT_PRI = '#FFFFFF'
const T_TEXT_SEC = 'rgba(255,255,255,0.55)'
const T_TEXT_MUT = 'rgba(255,255,255,0.32)'
const SERIF       = "'Playfair Display', Georgia, serif"
const SANS        = "'Inter', sans-serif"

function toArgDate(iso: string): Date {
  return new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000)
}

function toArgTime(iso: string) {
  const d = toArgDate(iso)
  return `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')}`
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

// "Hoy" / "Mañana" / null, comparando fechas en huso horario argentino
function getDayBadge(iso: string): string | null {
  const d   = toArgDate(iso)
  const now = toArgDate(new Date().toISOString())
  const dayStart = (x: Date) => Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())
  const diff = Math.round((dayStart(d) - dayStart(now)) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  return null
}

const STATUS_META: Record<string, { label: string; dark: { bg: string; fg: string }; light: { bg: string; fg: string } }> = {
  confirmado: { label: 'Confirmado', dark: { bg: 'rgba(74,175,120,0.16)', fg: '#7FD9A3' }, light: { bg: '#ECFDF5', fg: '#047857' } },
  pendiente:  { label: 'Pendiente',  dark: { bg: 'rgba(217,150,60,0.16)', fg: '#F0BE7C' }, light: { bg: '#FFFBEB', fg: '#B45309' } },
}

const IDLE_SECONDS = 60

export function TotemPage() {
  const { slug }   = useParams<{ slug: string }>()
  const navigate   = useNavigate()

  const [view, setView]               = useState<View>('home')
  const [org, setOrg]                 = useState<OrgInfo | null>(null)
  const [dni, setDni]                 = useState('')
  const [searching, setSearching]     = useState(false)
  const [appts, setAppts]             = useState<ApptResult[]>([])
  const [selected, setSelected]       = useState<ApptResult | null>(null)
  const [cancelling, setCancelling]   = useState(false)
  const [doneOk, setDoneOk]           = useState(true)
  const [doneMsg, setDoneMsg]         = useState('')
  const [countdown, setCountdown]     = useState(8)
  const [error, setError]             = useState('')
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cargar org
  useEffect(() => {
    if (!slug) return
    supabase.from('organizations').select('name, primary_color, tenant_type')
      .eq('slug', slug).eq('active', true).single()
      .then(({ data }) => { if (data) setOrg(data as OrgInfo) })
  }, [slug])

  // Reset por inactividad (excepto en home y done)
  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    if (view === 'home' || view === 'done') return
    idleTimer.current = setTimeout(() => resetToHome(), IDLE_SECONDS * 1000)
  }, [view])

  useEffect(() => { resetIdle() }, [resetIdle])
  useEffect(() => () => { if (idleTimer.current) clearTimeout(idleTimer.current) }, [])

  // Countdown al terminar
  useEffect(() => {
    if (view !== 'done') return
    setCountdown(8)
    const iv = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(iv); resetToHome(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [view])

  const resetToHome = useCallback(() => {
    setView('home'); setDni(''); setAppts([])
    setSelected(null); setError(''); setDoneMsg('')
  }, [])

  const handleSearch = async () => {
    if (!dni.trim() || !slug) return
    setSearching(true); setError('')
    const { data, error: err } = await supabase.rpc('buscar_turnos_totem', {
      p_dni: dni.trim(), p_org_slug: slug,
    })
    setSearching(false)
    if (err) { setError('Ocurrio un error. Intenta de nuevo.'); return }
    setAppts((data ?? []) as ApptResult[])
    setView('results')
  }

  const handleConfirmCancel = async () => {
    if (!selected) return
    setCancelling(true)
    const { data } = await supabase.rpc('cancelar_turno_totem', {
      p_appointment_id: selected.id,
      p_dni: dni.trim(),
    })
    setCancelling(false)
    setDoneOk(!!data)
    setDoneMsg(data
      ? 'Tu turno fue cancelado correctamente.'
      : 'No se pudo cancelar. Por favor consulta en recepcion.')
    setView('done')
  }

  const isDark     = !!org?.tenant_type && PREMIUM_TENANT_TYPES.includes(org.tenant_type)
  const accent     = org?.primary_color ?? (isDark ? '#C9A96E' : '#0284c7')
  const usePhone   = !!org?.tenant_type && !['medical', 'veterinary'].includes(org.tenant_type)
  const fieldLabel = usePhone ? 'Ingresa tu celular' : 'Ingresa tu DNI'
  const fieldMax   = usePhone ? 13 : 8

  // Teclado numerico virtual
  const numpad = ['1','2','3','4','5','6','7','8','9','←','0','✓']

  const handleKey = (k: string) => {
    resetIdle()
    if (k === '←') { setDni(prev => prev.slice(0,-1)); return }
    if (k === '✓') { handleSearch(); return }
    if (dni.length < fieldMax) setDni(prev => prev + k)
  }

  // ─────────── HOME ───────────
  if (view === 'home') return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: isDark ? DARK : '#F8FAFC' }}>
      <style>{`
        .totem-home-btn { transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease; }
        .totem-home-btn.is-dark:hover { transform: translateY(-3px); border-color: ${accent}55; box-shadow: 0 12px 28px rgba(0,0,0,0.35); }
        .totem-home-btn.is-light:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(15,23,42,0.10); border-color: ${accent}45; }
        .totem-home-btn:active { transform: translateY(-1px) scale(0.99); }
      `}</style>

      <header className="py-5 px-6 text-center" style={{ borderBottom: `1px solid ${isDark ? T_BORDER : '#F1F5F9'}` }}>
        <span style={{ fontFamily: SANS, fontSize: '13px', fontWeight: 500, color: isDark ? T_TEXT_SEC : '#6B7280' }}>
          {org?.name ?? '...'}
        </span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
        <div className="text-center">
          <h1 style={{
            fontFamily: isDark ? SERIF : 'inherit', fontStyle: isDark ? 'italic' : 'normal',
            fontWeight: isDark ? 400 : 700, fontSize: isDark ? '30px' : '26px',
            color: isDark ? T_TEXT_PRI : '#111827', margin: '0 0 8px',
          }}>
            Bienvenido
          </h1>
          <p style={{ fontFamily: SANS, fontSize: '14px', color: isDark ? T_TEXT_SEC : '#6B7280', margin: 0 }}>
            Seleccioná una opción para continuar
          </p>
        </div>

        <button
          onClick={() => navigate(`/${slug}`)}
          className={`totem-home-btn ${isDark ? 'is-dark' : 'is-light'} w-full flex items-center gap-4 text-left`}
          style={{
            maxWidth: '380px', borderRadius: '24px', padding: '26px', cursor: 'pointer',
            backgroundColor: isDark ? T_CARD : '#FFFFFF',
            border: `1px solid ${isDark ? T_BORDER : '#F1F5F9'}`,
          }}
        >
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: `${accent}16`,
          }}>
            <Calendar size={26} style={{ color: accent }} />
          </div>
          <div>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: '17px', color: isDark ? T_TEXT_PRI : '#111827' }}>
              Sacar turno
            </div>
            <div style={{ fontFamily: SANS, fontSize: '13px', color: isDark ? T_TEXT_SEC : '#6B7280', marginTop: '2px' }}>
              Reservá tu próximo turno
            </div>
          </div>
          <ChevronRight size={20} style={{ marginLeft: 'auto', color: isDark ? T_TEXT_MUT : '#D1D5DB', flexShrink: 0 }} />
        </button>

        <button
          onClick={() => { setView('lookup'); setDni(''); setError('') }}
          className={`totem-home-btn ${isDark ? 'is-dark' : 'is-light'} w-full flex items-center gap-4 text-left`}
          style={{
            maxWidth: '380px', borderRadius: '24px', padding: '26px', cursor: 'pointer',
            backgroundColor: isDark ? T_CARD : '#FFFFFF',
            border: `1px solid ${isDark ? T_BORDER : '#F1F5F9'}`,
          }}
        >
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: isDark ? T_CARD2 : '#F8FAFC',
          }}>
            <Search size={24} style={{ color: isDark ? T_TEXT_SEC : '#6B7280' }} />
          </div>
          <div>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: '17px', color: isDark ? T_TEXT_PRI : '#111827' }}>
              Ver / Cancelar turno
            </div>
            <div style={{ fontFamily: SANS, fontSize: '13px', color: isDark ? T_TEXT_SEC : '#6B7280', marginTop: '2px' }}>
              Consultá o cancelá por {usePhone ? 'celular' : 'DNI'}
            </div>
          </div>
          <ChevronRight size={20} style={{ marginLeft: 'auto', color: isDark ? T_TEXT_MUT : '#D1D5DB', flexShrink: 0 }} />
        </button>
      </main>
    </div>
  )

  // ─────────── LOOKUP ───────────
  if (view === 'lookup') return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: isDark ? DARK : '#F8FAFC' }} onClick={resetIdle}>
      <header className="py-4 px-5 flex items-center gap-3" style={{ borderBottom: `1px solid ${isDark ? T_BORDER : '#F1F5F9'}` }}>
        <button onClick={resetToHome} className="p-2 rounded-xl"
          style={{ backgroundColor: isDark ? T_CARD2 : '#F3F4F6', color: isDark ? T_TEXT_SEC : '#6B7280' }}>
          <X className="w-5 h-5" />
        </button>
        <span style={{ fontFamily: SANS, fontSize: '14px', fontWeight: 500, color: isDark ? T_TEXT_SEC : '#6B7280' }}>
          Buscar mis turnos
        </span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
        <div style={{
          width: '100%', maxWidth: '380px', borderRadius: '24px', padding: '24px',
          backgroundColor: isDark ? T_CARD : '#FFFFFF', border: `1px solid ${isDark ? T_BORDER : '#F1F5F9'}`,
        }}>
          <label style={{
            fontFamily: SANS, fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '10px',
            color: isDark ? T_TEXT_SEC : '#6B7280',
          }}>
            {fieldLabel}
          </label>
          <div style={{
            fontFamily: SANS, fontSize: '32px', fontWeight: 700, textAlign: 'center', letterSpacing: '0.08em',
            color: isDark ? T_TEXT_PRI : '#111827',
            backgroundColor: isDark ? T_CARD2 : '#F8FAFC',
            borderRadius: '16px', padding: '18px 0', minHeight: '4rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {dni || <span style={{ color: isDark ? T_TEXT_MUT : '#D1D5DB' }}>{Array.from({ length: fieldMax }).map(() => '_').join(' ')}</span>}
          </div>

          {error && (
            <div style={{
              fontFamily: SANS, fontSize: '13px', textAlign: 'center', marginTop: '14px', padding: '10px 16px', borderRadius: '12px',
              backgroundColor: isDark ? 'rgba(220,38,38,0.14)' : '#FEF2F2', color: isDark ? '#F87171' : '#DC2626',
            }}>
              {error}
            </div>
          )}

          {/* Teclado numerico */}
          <div className="grid grid-cols-3 gap-3" style={{ marginTop: '18px' }}>
            {numpad.map(k => (
              <button
                key={k}
                onClick={() => handleKey(k)}
                disabled={k === '✓' && (!dni.trim() || searching)}
                className="transition-transform active:scale-95"
                style={{
                  fontFamily: SANS, borderRadius: '16px', padding: '16px 0', fontSize: '19px', fontWeight: 600,
                  cursor: 'pointer', border: 'none',
                  backgroundColor: k === '✓' ? accent : (isDark ? T_CARD2 : '#F8FAFC'),
                  color: k === '✓' ? (isDark ? '#0B0B0B' : '#FFFFFF') : (isDark ? T_TEXT_PRI : '#111827'),
                  opacity: k === '✓' && (!dni.trim() || searching) ? 0.5 : 1,
                }}
              >
                {k === '✓' ? (searching ? '...' : 'Buscar') : k}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )

  // ─────────── RESULTS ───────────
  if (view === 'results') {
    const count = appts.length

    // ── Estado vacío (compartido, con variante de color) ──────────────────
    const emptyState = (
      <div style={{
        borderRadius: '28px', padding: '48px 32px', textAlign: 'center',
        backgroundColor: isDark ? T_CARD : '#FFFFFF',
        border: `1px solid ${isDark ? T_BORDER : '#F1F5F9'}`,
      }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%', margin: '0 auto 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: isDark ? T_CARD2 : `${accent}12`,
        }}>
          <CalendarOff size={30} style={{ color: isDark ? T_TEXT_SEC : accent }} />
        </div>
        <p style={{
          fontFamily: isDark ? SERIF : 'inherit', fontStyle: isDark ? 'italic' : 'normal',
          fontSize: '19px', fontWeight: isDark ? 400 : 600,
          color: isDark ? T_TEXT_PRI : '#111827', margin: '0 0 8px',
        }}>
          No encontramos turnos asociados a este número
        </p>
        <p style={{ fontFamily: SANS, fontSize: '13px', color: isDark ? T_TEXT_SEC : '#6B7280', margin: '0 0 28px' }}>
          Revisá que el número esté bien escrito, o reservá un turno nuevo.
        </p>
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => navigate(`/${slug}`)}
            style={{
              fontFamily: SANS, fontWeight: 600, fontSize: '14px', width: '100%', maxWidth: '280px',
              padding: '14px', borderRadius: '14px', border: 'none', cursor: 'pointer',
              backgroundColor: accent, color: isDark ? '#0B0B0B' : '#FFFFFF',
            }}
          >
            Reservar un turno
          </button>
          <button
            onClick={() => { setView('lookup'); setDni('') }}
            style={{
              fontFamily: SANS, fontWeight: 500, fontSize: '13px', background: 'none', border: 'none',
              cursor: 'pointer', color: isDark ? T_TEXT_SEC : '#6B7280', textDecoration: 'underline',
            }}
          >
            Buscar nuevamente
          </button>
        </div>
      </div>
    )

    // ── Tema oscuro ─────────────────────────────────────────────────────────
    if (isDark) return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: DARK }} onClick={resetIdle}>
        <style>{`
          .totem-card-dark { transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease; }
          .totem-card-dark:hover { transform: translateY(-3px); border-color: ${accent}55; box-shadow: 0 12px 28px rgba(0,0,0,0.35); }
          .totem-card-dark:active { transform: translateY(-1px) scale(0.99); }
        `}</style>

        <header className="py-4 px-5 flex items-center gap-3" style={{ borderBottom: `1px solid ${T_BORDER}` }}>
          <button onClick={() => setView('lookup')}
            className="p-2 rounded-xl"
            style={{ backgroundColor: T_CARD2, color: T_TEXT_SEC }}>
            <X className="w-5 h-5" />
          </button>
          <span style={{ fontFamily: SANS, fontSize: '14px', fontWeight: 500, color: T_TEXT_SEC }}>{org?.name}</span>
        </header>

        <main className="flex-1 p-6 max-w-lg mx-auto w-full">
          <div style={{ marginBottom: '28px' }}>
            <h1 style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: '28px', color: T_TEXT_PRI, margin: '0 0 8px' }}>
              Tus reservas
            </h1>
            <p style={{ fontFamily: SANS, fontSize: '13px', color: T_TEXT_SEC, margin: 0 }}>
              {count > 0
                ? `Encontramos ${count} ${count === 1 ? 'turno asociado' : 'turnos asociados'} a tu número. Seleccioná uno para ver el detalle o gestionarlo.`
                : 'Gestioná tus próximas reservas desde acá.'}
            </p>
          </div>

          {count === 0 ? emptyState : (
            <div className="space-y-3">
              {appts.map(a => {
                const dayBadge = getDayBadge(a.starts_at)
                const statusMeta = STATUS_META[a.status]
                const d = toArgDate(a.starts_at)
                return (
                  <div key={a.id} onClick={() => { setSelected(a); setView('cancel-confirm') }}
                    className="totem-card-dark"
                    style={{
                      backgroundColor: T_CARD, border: `1px solid ${T_BORDER}`, borderRadius: '20px',
                      padding: '18px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer',
                    }}>
                    {/* Fecha destacada */}
                    <div style={{
                      flexShrink: 0, width: '60px', borderRadius: '14px', padding: '10px 0',
                      backgroundColor: `${accent}14`, border: `1px solid ${accent}30`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                    }}>
                      <span style={{ fontFamily: SERIF, fontSize: '22px', fontWeight: 600, color: T_TEXT_PRI, lineHeight: 1 }}>
                        {format(d, 'd')}
                      </span>
                      <span style={{ fontFamily: SANS, fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', color: accent, marginTop: '3px' }}>
                        {format(d, 'MMM', { locale: es }).replace('.', '').toUpperCase()}
                      </span>
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: a.service_color ?? accent, flexShrink: 0 }} />
                        <span style={{ fontFamily: SANS, fontSize: '15px', fontWeight: 600, color: T_TEXT_PRI, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.service_name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                        <User size={12} style={{ color: T_TEXT_MUT }} />
                        <span style={{ fontFamily: SANS, fontSize: '12.5px', color: T_TEXT_SEC }}>Con {a.professional_name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontFamily: SANS, fontSize: '11px', fontWeight: 500, padding: '3px 9px', borderRadius: '999px',
                          backgroundColor: T_CARD2, color: T_TEXT_SEC, border: `1px solid ${T_BORDER2}`,
                        }}>
                          {toArgTime(a.starts_at)}hs
                        </span>
                        {dayBadge && (
                          <span style={{
                            fontFamily: SANS, fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '999px',
                            backgroundColor: `${accent}18`, color: accent,
                          }}>
                            {dayBadge}
                          </span>
                        )}
                        {statusMeta && (
                          <span style={{
                            fontFamily: SANS, fontSize: '11px', fontWeight: 500, padding: '3px 9px', borderRadius: '999px',
                            backgroundColor: statusMeta.dark.bg, color: statusMeta.dark.fg,
                          }}>
                            {statusMeta.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Acción */}
                    <div style={{
                      flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px',
                      borderRadius: '999px', backgroundColor: `${accent}12`, color: accent,
                    }}>
                      <span style={{ fontFamily: SANS, fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>Gestionar</span>
                      <ArrowRight size={13} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    )

    // ── Tema claro ────────────────────────────────────────────────────────
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }} onClick={resetIdle}>
        <style>{`
          .totem-card-light { transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease; }
          .totem-card-light:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(15,23,42,0.10); border-color: ${accent}45; }
          .totem-card-light:active { transform: translateY(-1px) scale(0.99); }
        `}</style>

        <header className="py-4 px-5 flex items-center gap-3 bg-white" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <button onClick={() => setView('lookup')} className="p-2 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200">
            <X className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-gray-500">{org?.name}</span>
        </header>

        <main className="flex-1 p-6 max-w-lg mx-auto w-full">
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-gray-900 mb-1.5">Tus reservas</h1>
            <p className="text-sm text-gray-500">
              {count > 0
                ? `Encontramos ${count} ${count === 1 ? 'turno asociado' : 'turnos asociados'} a tu número. Seleccioná uno para ver el detalle o gestionarlo.`
                : 'Gestioná tus próximas reservas desde acá.'}
            </p>
          </div>

          {count === 0 ? emptyState : (
            <div className="space-y-3">
              {appts.map(a => {
                const dayBadge = getDayBadge(a.starts_at)
                const statusMeta = STATUS_META[a.status]
                const d = toArgDate(a.starts_at)
                return (
                  <div key={a.id} onClick={() => { setSelected(a); setView('cancel-confirm') }}
                    className="totem-card-light bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 p-4 cursor-pointer">
                    <div className="flex-shrink-0 w-[60px] rounded-xl py-2.5 flex flex-col items-center"
                      style={{ backgroundColor: `${accent}10`, border: `1px solid ${accent}28` }}>
                      <span className="text-xl font-bold text-gray-900 leading-none">{format(d, 'd')}</span>
                      <span className="text-[10px] font-semibold tracking-wide mt-1" style={{ color: accent }}>
                        {format(d, 'MMM', { locale: es }).replace('.', '').toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ backgroundColor: a.service_color ?? accent }} />
                        <span className="text-[15px] font-semibold text-gray-900 truncate">{a.service_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <User size={12} className="text-gray-400" />
                        <span className="text-[12.5px] text-gray-500">Con {a.professional_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                        <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                          {toArgTime(a.starts_at)}hs
                        </span>
                        {dayBadge && (
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${accent}15`, color: accent }}>
                            {dayBadge}
                          </span>
                        )}
                        {statusMeta && (
                          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: statusMeta.light.bg, color: statusMeta.light.fg }}>
                            {statusMeta.label}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-full" style={{ backgroundColor: `${accent}10`, color: accent }}>
                      <span className="text-xs font-semibold whitespace-nowrap">Gestionar</span>
                      <ArrowRight size={13} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    )
  }

  // ─────────── CANCEL CONFIRM ───────────
  if (view === 'cancel-confirm' && selected) {
    const d = toArgDate(selected.starts_at)
    return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: isDark ? DARK : '#F8FAFC' }} onClick={resetIdle}>
      <header className="py-4 px-5 flex items-center gap-3" style={isDark ? { borderBottom: `1px solid ${T_BORDER}` } : { borderBottom: '1px solid #F1F5F9', backgroundColor: '#fff' }}>
        <button onClick={() => setView('results')} className="p-2 rounded-xl"
          style={isDark ? { backgroundColor: T_CARD2, color: T_TEXT_SEC } : { backgroundColor: '#F3F4F6', color: '#6B7280' }}>
          <X className="w-5 h-5" />
        </button>
        <span style={{ fontFamily: SANS, fontSize: '14px', fontWeight: 500, color: isDark ? T_TEXT_SEC : '#6B7280' }}>Gestionar turno</span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div style={{
          borderRadius: '24px', padding: '32px', maxWidth: '380px', width: '100%', textAlign: 'center',
          backgroundColor: isDark ? T_CARD : '#FFFFFF', border: `1px solid ${isDark ? T_BORDER : '#F1F5F9'}`,
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: isDark ? `${accent}14` : `${accent}10`,
          }}>
            <span style={{ fontFamily: SERIF, fontSize: '20px', fontWeight: 600, color: isDark ? T_TEXT_PRI : '#111827' }}>{format(d, 'd')}</span>
          </div>
          <p style={{ fontFamily: SANS, fontSize: '16px', fontWeight: 600, color: isDark ? T_TEXT_PRI : '#111827', margin: '0 0 4px' }}>
            {capitalize(format(d, "EEEE d 'de' MMMM", { locale: es }))}
          </p>
          <p style={{ fontFamily: SANS, fontSize: '13px', color: isDark ? T_TEXT_SEC : '#6B7280', margin: '0 0 14px' }}>
            {toArgTime(selected.starts_at)}hs · {selected.service_name} con {selected.professional_name}
          </p>
          <p style={{ fontFamily: SANS, fontSize: '13px', color: isDark ? T_TEXT_SEC : '#9CA3AF', margin: '0 0 22px' }}>
            ¿Confirmás que querés cancelar este turno?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setView('results')}
              style={{
                fontFamily: SANS, fontWeight: 600, fontSize: '13px', padding: '14px', borderRadius: '14px', cursor: 'pointer',
                backgroundColor: 'transparent', border: `1px solid ${isDark ? T_BORDER2 : '#E5E7EB'}`, color: isDark ? T_TEXT_SEC : '#6B7280',
              }}
            >
              Volver
            </button>
            <button
              onClick={handleConfirmCancel}
              disabled={cancelling}
              style={{
                fontFamily: SANS, fontWeight: 600, fontSize: '13px', padding: '14px', borderRadius: '14px', cursor: cancelling ? 'default' : 'pointer',
                backgroundColor: '#DC2626', border: 'none', color: '#fff', opacity: cancelling ? 0.6 : 1,
              }}
            >
              {cancelling ? 'Cancelando...' : 'Sí, cancelar'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )}

  // ─────────── DONE ───────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: isDark ? DARK : '#F8FAFC' }}>
      <div style={{
        borderRadius: '24px', padding: '40px 32px', maxWidth: '380px', width: '100%', textAlign: 'center',
        backgroundColor: isDark ? T_CARD : '#FFFFFF', border: `1px solid ${isDark ? T_BORDER : '#F1F5F9'}`,
      }}>
        {doneOk
          ? <CheckCircle className="w-14 h-14 mx-auto" style={{ color: isDark ? '#7FD9A3' : '#22C55E' }} />
          : <XCircle    className="w-14 h-14 mx-auto" style={{ color: isDark ? '#F0BE7C' : '#F87171' }} />
        }
        <p style={{ fontFamily: SANS, fontWeight: 700, fontSize: '19px', color: isDark ? T_TEXT_PRI : '#111827', margin: '16px 0 6px' }}>
          {doneOk ? '¡Listo!' : 'Algo salió mal'}
        </p>
        <p style={{ fontFamily: SANS, fontSize: '13.5px', color: isDark ? T_TEXT_SEC : '#6B7280', margin: '0 0 24px' }}>{doneMsg}</p>
        <button
          onClick={resetToHome}
          style={{
            width: '100%', padding: '14px', borderRadius: '14px', border: 'none', cursor: 'pointer',
            fontFamily: SANS, fontWeight: 600, fontSize: '13.5px',
            backgroundColor: accent, color: isDark ? '#0B0B0B' : '#FFFFFF',
          }}
        >
          Volver al inicio ({countdown}s)
        </button>
      </div>
    </div>
  )
}
