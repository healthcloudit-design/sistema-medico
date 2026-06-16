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

    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')
    const APP_URL         = Deno.env.get('APP_URL')
    if (!MP_ACCESS_TOKEN) throw new Error('MP_ACCESS_TOKEN no configurado')
    if (!APP_URL)         throw new Error('APP_URL no configurado')

    // Obtener datos del turno
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: appt, error } = await supabase
      .from('appointments')
      .select('*, services(name, price, duration_minutes), professionals(full_name)')
      .eq('id', appointment_id)
      .single()

    if (error || !appt) throw new Error('Turno no encontrado')

    const service    = appt.services as { name: string; price: number | null }
    const profesional = appt.professionals as { full_name: string }
    const price      = service.price ?? 0

    if (price <= 0) throw new Error('El servicio no tiene precio configurado')

    const startsAt = new Date(appt.starts_at)
    const dateStr  = startsAt.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    const timeStr  = startsAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })

    // Crear preferencia en MercadoPago
    const preference = {
      items: [{
        id:          appointment_id,
        title:       `${service.name} - Dr. ${profesional.full_name}`,
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
        success: `${APP_URL}/turno/pago-exitoso?appointment_id=${appointment_id}`,
        failure: `${APP_URL}/turno/pago-fallido?appointment_id=${appointment_id}`,
        pending: `${APP_URL}/turno/pago-pendiente?appointment_id=${appointment_id}`,
      },
      auto_return:          'approved',
      external_reference:   appointment_id,
      notification_url:     `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`,
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
