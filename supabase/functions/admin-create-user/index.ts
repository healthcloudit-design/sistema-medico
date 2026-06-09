import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Verificar que el caller es admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) throw new Error('Unauthorized')

    const { data: profile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
      throw new Error('Forbidden: solo admins pueden crear usuarios')
    }

    // Crear el usuario con el admin client
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    )

    const { email, password, full_name, role, professional_id } = await req.json()

    if (!email || !password || !role) {
      throw new Error('email, password y role son requeridos')
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    })

    if (createError) throw createError

    // El trigger handle_new_user ya crea el profile. Actualizamos professional_id si aplica.
    if (professional_id && newUser.user) {
      await adminClient
        .from('profiles')
        .update({ professional_id, full_name })
        .eq('id', newUser.user.id)

      // Vincular también en professionals.user_id
      await adminClient
        .from('professionals')
        .update({ user_id: newUser.user.id })
        .eq('id', professional_id)
    }

    return new Response(
      JSON.stringify({ id: newUser.user?.id, email, role }),
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
