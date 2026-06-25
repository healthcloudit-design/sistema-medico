-- ============================================================
-- TOTEM: RPC publicos para buscar y cancelar sin login
-- ============================================================

-- Buscar turnos futuros por DNI y org slug
CREATE OR REPLACE FUNCTION buscar_turnos_totem(p_dni text, p_org_slug text)
RETURNS TABLE(
  id            uuid,
  patient_name  text,
  starts_at     timestamptz,
  status        text,
  service_name  text,
  professional_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.patient_name,
    a.starts_at,
    a.status::text,
    sv.name,
    pr.full_name
  FROM appointments a
  JOIN organizations o  ON o.id  = a.organization_id
  JOIN services sv      ON sv.id = a.service_id
  JOIN professionals pr ON pr.id = a.professional_id
  WHERE o.slug        = p_org_slug
    AND a.patient_dni = p_dni
    AND a.starts_at   >= NOW()
    AND a.status      IN ('pendiente', 'confirmado')
  ORDER BY a.starts_at
  LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION buscar_turnos_totem(text, text) TO anon;

-- Cancelar turno desde totem (verifica que el DNI coincida)
CREATE OR REPLACE FUNCTION cancelar_turno_totem(p_appointment_id uuid, p_dni text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows int;
BEGIN
  UPDATE appointments
  SET status = 'cancelado'
  WHERE id           = p_appointment_id
    AND patient_dni  = p_dni
    AND status       IN ('pendiente', 'confirmado')
    AND starts_at    > NOW();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION cancelar_turno_totem(uuid, text) TO anon;
