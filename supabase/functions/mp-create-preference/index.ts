import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { appointment_id } = await req.json()
    if (!appointment_id) throw new Error('appointment_id requerido')

    const APP_URL          = Deno.env.get('APP_URL')
    const ENV_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN') // fallback global, solo si el tenant no tiene token propio
    if (!APP_URL) throw new Error('APP_URL no configurado')

    // Obtener datos del turno
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: appt, error } = await supabase
      .from('appointments')
      .select('*, services(name, price, duration_minutes), professionals(full_name), organizations(deposit_amount)')
      .eq('id', appointment_id)
      .single()

    if (error || !appt) throw new Error('Turno no encontrado')

    const orgId = appt.organization_id as string

    // Token de Mercado Pago propio del tenant (tabla aislada, no expuesta a anon). Si no tiene uno
    // configurado, cae al token global de la variable de entorno (comportamiento anterior).
    const { data: cred } = await supabase
      .from('organization_payment_credentials')
      .select('mp_access_token')
      .eq('organization_id', orgId)
      .maybeSingle()

    const MP_ACCESS_TOKEN = (cred?.mp_access_token as string | null) || ENV_ACCESS_TOKEN
    if (!MP_ACCESS_TOKEN) throw new Error('MP_ACCESS_TOKEN no configurado para esta organización')

    const service     = appt.services as { name: string; price: number | null }
    const profesional = appt.professionals as { full_name: string }
    const org          = appt.organizations as { deposit_amount: number | null } | null
    // Si la organización tiene una seña fija configurada, se cobra ESE monto (no el precio del
    // servicio, que puede no mostrarse al paciente en absoluto). Si no, se mantiene el comportamiento
    // original: se cobra el precio completo del servicio.
    const depositAmount = org?.deposit_amount ?? null
    const isDeposit      = depositAmount != null && depositAmount > 0
    const price          = isDeposit ? depositAmount : (service.price ?? 0)

    if (price <= 0) throw new Error('El servicio no tiene precio configurado')

    const startsAt = new Date(appt.starts_at)
    const dateStr  = startsAt.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    const timeStr  = startsAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })

    // Crear preferencia en MercadoPago
    const preference = {
      items: [{
        id:          appointment_id,
        title:       isDeposit ? `Seña - ${service.name} - ${profesional.full_name}` : `${service.name} - Dr. ${profesional.full_name}`,
        description: `Turno: ${dateStr} a las ${timeStr}hs`,
        quantity:    1,
        unit_price:  price,
        currency_id: 'ARS',
      }],
      payer: {
        name:  appt.patient_name,
        email: appt.patient_email ?? undefined,
        phone: appt.patient_phone ? { number: appt.patient_phone } : undefined,
      },
      back_urls: {
        // La app usa basename "/agenda" en el router (ver src/App.tsx), hay que incluirlo acá o
        // el redirect de MercadoPago cae en una ruta inexistente.
        success: `${APP_URL}/agenda/turno/pago-exitoso?appointment_id=${appointment_id}`,
        failure: `${APP_URL}/agenda/turno/pago-fallido?appointment_id=${appointment_id}`,
        pending: `${APP_URL}/agenda/turno/pago-pendiente?appointment_id=${appointment_id}`,
      },
      auto_return:          'approved',
      external_reference:   appointment_id,
      // org_id viaja en la notification_url para que el webhook sepa con qué token de MP
      // consultar el pago (cada tenant puede tener su propia cuenta de Mercado Pago).
      notification_url:     `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook?org_id=${orgId}`,
      statement_descriptor: 'TURNOS MEDICOS',
      expires:              true,
      expiration_date_to:   new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24hs
    }

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(preference),
    })

    if (!mpRes.ok) {
      const err = await mpRes.text()
      throw new Error(`MercadoPago error: ${err}`)
    }

    const mpData = await mpRes.json()

    // Guardar preference_id en el turno
    await supabase
      .from('appointments')
      .update({ transaction_id: mpData.id, payment_status: 'pendiente' })
      .eq('id', appointment_id)

    return new Response(JSON.stringify({
      preference_id: mpData.id,
      init_point:    mpData.init_point,       // producción
      sandbox_url:   mpData.sandbox_init_point, // testing
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('mp-create-preference error:', (err as Error).message)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
