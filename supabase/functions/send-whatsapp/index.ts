import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!
const TWILIO_AUTH_TOKEN   = Deno.env.get('TWILIO_AUTH_TOKEN')!
const TWILIO_WA_FROM      = Deno.env.get('TWILIO_WA_FROM')!

interface Payload {
  appointment_id: string
  message_type: 'confirmation' | 'reminder_24h' | 'reminder_2h'
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { appointment_id, message_type }: Payload = await req.json()

    const { data: appt, error } = await supabase
      .from('appointments')
      .select('*, organizations(name, whatsapp_number), professionals(full_name), services(name)')
      .eq('id', appointment_id)
      .single()

    if (error || !appt) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })

    const phone = appt.patient_phone
    if (!phone) return new Response(JSON.stringify({ error: 'No phone' }), { status: 400 })

    const flagField = message_type === 'confirmation'
      ? 'reminder_confirmation_sent'
      : message_type === 'reminder_24h' ? 'reminder_24h_sent' : 'reminder_2h_sent'

    if (appt[flagField]) return new Response(JSON.stringify({ skipped: true }), { status: 200 })

    const org     = appt.organizations as any
    const prof    = appt.professionals as any
    const service = appt.services      as any

    const ms   = new Date(appt.starts_at).getTime() - 3 * 60 * 60 * 1000
    const dt   = new Date(ms)
    const fecha = dt.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    const hora  = `${dt.getUTCHours().toString().padStart(2,'0')}:${dt.getUTCMinutes().toString().padStart(2,'0')}`

    const footer = '\n\nResponde *CANCELAR* para cancelar o *TARDO* si llegas tarde (esperamos 15 min).'

    const body = message_type === 'confirmation'
      ? `Hola ${appt.patient_name} 👋\n\nTu turno en *${org.name}* fue confirmado.\n\n📅 ${fecha}\n🕐 ${hora}hs\n💼 ${service?.name ?? ''}\n👤 ${prof?.full_name ?? ''}${footer}`
      : message_type === 'reminder_24h'
      ? `Recordatorio 📅\n\nHola ${appt.patient_name}, mañana tenés turno en *${org.name}*.\n\n🕐 ${hora}hs\n💼 ${service?.name ?? ''}\n👤 ${prof?.full_name ?? ''}${footer}`
      : `Hola ${appt.patient_name} ⏰\n\nEn 2 horas tenés turno en *${org.name}* — ${hora}hs ${service?.name ?? ''}${footer}`

    const toNumber = phone.startsWith('+') ? phone : `+54${phone.replace(/^0/, '')}`

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: TWILIO_WA_FROM, To: `whatsapp:${toNumber}`, Body: body }).toString(),
      }
    )
    const tw = await twilioRes.json()

    await supabase.from('appointments').update({ [flagField]: true }).eq('id', appointment_id)
    await supabase.from('whatsapp_logs').insert({
      organization_id: appt.organization_id,
      appointment_id,
      to_number: toNumber,
      message_type,
      body,
      twilio_sid: tw.sid,
      status: tw.status ?? 'sent',
    })

    return new Response(JSON.stringify({ ok: true, sid: tw.sid }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
