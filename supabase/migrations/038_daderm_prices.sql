-- Migración 038: precios de referencia servicios dra-aguiar (zona Núñez/Belgrano, jul 2026)
UPDATE services SET price = 70000  WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'dra-aguiar') AND name = 'Consulta dermatológica';
UPDATE services SET price = 50000  WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'dra-aguiar') AND name = 'Control de tratamiento';
UPDATE services SET price = 450000 WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'dra-aguiar') AND name = 'Toxina botulínica (Botox)';
UPDATE services SET price = 500000 WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'dra-aguiar') AND name = 'Relleno de ácido hialurónico';
UPDATE services SET price = 150000 WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'dra-aguiar') AND name = 'Láser Candela';
UPDATE services SET price = 500000 WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'dra-aguiar') AND name = 'Bioestimulación';
UPDATE services SET price = 650000 WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'dra-aguiar') AND name = 'F-Cells';
UPDATE services SET price = 500000 WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'dra-aguiar') AND name = 'Rinoplastia médica';
UPDATE services SET price = 85000  WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'dra-aguiar') AND name = 'Peeling químico';
UPDATE services SET price = 50000  WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'dra-aguiar') AND name = 'Consulta online';
