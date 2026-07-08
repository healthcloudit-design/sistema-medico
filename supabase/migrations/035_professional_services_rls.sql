-- Migración 035: RLS policies faltantes en professional_services
-- Sin SELECT policy, anon no ve ningún profesional en el booking flow

CREATE POLICY "ps_select_public"
  ON professional_services FOR SELECT
  USING (true);

CREATE POLICY "ps_insert_admin"
  ON professional_services FOR INSERT
  WITH CHECK (get_my_role() IN ('superadmin', 'globaladmin', 'admin'));

CREATE POLICY "ps_delete_admin"
  ON professional_services FOR DELETE
  USING (get_my_role() IN ('superadmin', 'globaladmin', 'admin'));
