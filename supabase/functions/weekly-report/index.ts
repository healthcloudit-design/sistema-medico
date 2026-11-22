import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// ============================================================================
// weekly-report — Reporte por mail (métricas + rankings) para Praxis Agenda.
// Dos formas de uso:
//   1) CRON semanal: header x-report-secret == REPORT_SECRET, body {scheduled, slug}.
//   2) PANEL admin: el admin logueado (JWT) lo dispara on-demand con
//      body { report_type, days, email, org_id? }. Sólo puede exportar su centro.
// Deploy:  supabase functions deploy weekly-report --no-verify-jwt
// ============================================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-report-secret',
}

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY')!
const REPORT_SECRET    = Deno.env.get('REPORT_SECRET') ?? ''
const DEFAULT_TO       = Deno.env.get('WEEKLY_REPORT_TO') ?? 'isaacm@praxisoperativa.com'

const ADMIN_ROLES = ['admin', 'superadmin', 'globaladmin']

const TITLES: Record<string, string> = {
  general:            'Reporte general',
  servicios:          'Servicios más utilizados',
  prof_atendidos:     'Profesionales con más pacientes atendidos',
  prof_cancelaciones: 'Profesionales con más cancelaciones',
  prof_ausencias:     'Profesionales con más ausencias',
}

// ── fechas en horario argentino (UTC-3) ────────────────────────────────────
function argDate(iso: string): Date { return new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000) }
function fmtDM(iso: string): string {
  const d = argDate(iso)
  return `${d.getUTCDate().toString().padStart(2, '0')}/${(d.getUTCMonth() + 1).toString().padStart(2, '0')}`
}

function delta(cur: number, prev: number): string {
  const d = cur - prev
  if (d === 0) return `<span style="color:#9ca3af;">=</span>`
  const up = d > 0
  return `<span style="color:${up ? '#16a34a' : '#dc2626'};font-weight:600;">${up ? '▲' : '▼'} ${Math.abs(d)}</span>`
}

function rankRows(items: { name: string; cantidad: number }[]): string {
  if (!items || !items.length) return `<tr><td style="padding:10px 0;color:#9ca3af;font-size:13px;">Sin datos en el período.</td></tr>`
  const max = items[0].cantidad || 1
  return items.map((it, i) => `
    <tr><td style="padding:7px 0;border-bottom:1px solid #f1f5f9;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="color:#94a3b8;font-size:12px;width:22px;">${i + 1}.</td>
        <td style="color:#0f172a;font-size:14px;">${it.name}</td>
        <td style="width:120px;"><div style="background:#e2e8f0;border-radius:6px;height:8px;width:100%;">
          <div style="background:#0284c7;border-radius:6px;height:8px;width:${Math.round((it.cantidad / max) * 100)}%;"></div></div></td>
        <td style="color:#0f172a;font-size:14px;font-weight:700;width:40px;text-align:right;">${it.cantidad}</td>
      </tr></table>
    </td></tr>`).join('')
}

function block(heading: string, items: { name: string; cantidad: number }[]): string {
  return `
    <tr><td style="padding:18px 32px 4px;">
      <p style="margin:0 0 6px;color:#0f172a;font-size:15px;font-weight:700;">${heading}</p>
      <table width="100%" cellpadding="0" cellspacing="0">${rankRows(items)}</table>
    </td></tr>`
}

function rankingSections(type: string, cur: any): string {
  switch (type) {
    case 'servicios':          return block('Servicios más utilizados', cur.by_service)
    case 'prof_atendidos':     return block('Profesionales con más pacientes atendidos', cur.by_professional)
    case 'prof_cancelaciones': return block('Profesionales con más cancelaciones', cur.by_professional_cancelados)
    case 'prof_ausencias':     return block('Profesionales con más ausencias', cur.by_professional_ausentes)
    default:                   return block('Profesionales más solicitados', cur.by_professional) + block('Servicios más utilizados', cur.by_service)
  }
}

function summaryCard(label: string, cur: number, prev: number, accent: string): string {
  return `
    <td style="padding:6px;" width="25%">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
        <tr><td style="padding:14px 12px;text-align:center;">
          <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.04em;">${label}</div>
          <div style="color:${accent};font-size:26px;font-weight:800;margin:4px 0 2px;">${cur}</div>
          <div style="font-size:12px;">${delta(cur, prev)} <span style="color:#cbd5e1;">vs período ant.</span></div>
        </td></tr>
      </table>
    </td>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const rest = (path: string, init?: RequestInit) =>
    fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    const body = await req.json().catch(() => ({} as any))
    let orgId: string | null = null
    let scheduled = false

    // ── AUTH + resolución de centro ──
    const secret = req.headers.get('x-report-secret') ?? ''
    if (REPORT_SECRET && secret === REPORT_SECRET) {
      // Camino de confianza (cron)
      scheduled = !!body.scheduled
      if (body.org_id) {
        orgId = body.org_id
      } else {
        const r = await rest(`organizations?slug=eq.${encodeURIComponent(body.slug ?? 'bicentenario')}&select=id`)
        const o = await r.json()
        orgId = Array.isArray(o) && o.length ? o[0].id : null
      }
    } else {
      // Camino admin (JWT del usuario logueado)
      const authz = req.headers.get('Authorization') ?? ''
      if (!authz.toLowerCase().startsWith('bearer ')) return json({ error: 'unauthorized' }, 401)
      const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: authz, apikey: SERVICE_ROLE_KEY } })
      const u = await uRes.json()
      if (!uRes.ok || !u?.id) return json({ error: 'unauthorized' }, 401)
      const pRes = await rest(`profiles?id=eq.${u.id}&select=role,organization_id`)
      const ps = await pRes.json()
      const prof = Array.isArray(ps) && ps.length ? ps[0] : null
      if (!prof || !ADMIN_ROLES.includes(prof.role)) return json({ error: 'forbidden' }, 403)
      // admin: su propio centro. superadmin/globaladmin: puede pedir otro.
      if (['superadmin', 'globaladmin'].includes(prof.role) && body.org_id) orgId = body.org_id
      else orgId = prof.organization_id
      if (!body.email) body.email = u.email  // por defecto, al mail del propio admin
    }

    if (!orgId) return json({ error: 'sin organización asociada' }, 400)

    const oRes = await rest(`organizations?id=eq.${orgId}&select=id,name`)
    const os = await oRes.json()
    if (!Array.isArray(os) || !os.length) throw new Error('centro no encontrado')
    const org = os[0]

    // ── rango ──
    let p_from: string | null = null, p_to: string | null = null
    const days = Number(body.days)
    if (Number.isFinite(days) && days > 0) {
      const n = Math.min(Math.floor(days), 365)
      const now = new Date()
      p_to = now.toISOString()
      p_from = new Date(now.getTime() - n * 86400000).toISOString()
    } else if (body.test) {
      const now = new Date()
      p_to = now.toISOString()
      p_from = new Date(now.getTime() - 7 * 86400000).toISOString()
    }

    // ── métricas ──
    const rpcRes = await rest(`rpc/get_weekly_report`, {
      method: 'POST',
      body: JSON.stringify({ p_org: org.id, p_from, p_to }),
    })
    const data = await rpcRes.json()
    if (!rpcRes.ok) throw new Error(`rpc error: ${JSON.stringify(data)}`)

    const cur  = data.current
    const prev = data.previous
    const type = (body.report_type as string) ?? 'general'
    const to   = body.email ?? DEFAULT_TO
    const desde = fmtDM(data.range.from)
    const hasta = fmtDM(new Date(new Date(data.range.to).getTime() - 86400000).toISOString())
    const asistencia = cur.total ? Math.round((cur.atendidos / cur.total) * 100) : 0
    const titulo = scheduled ? 'Reporte semanal' : (TITLES[type] ?? 'Reporte')

    const html = `
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;"><tr><td align="center">
    <table width="100%" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <tr><td style="background:#0284c7;padding:26px 32px;">
        <p style="margin:0;color:#ffffff;font-size:20px;font-weight:800;">📊 ${titulo}</p>
        <p style="margin:4px 0 0;color:#bae6fd;font-size:14px;">${org.name} · del ${desde} al ${hasta}</p>
      </td></tr>

      <tr><td style="padding:24px 26px 6px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          ${summaryCard('Turnos', cur.total, prev.total, '#0f172a')}
          ${summaryCard('Atendidos', cur.atendidos, prev.atendidos, '#16a34a')}
          ${summaryCard('Cancelados', cur.cancelados, prev.cancelados, '#d97706')}
          ${summaryCard('Ausentes', cur.ausentes, prev.ausentes, '#dc2626')}
        </tr></table>
        <p style="margin:12px 2px 0;color:#64748b;font-size:13px;">Asistencia del período: <strong style="color:#0f172a;">${asistencia}%</strong> de los turnos se atendieron.</p>
      </td></tr>

      ${rankingSections(type, cur)}

      <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">Reporte generado por Praxis Operativa · se cuenta como "atendido" todo turno que no fue cancelado ni ausente.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`

    const mail = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Reportes Praxis <turnos@praxisoperativa.com>',
        to: [to],
        subject: `📊 ${titulo} — ${org.name} (${desde} al ${hasta})`,
        html,
      }),
    })
    const mailData = await mail.json()
    if (!mail.ok) throw new Error(`resend error: ${JSON.stringify(mailData)}`)

    return json({ ok: true, sent_to: to, type, metrics: cur })
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500)
  }
})
