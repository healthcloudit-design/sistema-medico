import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface OrgFeatures {
  featureMp: boolean
  featureHc: boolean
  loading: boolean
}

const cache: Record<string, { featureMp: boolean; featureHc: boolean }> = {}

export function useOrgFeatures(organizationId: string | null | undefined): OrgFeatures {
  const [featureMp, setFeatureMp] = useState(false)
  const [featureHc, setFeatureHc] = useState(false)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!organizationId) {
      setLoading(false)
      return
    }

    // Serve from cache to avoid extra round-trips
    if (cache[organizationId]) {
      setFeatureMp(cache[organizationId].featureMp)
      setFeatureHc(cache[organizationId].featureHc)
      setLoading(false)
      return
    }

    supabase
      .from('organizations')
      .select('feature_mp, feature_hc')
      .eq('id', organizationId)
      .single()
      .then(({ data }) => {
        const mp = data?.feature_mp ?? false
        const hc = data?.feature_hc ?? false
        cache[organizationId] = { featureMp: mp, featureHc: hc }
        setFeatureMp(mp)
        setFeatureHc(hc)
        setLoading(false)
      })
  }, [organizationId])

  return { featureMp, featureHc, loading }
}
