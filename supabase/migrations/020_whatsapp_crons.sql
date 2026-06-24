-- ============================================================
-- Migración 020: cron jobs recordatorios WhatsApp
-- ============================================================

-- Habilitar pg_net si no está
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Función auxiliar para llamar edge function send-whatsapp
CREATE OR REPLACE FUNCTION call_send_whatsapp(p_appointment_id UUID, p_message_type TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/send-whatsapp',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'Authorization',  'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := jsonb_build_object(
      'appointment_id', p_appointment_id::text,
      'message_type',   p_message_type
    )
  );
END;
$$;

-- Cron: recordatorio 24hs — corre todos los días a las 18hs ARG (21 UTC)
SELECT cron.schedule(
  'recordatorio-24h',
  '0 21 * * *',
  $$
    SELECT call_send_whatsapp(id, 'reminder_24h')
    FROM appointments
    WHERE
      reminder_24h_sent = false
      AND patient_phone IS NOT NULL
      AND status IN ('confirmado', 'pendiente')
      AND starts_at >= (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires' + interval '20 hours')::timestamptz
      AND starts_at <  (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires' + interval '28 hours')::timestamptz;
  $$
);

-- Cron: recordatorio 2hs — corre cada 30 minutos
SELECT cron.schedule(
  'recordatorio-2h',
  '*/30 * * * *',
  $$
    SELECT call_send_whatsapp(id, 'reminder_2h')
    FROM appointments
    WHERE
      reminder_2h_sent = false
      AND patient_phone IS NOT NULL
      AND status IN ('confirmado', 'pendiente')
      AND starts_at >= (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires' + interval '1 hour 50 minutes')::timestamptz
      AND starts_at <  (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires' + interval '2 hours 20 minutes')::timestamptz;
  $$
);
