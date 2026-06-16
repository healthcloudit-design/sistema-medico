import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!
    const body = await req.json()

    // MP envía notificaciones tipo "payment" con id del pago
    if (body.type !== 'payment' || !body.data?.id) {
      return new Response('ok', { status: 200 })
    }

    const paymentId = body.data.id

    // Obtener detalle del pago desde MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
    })

    if (!mpRes.ok) throw new Error('No se pudo obtener el pago de MP')

    const payment = await mpRes.json()

    const appointmentId = payment.external_reference
    if (!appointmentId) return new Response('ok', { status: 200 })

    // Mapear status de MP a nuestro esquema
    const statusMap: Record<string, string> = {
      approved:    'pagado',
      pending:     'pendiente',
      in_process:  'pendiente',
      rejected:    'rechazado',
      cancelled:   'cancelado',
      refunded:    'reembolsado',
      charged_back:'contracargo',
    }

    const paymentStatus = statusMap[payment.status] ?? payment.status

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    await supabase
      .from('appointments')
      .update({
        payment_status:   paymentStatus,
        payment_amount:   payment.transaction_amount,
        payment_date:     payment.date_approved ?? new Date().toISOString(),
        payment_provider: 'mercadopago',
        transaction_id:   String(paymentId),
        // Si el pago se aprobó, confirmar el turno
        ...(payment.status === 'approved' ? { status: 'confirmado' } : {}),
      })
      .eq('id', appointmentId)

    return new Response('ok', { status: 200 })

  } catch (err) {
    console.error('mp-webhook error:', err)
    // Siempre devolver 200 a MP para que no reintente indefinidamente
    return new Response('ok', { status: 200 })
  }
})
