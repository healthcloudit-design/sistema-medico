-- El flujo público multi-centro (salud pública) necesita listar los centros (locations)
-- como usuario anónimo. Hasta ahora locations no tenía ninguna policy => anon no leía nada.
-- Se habilita lectura anónima SOLO para tenants de tipo 'general' (salud pública) y activos,
-- de modo que las sedes de los tenants comerciales existentes siguen siendo privadas.
CREATE POLICY locations_publicos ON public.locations
  FOR SELECT TO anon
  USING (
    active = true
    AND organization_id IN (
      SELECT id FROM public.organizations WHERE tenant_type = 'general' AND active = true
    )
  );
