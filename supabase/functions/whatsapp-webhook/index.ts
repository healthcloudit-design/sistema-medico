import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Twilio envia form-urlencoded
    const text = await req.text()
    const params = new URLSearchParams(text)
    const from  = params.get('From') ?? ''   // whatsapp:+541112345678
    const body  = (params.get('Body') ?? '').trim().toUpperCase()

    const phone = from.replace('whatsapp:', '')

    // Buscar turno activo de hoy para ese numero
    const today = new Date()
    const from_dt = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    const to_dt   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString()

    const { data: appts } = await supabase
      .from('appointments')
      .select('id, patient_name, organization_id, status, organizations(whatsapp_number, name)')
      .eq('patient_phone', phone)
      .gte('starts_at', from_dt)
      .lte('starts_at', to_dt)
      .in('status', ['pendiente', 'confirmado'])
      .order('starts_at')
      .limit(1)

    const appt = appts?.[0]
    if (!appt) {
      return new Response('<Response><Message>No encontramos un turno activo para hoy con este numero.</Message></Response>',
        { headers: { 'Content-Type': 'text/xml' } })
    }

    const org = appt.organizations as any

    if (body.includes('CANCELAR')) {
      await supabase.from('appointments').update({ status: 'cancelado' }).eq('id', appt.id)
      await supabase.from('whatsapp_logs').insert({
        organization_id: appt.organization_id,
        appointment_id:  appt.id,
        to_number:       phone,
        message_type:    'inbound_cancel',
        body:            body,
        status:          'received',
      })
      return new Response(
        `<Response><Message>Tu turno fue cancelado. Si fue un error, comunicate con ${org.name} directamente.</Message></Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    if (body.includes('TARDO') || body.includes('TARDE') || body.includes('TARDANZA')) {
      await supabase.from('whatsapp_logs').insert({
        organization_id: appt.organization_id,
        appointment_id:  appt.id,
        to_number:       phone,
        message_type:    'inbound_tardanza',
        body:            body,
        status:          'received',
      })
      // Notificar al numero de la org si tiene whatsapp_number
      if (org.whatsapp_number && Deno.env.get('TWILIO_ACCOUNT_SID')) {
        const orgPhone = org.whatsapp_number.startsWith('+') ? org.whatsapp_number : `+54${org.whatsapp_number}`
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${Deno.env.get('TWILIO_ACCOUNT_SID')}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${Deno.env.get('TWILIO_ACCOUNT_SID')}:${Deno.env.get('TWILIO_AUTH_TOKEN')}`),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              From: Deno.env.get('TWILIO_WA_FROM')!,
              To:   `whatsapp:${orgPhone}`,
              Body: `Aviso de tardanza: ${appt.patient_name} dice que llega tarde. Esperan hasta 15 min.`,
            }).toString(),
          }
        )
      }
      return new Response(
        '<Response><Message>Avisamos que vas a llegar un poco tarde. Te esperamos hasta 15 minutos.</Message></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    return new Response(
      '<Response><Message>Hola! Podes responder CANCELAR para cancelar tu turno, o TARDO si vas a llegar tarde.</Message></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    )

  } catch (err) {
    console.error(err)
    return new Response('<Response></Response>', { headers: { 'Content-Type': 'text/xml' } })
  }
})
