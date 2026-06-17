import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) throw new Error('Unauthorized')

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role, organization_id')
      .eq('id', caller.id)
      .single()

    if (!callerProfile || !['admin', 'superadmin'].includes(callerProfile.role)) {
      throw new Error('Forbidden: solo admins pueden crear usuarios')
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    )

    const { email, password, full_name, role, professional_id, organization_id } = await req.json()

    if (!email || !password || !role) {
      throw new Error('email, password y role son requeridos')
    }

    // Determinar org: si viene en el body usarla; si no y es medico, derivar del profesional;
    // si el caller no es superadmin, forzar su propia org
    let orgId: string | null = organization_id ?? null

    if (professional_id && !orgId) {
      const { data: prof } = await adminClient
        .from('professionals')
        .select('organization_id')
        .eq('id', professional_id)
        .single()
      orgId = prof?.organization_id ?? null
    }

    // Admin (no superadmin) solo puede crear usuarios en su propia org
    if (callerProfile.role === 'admin') {
      orgId = callerProfile.organization_id
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    })

    if (createError) throw createError
    if (!newUser.user) throw new Error('No se pudo crear el usuario')

    // Actualizar profile con full_name, organization_id y professional_id
    const profileUpdate: Record<string, unknown> = { full_name, role }
    if (orgId) profileUpdate.organization_id = orgId
    if (professional_id) profileUpdate.professional_id = professional_id

    await adminClient
      .from('profiles')
      .update(profileUpdate)
      .eq('id', newUser.user.id)

    // Vincular professional.user_id
    if (professional_id) {
      await adminClient
        .from('professionals')
        .update({ user_id: newUser.user.id })
        .eq('id', professional_id)
    }

    return new Response(
      JSON.stringify({ id: newUser.user.id, email, role }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error(err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
