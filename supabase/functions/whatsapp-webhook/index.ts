import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function sendTwilioMessage(to: string, body: string) {
  const sid   = Deno.env.get('TWILIO_ACCOUNT_SID')!
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')!
  const from  = Deno.env.get('TWILIO_WA_FROM')!
  const toNum = to.startsWith('+') ? to : `+549${to.replace(/^0/, '').replace(/^9/, '')}`
  await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${sid}:${token}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: `whatsapp:${toNum}`, Body: body }).toString(),
    }
  )
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const text   = await req.text()
    const params = new URLSearchParams(text)
    const from   = params.get('From') ?? ''
    const body   = (params.get('Body') ?? '').trim().toUpperCase()

    const phone = from.replace('whatsapp:', '')
    const phoneStripped = phone.startsWith('+549')
      ? phone.slice(4)
      : phone.startsWith('+54')
      ? phone.slice(3)
      : phone.startsWith('+')
      ? phone.slice(1)
      : phone

    const now = new Date().toISOString()

    const { data: appts } = await supabase
      .from('appointments')
      .select('id, patient_name, patient_phone, organization_id, status, starts_at, professionals(full_name), services(name), organizations(whatsapp_number, name)')
      .or(`patient_phone.eq.${phone},patient_phone.eq.${phoneStripped}`)
      .gte('starts_at', now)
      .in('status', ['pendiente', 'confirmado'])
      .order('starts_at')
      .limit(1)

    const appt = appts?.[0]
    if (!appt) {
      return new Response('<Response><Message>No encontramos un turno proximo con este numero.</Message></Response>',
        { headers: { 'Content-Type': 'text/xml' } })
    }

    const org  = appt.organizations as any
    const prof = appt.professionals as any
    const svc  = appt.services      as any

    // Hora del turno en ARG
    const ms   = new Date(appt.starts_at).getTime() - 3 * 60 * 60 * 1000
    const dt   = new Date(ms)
    const hora = `${dt.getUTCHours().toString().padStart(2,'0')}:${dt.getUTCMinutes().toString().padStart(2,'0')}`
    const fecha = dt.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

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

      // Notificar a la organizacion
      if (org.whatsapp_number) {
        await sendTwilioMessage(
          org.whatsapp_number,
          `❌ Turno cancelado por WhatsApp\n\n👤 ${appt.patient_name}\n📅 ${fecha} ${hora}hs\n💼 ${svc?.name ?? ''} — ${prof?.full_name ?? ''}\n\nEl paciente cancelo su turno desde el recordatorio de WhatsApp.`
        ).catch(() => {})
      }

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
      if (org.whatsapp_number) {
        await sendTwilioMessage(
          org.whatsapp_number,
          `⏰ Aviso de tardanza\n\n👤 ${appt.patient_name}\n🕐 Turno a las ${hora}hs — ${svc?.name ?? ''} — ${prof?.full_name ?? ''}\n\nDice que llega tarde. Esperan hasta 15 minutos.`
        ).catch(() => {})
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
