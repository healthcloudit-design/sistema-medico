-- ============================================================================
-- MIGRACIÓN 054 — Reporte semanal por mail (RPC + cron)
-- ----------------------------------------------------------------------------
-- Correr DESPUÉS de deployar la edge function weekly-report.
-- La RPC get_weekly_report es genérica (sirve para cualquier centro).
-- El cron está apuntado al centro Bicentenario (se puede duplicar para otros).
--
-- AUTENTICACIÓN DEL CRON: lee el service_role key desde Supabase Vault
-- (secreto 'service_role_key'). Guardarlo una vez con:
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key', 'Service role key para crons');
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ──────────────────────────────────────────────────────────────────────────
-- RPC: métricas de la SEMANA ANTERIOR (lun–dom) + comparación semana previa.
-- "Atendido" = turno que NO se canceló ni fue ausente.
-- Si se pasan p_from/p_to, usa ese rango como "actual" (para pruebas).
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_weekly_report(
  p_org  uuid,
  p_from timestamptz DEFAULT NULL,
  p_to   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz          text        := 'America/Argentina/Buenos_Aires';
  v_this_monday timestamptz := (date_trunc('week', (now() AT TIME ZONE v_tz)))::timestamp AT TIME ZONE v_tz;
  v_cur_from    timestamptz;
  v_cur_to      timestamptz;
  v_len         interval;
  v_prev_from   timestamptz;
  v_prev_to     timestamptz;
  v_result      jsonb;
BEGIN
  IF p_from IS NOT NULL AND p_to IS NOT NULL THEN
    v_cur_from := p_from;  v_cur_to := p_to;
  ELSE
    v_cur_from := v_this_monday - interval '7 days';   -- lunes pasado 00:00
    v_cur_to   := v_this_monday;                       -- este lunes 00:00 (exclusivo)
  END IF;

  v_len       := v_cur_to - v_cur_from;
  v_prev_to   := v_cur_from;
  v_prev_from := v_cur_from - v_len;

  WITH cur AS (
    SELECT a.professional_id, a.service_id, a.status,
           (a.status NOT IN ('cancelado','no_asistio')) AS atendido
    FROM appointments a
    WHERE a.organization_id = p_org
      AND a.starts_at >= v_cur_from AND a.starts_at < v_cur_to
  ),
  prev AS (
    SELECT a.status
    FROM appointments a
    WHERE a.organization_id = p_org
      AND a.starts_at >= v_prev_from AND a.starts_at < v_prev_to
  ),
  by_prof AS (
    SELECT COALESCE(p.full_name,'(sin profesional)') AS name, count(*) AS atendidos
    FROM cur c JOIN professionals p ON p.id = c.professional_id
    WHERE c.atendido
    GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 15
  ),
  by_svc AS (
    SELECT COALESCE(s.name,'(sin servicio)') AS name, count(*) AS atendidos
    FROM cur c JOIN services s ON s.id = c.service_id
    WHERE c.atendido
    GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 15
  )
  SELECT jsonb_build_object(
    'range', jsonb_build_object('from', v_cur_from, 'to', v_cur_to),
    'current', jsonb_build_object(
      'total',      (SELECT count(*) FROM cur),
      'atendidos',  (SELECT count(*) FROM cur WHERE atendido),
      'cancelados', (SELECT count(*) FROM cur WHERE status = 'cancelado'),
      'ausentes',   (SELECT count(*) FROM cur WHERE status = 'no_asistio'),
      'by_professional', COALESCE((SELECT jsonb_agg(jsonb_build_object('name',name,'atendidos',atendidos)) FROM by_prof), '[]'::jsonb),
      'by_service',      COALESCE((SELECT jsonb_agg(jsonb_build_object('name',name,'atendidos',atendidos)) FROM by_svc),  '[]'::jsonb)
    ),
    'previous', jsonb_build_object(
      'total',      (SELECT count(*) FROM prev),
      'atendidos',  (SELECT count(*) FROM prev WHERE status NOT IN ('cancelado','no_asistio')),
      'cancelados', (SELECT count(*) FROM prev WHERE status = 'cancelado'),
      'ausentes',   (SELECT count(*) FROM prev WHERE status = 'no_asistio')
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_weekly_report(uuid, timestamptz, timestamptz) TO service_role;

-- ──────────────────────────────────────────────────────────────────────────
-- CRON: lunes 11:00 UTC = 08:00 ART. Invoca la edge function weekly-report.
-- La URL es fija (no es secreta) y el service_role key se lee del Vault.
-- Requiere el secreto 'service_role_key' cargado en Vault (ver cabecera).
-- ──────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('weekly-report-bicentenario');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'weekly-report-bicentenario',
  '0 11 * * 1',
  $job$
  SELECT net.http_post(
    url     := 'https://xuwkxelrcglstvisbcnk.supabase.co/functions/v1/weekly-report',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body    := jsonb_build_object('scheduled', true, 'slug', 'bicentenario')
  );
  $job$
);
