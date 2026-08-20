import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')
    if (!SERVICE_KEY) throw new Error('Config: falta la service role key en la funcion')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')

    const callerClient = createClient(
      SUPABASE_URL,
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

    if (!callerProfile) throw new Error('Forbidden')

    const isSuperadmin = callerProfile.role === 'superadmin'
    const isOrgAdmin = callerProfile.role === 'admin'

    if (!isSuperadmin && !isOrgAdmin) {
      throw new Error('Forbidden: no tenes permisos para resetear contrasenas')
    }

    const { user_id, new_password } = await req.json()
    if (!user_id || !new_password) throw new Error('user_id y new_password son requeridos')
    if (new_password.length < 6) throw new Error('La contrasena debe tener al menos 6 caracteres')

    // Un admin de organizacion solo puede resetear a usuarios de su propia organizacion,
    // y nunca a cuentas superadmin/globaladmin.
    if (!isSuperadmin) {
      const { data: targetProfile } = await callerClient
        .from('profiles')
        .select('id, role, organization_id')
        .eq('id', user_id)
        .single()

      if (!targetProfile || targetProfile.organization_id !== callerProfile.organization_id) {
        throw new Error('Forbidden: el usuario no pertenece a tu organizacion')
      }
      if (targetProfile.role === 'superadmin' || targetProfile.role === 'globaladmin') {
        throw new Error('Forbidden: no podes resetear la contrasena de un administrador global')
      }
    }

    // Llamada directa a la Admin API de GoTrue. Evita @supabase/auth-js admin client, que estaba
    // fallando con AuthRetryableFetchError en el runtime de la edge function.
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user_id}`, {
      method: 'PUT',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: new_password }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Auth admin ${res.status}: ${body || 'sin detalle'}`)
    }

    return new Response(
      JSON.stringify({ success: true }),
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
