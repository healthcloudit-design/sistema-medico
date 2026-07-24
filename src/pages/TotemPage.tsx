import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Calendar, Search, X, CheckCircle, XCircle, ChevronRight, Clock, User, Scissors } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
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
}

function toArgTime(iso: string) {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d  = new Date(ms)
  return `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')}`
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

  const accent = org?.primary_color ?? '#0284c7'
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
    <div className="min-h-screen flex flex-col" style={{ background: '#f8fafc' }}>
      <header className="py-8 px-6 text-center text-white" style={{ background: accent }}>
        <div className="text-3xl font-bold tracking-tight">{org?.name ?? '...'}</div>
        <div className="text-sm opacity-80 mt-1">Sistema de turnos</div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
        <p className="text-gray-500 text-lg">Selecciona una opcion</p>

        <button
          onClick={() => navigate(`/${slug}`)}
          className="w-full max-w-sm flex items-center gap-5 rounded-3xl shadow-lg p-7 text-white text-xl font-bold transition-transform active:scale-95"
          style={{ background: accent }}
        >
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Calendar className="w-7 h-7" />
          </div>
          <div className="text-left">
            <div>Sacar turno</div>
            <div className="text-sm font-normal opacity-80 mt-0.5">Reserva tu proximo turno</div>
          </div>
          <ChevronRight className="w-6 h-6 ml-auto opacity-70" />
        </button>

        <button
          onClick={() => { setView('lookup'); setDni(''); setError('') }}
          className="w-full max-w-sm flex items-center gap-5 rounded-3xl shadow-md p-7 bg-white border-2 border-gray-200 text-gray-800 text-xl font-bold transition-transform active:scale-95"
        >
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Search className="w-7 h-7 text-gray-500" />
          </div>
          <div className="text-left">
            <div>Ver / Cancelar turno</div>
            <div className="text-sm font-normal text-gray-400 mt-0.5">Consulta o cancela por {usePhone ? 'celular' : 'DNI'}</div>
          </div>
          <ChevronRight className="w-6 h-6 ml-auto text-gray-300" />
        </button>
      </main>
    </div>
  )

  // ─────────── LOOKUP ───────────
  if (view === 'lookup') return (
    <div className="min-h-screen flex flex-col bg-gray-50" onClick={resetIdle}>
      <header className="py-5 px-6 flex items-center gap-3 text-white" style={{ background: accent }}>
        <button onClick={resetToHome} className="p-2 rounded-xl bg-white/20 hover:bg-white/30">
          <X className="w-5 h-5" />
        </button>
        <span className="font-semibold text-lg">Buscar mis turnos</span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-md p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">{fieldLabel}</label>
            <div className="text-4xl font-mono font-bold text-center tracking-widest text-gray-900 bg-gray-50 rounded-2xl py-4 min-h-[4rem] flex items-center justify-center">
              {dni || <span className="text-gray-300">{Array.from({ length: fieldMax }).map(() => '_').join(' ')}</span>}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl text-center">{error}</div>
          )}

          {/* Teclado numerico */}
          <div className="grid grid-cols-3 gap-3">
            {numpad.map(k => (
              <button
                key={k}
                onClick={() => handleKey(k)}
                disabled={k === '✓' && (!dni.trim() || searching)}
                className={[
                  'rounded-2xl py-4 text-xl font-semibold transition-all active:scale-95',
                  k === '✓'
                    ? 'text-white col-span-1'
                    : k === '←'
                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200',
                ].join(' ')}
                style={k === '✓' ? { background: accent } : {}}
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
  if (view === 'results') return (
    <div className="min-h-screen flex flex-col bg-gray-50" onClick={resetIdle}>
      <header className="py-5 px-6 flex items-center gap-3 text-white" style={{ background: accent }}>
        <button onClick={() => setView('lookup')} className="p-2 rounded-xl bg-white/20 hover:bg-white/30">
          <X className="w-5 h-5" />
        </button>
        <span className="font-semibold text-lg">Tus proximos turnos</span>
      </header>

      <main className="flex-1 p-6 space-y-4 max-w-lg mx-auto w-full">
        {appts.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm p-10 text-center">
            <Search className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <div className="text-gray-500 font-medium">No encontramos turnos proximos</div>
            <div className="text-gray-400 text-sm mt-1">para el {usePhone ? 'celular' : 'DNI'} {dni}</div>
            <button
              onClick={() => setView('lookup')}
              className="mt-5 px-6 py-3 rounded-2xl text-white font-semibold text-sm"
              style={{ background: accent }}
            >
              Intentar de nuevo
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-400 text-center">Toca un turno para cancelarlo</p>
            {appts.map(a => (
              <div
                key={a.id}
                onClick={() => { setSelected(a); setView('cancel-confirm') }}
                className="bg-white rounded-3xl shadow-sm p-5 flex items-center gap-4 cursor-pointer active:scale-95 transition-transform"
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${accent}18` }}>
                  <Calendar className="w-6 h-6" style={{ color: accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">
                    {format(parseISO(a.starts_at.slice(0,10)), "EEEE d 'de' MMMM", { locale: es })}
                    {' — '}{toArgTime(a.starts_at)}hs
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-2 mt-0.5">
                    <Scissors className="w-3.5 h-3.5" /> {a.service_name}
                    <User className="w-3.5 h-3.5 ml-1" /> {a.professional_name}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  )

  // ─────────── CANCEL CONFIRM ───────────
  if (view === 'cancel-confirm' && selected) return (
    <div className="min-h-screen flex flex-col bg-gray-50" onClick={resetIdle}>
      <header className="py-5 px-6 flex items-center gap-3 text-white" style={{ background: accent }}>
        <button onClick={() => setView('results')} className="p-2 rounded-xl bg-white/20 hover:bg-white/30">
          <X className="w-5 h-5" />
        </button>
        <span className="font-semibold text-lg">Cancelar turno</span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-md p-8 max-w-sm w-full space-y-5 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-lg">Confirmar cancelacion</div>
            <div className="text-gray-500 text-sm mt-1">
              {format(parseISO(selected.starts_at.slice(0,10)), "EEEE d 'de' MMMM", { locale: es })}
              {' — '}{toArgTime(selected.starts_at)}hs
            </div>
            <div className="text-gray-500 text-sm">{selected.service_name} con {selected.professional_name}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setView('results')}
              className="py-4 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 active:scale-95 transition-transform"
            >
              Volver
            </button>
            <button
              onClick={handleConfirmCancel}
              disabled={cancelling}
              className="py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50"
            >
              {cancelling ? 'Cancelando...' : 'Si, cancelar'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )

  // ─────────── DONE ───────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-3xl shadow-md p-10 max-w-sm w-full text-center space-y-5">
        {doneOk
          ? <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          : <XCircle    className="w-16 h-16 text-red-400 mx-auto" />
        }
        <div className="font-bold text-xl text-gray-900">{doneOk ? 'Listo!' : 'Algo salio mal'}</div>
        <div className="text-gray-500">{doneMsg}</div>
        <button
          onClick={resetToHome}
          className="w-full py-4 rounded-2xl text-white font-semibold"
          style={{ background: accent }}
        >
          Volver al inicio ({countdown}s)
        </button>
      </div>
    </div>
  )
}
