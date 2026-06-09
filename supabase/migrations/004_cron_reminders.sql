-- ============================================================
-- MIGRACIÓN 004 — Cron job: recordatorios automáticos por email
-- Requiere: pg_net habilitado (Database → Extensions → pg_net)
-- ============================================================

-- Eliminar job si ya existe (ignora el error si no existe)
DO $$
BEGIN
  PERFORM cron.unschedule('send-reminders-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Programar send-reminders cada hora en el minuto 0
SELECT cron.schedule(
  'send-reminders-hourly',
  '0 * * * *',
  $job$
  SELECT net.http_post(
    url     := 'https://xuwkxelrcglstvisbcnk.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $job$
);
