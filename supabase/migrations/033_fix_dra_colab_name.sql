-- Migración 033: nombre real para la profesional asociada de DA Derm
UPDATE professionals
SET
  full_name  = 'Dra. Valentina Herrero',
  specialty  = 'Dermatología Clínica',
  bio        = 'Dermatóloga clínica del equipo DA. Especialista en dermatología general, acné, psoriasis y control de nevos. MN 171834.'
WHERE
  full_name = 'Dra. Médica Asociada'
  AND organization_id = (SELECT id FROM organizations WHERE slug = 'da-derm');
