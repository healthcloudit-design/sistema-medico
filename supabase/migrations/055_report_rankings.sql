-- ============================================================================
-- MIGRACIÓN 055 — get_weekly_report: rankings por tipo
-- ----------------------------------------------------------------------------
-- Extiende la RPC para el "Exportar reporte" on-demand del panel admin.
-- Agrega rankings de CANCELACIONES y AUSENCIAS por profesional, y unifica
-- la métrica de cada ranking bajo la clave 'cantidad'.
-- Reemplaza la función de la migración 054 (CREATE OR REPLACE).
-- ============================================================================

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
    v_cur_from := v_this_monday - interval '7 days';
    v_cur_to   := v_this_monday;
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
    SELECT COALESCE(p.full_name,'(sin profesional)') AS name, count(*) AS cantidad
    FROM cur c JOIN professionals p ON p.id = c.professional_id
    WHERE c.atendido
    GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 20
  ),
  by_svc AS (
    SELECT COALESCE(s.name,'(sin servicio)') AS name, count(*) AS cantidad
    FROM cur c JOIN services s ON s.id = c.service_id
    WHERE c.atendido
    GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 20
  ),
  by_prof_cancel AS (
    SELECT COALESCE(p.full_name,'(sin profesional)') AS name, count(*) AS cantidad
    FROM cur c JOIN professionals p ON p.id = c.professional_id
    WHERE c.status = 'cancelado'
    GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 20
  ),
  by_prof_ausente AS (
    SELECT COALESCE(p.full_name,'(sin profesional)') AS name, count(*) AS cantidad
    FROM cur c JOIN professionals p ON p.id = c.professional_id
    WHERE c.status = 'no_asistio'
    GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 20
  )
  SELECT jsonb_build_object(
    'range', jsonb_build_object('from', v_cur_from, 'to', v_cur_to),
    'current', jsonb_build_object(
      'total',      (SELECT count(*) FROM cur),
      'atendidos',  (SELECT count(*) FROM cur WHERE atendido),
      'cancelados', (SELECT count(*) FROM cur WHERE status = 'cancelado'),
      'ausentes',   (SELECT count(*) FROM cur WHERE status = 'no_asistio'),
      'by_professional',            COALESCE((SELECT jsonb_agg(jsonb_build_object('name',name,'cantidad',cantidad)) FROM by_prof),         '[]'::jsonb),
      'by_service',                 COALESCE((SELECT jsonb_agg(jsonb_build_object('name',name,'cantidad',cantidad)) FROM by_svc),          '[]'::jsonb),
      'by_professional_cancelados', COALESCE((SELECT jsonb_agg(jsonb_build_object('name',name,'cantidad',cantidad)) FROM by_prof_cancel),  '[]'::jsonb),
      'by_professional_ausentes',   COALESCE((SELECT jsonb_agg(jsonb_build_object('name',name,'cantidad',cantidad)) FROM by_prof_ausente), '[]'::jsonb)
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
