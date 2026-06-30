import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface OrgFeatures {
  featureMp:   boolean
  featureModo: boolean
  featureHc:   boolean
  modoQr:      string | null
  loading:     boolean
}

const cache: Record<string, Omit<OrgFeatures, 'loading'>> = {}

export function useOrgFeatures(organizationId: string | null | undefined): OrgFeatures {
  const [data, setData] = useState<Omit<OrgFeatures, 'loading'>>({
    featureMp: false, featureModo: false, featureHc: false, modoQr: null,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId) { setLoading(false); return }
    if (cache[organizationId]) { setData(cache[organizationId]); setLoading(false); return }

    supabase
      .from('organizations')
      .select('feature_mp, feature_hc, modo_qr_url')
      .eq('id', organizationId)
      .single()
      .then(({ data: row }) => {
        const result = {
          featureMp:   row?.feature_mp    ?? false,
          featureModo: !!(row?.modo_qr_url),
          featureHc:   row?.feature_hc    ?? false,
          modoQr:      row?.modo_qr_url   ?? null,
        }
        cache[organizationId] = result
        setData(result)
        setLoading(false)
      })
  }, [organizationId])

  return { ...data, loading }
}
