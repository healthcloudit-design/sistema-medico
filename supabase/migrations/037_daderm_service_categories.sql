-- Migración 037: agregar categorías a los servicios de dra-aguiar
UPDATE services SET category = 'Consultas'     WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'dra-aguiar') AND name IN ('Consulta dermatológica', 'Control de tratamiento', 'Consulta online');
UPDATE services SET category = 'Tratamientos'  WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'dra-aguiar') AND name IN ('Toxina botulínica (Botox)', 'Relleno de ácido hialurónico', 'Bioestimulación', 'Peeling químico');
UPDATE services SET category = 'Procedimientos' WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'dra-aguiar') AND name IN ('Láser Candela', 'F-Cells', 'Rinoplastia médica');
