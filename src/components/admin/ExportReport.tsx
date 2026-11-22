import { useEffect, useState } from 'react'
import { FileDown, Mail, CalendarRange, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Props {
  organizationId: string | null
  role?: string
  isSuperAdmin?: boolean
  userEmail?: string
}

const TIPOS = [
  { value: 'general',            label: 'Resumen general (todo)' },
  { value: 'servicios',          label: 'Servicios más utilizados' },
  { value: 'prof_atendidos',     label: 'Profesionales con más pacientes atendidos' },
  { value: 'prof_cancelaciones', label: 'Profesionales con más cancelaciones' },
  { value: 'prof_ausencias',     label: 'Profesionales con más ausencias' },
]

const PRESETS = [7, 30, 90]

export function ExportReport({ organizationId, isSuperAdmin = false, userEmail = '' }: Props) {
  const [tipo, setTipo]       = useState('general')
  const [days, setDays]       = useState(7)
  const [email, setEmail]     = useState(userEmail)
  const [orgId, setOrgId]     = useState(organizationId ?? '')
  const [orgs, setOrgs]       = useState<{ id: string; name: string }[]>([])
  const [sending, setSending] = useState(false)
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => { setEmail(userEmail) }, [userEmail])

  // Superadmin: puede elegir el centro
  useEffect(() => {
    if (!isSuperAdmin) return
    supabase.from('organizations').select('id, name').eq('active', true).order('name')
      .then(({ data }) => {
        setOrgs(data ?? [])
        if (data && data.length && !orgId) setOrgId(data[0].id)
      })
  }, [isSuperAdmin])

  const enviar = async () => {
    setMsg(null)
    if (!email.trim()) { setMsg({ ok: false, text: 'Ingresá un mail de destino.' }); return }
    if (!days || days < 1) { setMsg({ ok: false, text: 'La cantidad de días tiene que ser 1 o más.' }); return }
    setSending(true)
    const body: Record<string, unknown> = { report_type: tipo, days, email: email.trim() }
    if (isSuperAdmin && orgId) body.org_id = orgId
    const { data, error } = await supabase.functions.invoke('weekly-report', { body })
    setSending(false)
    if (error || (data as any)?.error) {
      setMsg({ ok: false, text: (data as any)?.error ?? error?.message ?? 'No se pudo enviar el reporte.' })
      return
    }
    setMsg({ ok: true, text: `Reporte enviado a ${email.trim()}. Revisá la casilla en un minuto.` })
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
            <FileDown className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">Exportar reporte</h2>
            <p className="text-sm text-gray-500">Elegí el tipo, el período y a qué mail te llega.</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de reporte</label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Centro (solo superadmin) */}
          {isSuperAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Centro</label>
              <select
                value={orgId}
                onChange={e => setOrgId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}

          {/* Días */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
              <CalendarRange className="w-4 h-4 text-gray-400" /> Período (últimos días)
            </label>
            <div className="flex items-center gap-2">
              {PRESETS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDays(p)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    days === p
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p} días
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={e => setDays(Number(e.target.value))}
                className="w-24 px-3 py-2 rounded-xl border border-gray-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-sky-500"
                aria-label="Cantidad de días"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-gray-400" /> Enviar a
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {msg && (
            <div className={`flex items-start gap-2 text-sm px-4 py-3 rounded-xl ${
              msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}>
              {msg.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              <span>{msg.text}</span>
            </div>
          )}

          <button
            onClick={enviar}
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : <><FileDown className="w-4 h-4" /> Enviar reporte</>}
          </button>
        </div>
      </div>
    </div>
  )
}
