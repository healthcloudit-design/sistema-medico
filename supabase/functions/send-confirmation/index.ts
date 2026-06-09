import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConfirmationPayload {
  patient_name: string
  patient_email: string
  professional_name: string
  service_name: string
  starts_at: string
  appointment_id: string
  cancellation_token?: string
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

function cancelButton(token: string | undefined, appUrl: string): string {
  if (!token) return ''
  const url = `${appUrl}/cancelar?token=${token}`
  return `
    <tr>
      <td style="padding:0 0 8px;">
        <a href="${url}" style="display:inline-block;background:#ef4444;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:12px;text-decoration:none;">
          Cancelar turno
        </a>
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 16px;">
        <p style="margin:0;color:#9ca3af;font-size:11px;">Si no podés asistir, cancelá con anticipación para liberar el turno.</p>
      </td>
    </tr>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const payload: ConfirmationPayload = await req.json()
    const { patient_name, patient_email, professional_name, service_name, starts_at, cancellation_token } = payload

    if (!patient_email) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no_email' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const fecha = formatArgDate(starts_at)
    const hora  = formatArgTime(starts_at)
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY no configurado')

    const APP_URL = Deno.env.get('APP_URL') ?? 'https://sistema-turnos-praxis.vercel.app'

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:#0284c7;padding:28px 32px;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">✅ Turno confirmado</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;color:#374151;font-size:16px;">Hola <strong>${patient_name}</strong>,</p>
            <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Tu turno fue reservado correctamente. Acá están los detalles:</p>
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
            <table cellpadding="0" cellspacing="0">
              ${cancelButton(cancellation_token, APP_URL)}
            </table>
            <p style="margin:0;color:#6b7280;font-size:13px;">Si necesitás reprogramar, comunicate con el centro con anticipación.</p>
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

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Turnos <turnos@praxisoperativa.com>',
        to: [patient_email],
        subject: `✅ Turno confirmado — ${fecha} a las ${hora}hs`,
        html,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('Resend error:', data)
      return new Response(JSON.stringify({ error: data }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ sent: true, id: data.id }), { headers: { ...CORS, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
