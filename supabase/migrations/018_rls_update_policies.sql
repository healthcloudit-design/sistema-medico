-- ============================================================
-- Migración 018: RLS policies para UPDATE de appointments
-- y SELECT público para sala de espera
-- ============================================================

-- Médicos, recepción y admin pueden cambiar estado de turnos
CREATE POLICY "appointments_medico_update"
ON appointments
FOR UPDATE
TO authenticated
USING (
  (get_my_role() = 'medico' AND professional_id = get_my_professional_id() AND organization_id = get_my_org_id())
  OR get_my_role() = 'superadmin'
  OR (get_my_role() IN ('admin', 'recepcion') AND organization_id = get_my_org_id())
)
WITH CHECK (
  (get_my_role() = 'medico' AND professional_id = get_my_professional_id() AND organization_id = get_my_org_id())
  OR get_my_role() = 'superadmin'
  OR (get_my_role() IN ('admin', 'recepcion') AND organization_id = get_my_org_id())
);

-- Sala de espera pública: solo turnos del día, solo lectura
CREATE POLICY "sala_espera_publica"
ON appointments
FOR SELECT
TO anon
USING (
  starts_at >= (date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires')
  AND starts_at < ((date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') + interval '1 day') AT TIME ZONE 'America/Argentina/Buenos_Aires')
);
