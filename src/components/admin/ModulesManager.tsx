import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { CreditCard, FileText, Building2, CheckCircle2 } from 'lucide-react'
import type { TenantType } from '../../types'

interface OrgRow {
  id: string
  name: string
  slug: string
  active: boolean
  feature_mp: boolean
  feature_hc: boolean
  tenant_type: TenantType
}

const TENANT_OPTIONS: { value: TenantType; label: string; emoji: string }[] = [
  { value: 'medical',    label: 'Medico',           emoji: '🩺' },
  { value: 'beauty',     label: 'Beauty',           emoji: '✨' },
  { value: 'estetica',   label: 'Centro Estetico',  emoji: '💆' },
  { value: 'petshop',    label: 'Pet Shop',         emoji: '🐾' },
  { value: 'veterinary', label: 'Veterinaria',      emoji: '🐕' },
  { value: 'cancha',     label: 'Canchas',          emoji: '⚽' },
  { value: 'general',    label: 'General',          emoji: '🏢' },
]

export function ModulesManager() {
  const [orgs, setOrgs]       = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('organizations')
      .select('id, name, slug, active, feature_mp, feature_hc, tenant_type')
      .order('name')
      .then(({ data }) => {
        setOrgs((data ?? []) as OrgRow[])
        setLoading(false)
      })
  }, [])

  const changeTenantType = async (org: OrgRow, tenant_type: TenantType) => {
    setSaving(org.id + '-tenant_type')
    const { error } = await supabase.from('organizations').update({ tenant_type }).eq('id', org.id)
    if (!error) setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, tenant_type } : o))
    setSaving(null)
  }

  const toggle = async (org: OrgRow, field: 'feature_mp' | 'feature_hc') => {
    const next = !org[field]
    setSaving(org.id + '-' + field)
    const { error } = await supabase.from('organizations').update({ [field]: next }).eq('id', org.id)
    if (!error) setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, [field]: next } : o))
    setSaving(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Gestion de modulos</h1>
        <p className="text-sm text-gray-500 mt-1">Activa o desactiva modulos premium por organizacion.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-purple-50 rounded-2xl p-4 flex items-start gap-3">
          <CreditCard className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-purple-900">Modulo MercadoPago</div>
            <div className="text-xs text-purple-600 mt-0.5">Habilita el boton Pagar online en el flujo de reserva.</div>
          </div>
        </div>
        <div className="bg-teal-50 rounded-2xl p-4 flex items-start gap-3">
          <FileText className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-teal-900">Historia Clinica</div>
            <div className="text-xs text-teal-600 mt-0.5">Habilita Historia clinica en el dashboard del medico.</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <div>Organizacion</div>
          <div className="w-36 text-center">Tipo</div>
          <div className="w-32 text-center">MercadoPago</div>
          <div className="w-32 text-center">Hist. Clinica</div>
        </div>

        {orgs.length === 0 && (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">No hay organizaciones registradas.</div>
        )}

        {orgs.map(org => (
          <div key={org.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-4 border-b border-gray-50 last:border-0 items-center hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-sky-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-sky-600" />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-gray-900 text-sm truncate">{org.name}</div>
                <div className="text-xs text-gray-400">/{org.slug}</div>
              </div>
              {!org.active && (
                <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full flex-shrink-0">inactiva</span>
              )}
            </div>

            <div className="w-36 flex justify-center">
              {saving === (org.id + '-tenant_type') ? (
                <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              ) : (
                <select
                  value={org.tenant_type ?? 'medical'}
                  onChange={e => changeTenantType(org, e.target.value as TenantType)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer w-full"
                >
                  {TENANT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.emoji} {opt.label}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="w-32 flex justify-center">
              <Toggle enabled={org.feature_mp} loading={saving === (org.id + '-feature_mp')} onChange={() => toggle(org, 'feature_mp')} activeColor="bg-purple-600" />
            </div>

            <div className="w-32 flex justify-center">
              <Toggle enabled={org.feature_hc} loading={saving === (org.id + '-feature_hc')} onChange={() => toggle(org, 'feature_hc')} activeColor="bg-teal-600" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
        <span>Los cambios se aplican de forma inmediata.</span>
      </div>
    </div>
  )
}

function Toggle({ enabled, loading, onChange, activeColor }: {
  enabled: boolean; loading: boolean; onChange: () => void; activeColor: string
}) {
  if (loading) {
    return (
      <div className="w-11 h-6 flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  const baseClass = 'relative inline-flex items-center w-11 h-6 rounded-full transition-colors focus:outline-none'
  const colorClass = enabled ? activeColor : 'bg-gray-200'
  const knobBase = 'inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform'
  const knobPos = enabled ? 'translate-x-6' : 'translate-x-1'
  return (
    <button onClick={onChange} className={[baseClass, colorClass].join(' ')}>
      <span className={[knobBase, knobPos].join(' ')} />
    </button>
  )
}
