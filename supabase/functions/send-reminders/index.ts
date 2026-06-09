import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function formatArgDate(iso: string): string {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d = new Date(ms)
  const dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${dias[d.getUTCDay()]} ${d.getUTCDate()} de ${meses[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
}

function formatArgTime(iso: string): string {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000
  const d = new Date(ms)
  return `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')}`
}

function buildReminderHtml(opts: {
  patient_name: string
  professional_name: string
  service_name: string
  fecha: string
  hora: string
  hours_until: number
  cancel_url: string
}): string {
  const { patient_name, professional_name, service_name, fecha, hora, hours_until, cancel_url } = opts
  const isManana = hours_until <= 24
  const titulo = isManana
    ? '⏰ Tu turno es mañana'
    : '📅 Te recordamos tu turno'
  const intro = isManana
    ? 'Tu turno es <strong>mañana</strong>. Te dejamos los detalles:'
    : 'Tu turno es <strong>pasado mañana</strong>. Te dejamos los detalles:'

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:${isManana ? '#f59e0b' : '#0284c7'};padding:28px 32px;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${titulo}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;color:#374151;font-size:16px;">Hola <strong>${patient_name}</strong>,</p>
            <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">${intro}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border-radius:12px;margin-bottom:24px;">
              <tr><td style="padding:20px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr><td style="padding:6px 0;border-bottom:1px solid #e0f2fe;">
                    <span style="color:#6b7280;font-size:13px;">Servicio</span><br>
                    <strong style="color:#0c4a6e;font-size:15px;">${service_name}</strong>
                  </td></tr>
                  <tr><td style="padding:6px 0;border-bottom:1px solid #e0f2fe;">
                    <span style="color:#6b7280;font-size:13px;">Profesional</span><br>
                    <strong style="color:#0c4a6e;font-size:15px;">${professional_name}</strong>
                  </td></tr>
                  <tr><td style="padding:6px 0;border-bottom:1px solid #e0f2fe;">
                    <span style="color:#6b7280;font-size:13px;">Fecha</span><br>
                    <strong style="color:#0c4a6e;font-size:15px;">${fecha}</strong>
                  </td></tr>
                  <tr><td style="padding:6px 0;">
                    <span style="color:#6b7280;font-size:13px;">Hora</span><br>
                    <strong style="color:#0c4a6e;font-size:24px;">${hora}hs</strong>
                  </td></tr>
                </table>
              </td></tr>
            </table>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <tr><td style="padding:0 0 8px;">
                <a href="${cancel_url}" style="display:inline-block;background:#ef4444;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:12px;text-decoration:none;">
                  Cancelar turno
                </a>
              </td></tr>
              <tr><td>
                <p style="margin:0;color:#9ca3af;font-size:11px;">Si no podés asistir, cancelá con anticipación para liberar el turno.</p>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">Este es un email automático, por favor no respondas.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_KEY     = Deno.env.get('SERVICE_ROLE_KEY')!
    const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY')!
    const APP_URL          = Deno.env.get('APP_URL') ?? 'https://sistema-turnos-praxis.vercel.app'

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    const now = new Date()

    // Ventanas de recordatorio: 47-49hs y 23-25hs antes del turno
    const windows = [
      { label: '48h', from: 47, to: 49, field: 'reminder_48h_sent' as const },
      { label: '24h', from: 23, to: 25, field: 'reminder_24h_sent' as const },
    ]

    const results: Record<string, unknown>[] = []

    for (const win of windows) {
      const fromDt = new Date(now.getTime() + win.from * 60 * 60 * 1000).toISOString()
      const toDt   = new Date(now.getTime() + win.to   * 60 * 60 * 1000).toISOString()

      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('id, patient_name, patient_email, starts_at, cancellation_token, professionals(full_name), services(name)')
        .gte('starts_at', fromDt)
        .lte('starts_at', toDt)
        .eq(win.field, false)
        .in('status', ['confirmado', 'pendiente'])
        .not('patient_email', 'is', null)

      if (error) { console.error(`Error fetching ${win.label}:`, error); continue }

      for (const appt of (appointments ?? [])) {
        const fecha = formatArgDate(appt.starts_at)
        const hora  = formatArgTime(appt.starts_at)
        const cancelUrl = `${APP_URL}/cancelar?token=${appt.cancellation_token}`
        const professional = (appt.professionals as { full_name: string } | null)?.full_name ?? ''
        const service      = (appt.services      as { name: string }      | null)?.name      ?? ''
        const hoursUntil   = win.from

        const html = buildReminderHtml({
          patient_name:      appt.patient_name,
          professional_name: professional,
          service_name:      service,
          fecha,
          hora,
          hours_until:       hoursUntil,
          cancel_url:        cancelUrl,
        })

        const subject = hoursUntil <= 24
          ? `⏰ Recordatorio: tu turno es mañana a las ${hora}hs`
          : `📅 Recordatorio: tu turno es pasado mañana a las ${hora}hs`

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Turnos <turnos@praxisoperativa.com>',
            to: [appt.patient_email],
            subject,
            html,
          }),
        })

        if (res.ok) {
          await supabase
            .from('appointments')
            .update({ [win.field]: true })
            .eq('id', appt.id)

          results.push({ id: appt.id, type: win.label, sent: true })
          console.log(`Reminder ${win.label} sent to ${appt.patient_email} for appt ${appt.id}`)
        } else {
          const err = await res.json()
          console.error(`Failed to send ${win.label} to ${appt.patient_email}:`, err)
          results.push({ id: appt.id, type: win.label, sent: false, error: err })
        }
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
