-- Migración 034: vincular profesionales de DA Derm con sus servicios
DO $$
DECLARE
  v_org_id      UUID;
  v_aguiar      UUID;
  v_herrero     UUID;
  v_svc         RECORD;
BEGIN
  SELECT id INTO v_org_id  FROM organizations  WHERE slug = 'da-derm';
  SELECT id INTO v_aguiar  FROM professionals  WHERE organization_id = v_org_id AND full_name = 'Dra. Déborah Aguiar';
  SELECT id INTO v_herrero FROM professionals  WHERE organization_id = v_org_id AND full_name = 'Dra. Valentina Herrero';

  -- Dra. Aguiar atiende todos los servicios
  FOR v_svc IN SELECT id FROM services WHERE organization_id = v_org_id LOOP
    INSERT INTO professional_services (professional_id, service_id)
    VALUES (v_aguiar, v_svc.id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Dra. Herrero: solo consulta, control y peeling (perfil clínico)
  INSERT INTO professional_services (professional_id, service_id)
  SELECT v_herrero, id FROM services
  WHERE organization_id = v_org_id
    AND name IN ('Consulta dermatológica', 'Control de tratamiento', 'Peeling químico')
  ON CONFLICT DO NOTHING;

END $$;
