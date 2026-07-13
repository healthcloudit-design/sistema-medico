-- Add specialty column to organizations for specialty-aware landing pages
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS specialty TEXT;

-- Seed known specialties from existing slugs
UPDATE organizations SET specialty = 'oftalmologia'       WHERE slug ILIKE '%oftalmo%'       AND specialty IS NULL;
UPDATE organizations SET specialty = 'pediatria'          WHERE slug ILIKE '%pediatr%'        AND specialty IS NULL;
UPDATE organizations SET specialty = 'kinesiologia'       WHERE slug ILIKE '%kinesi%'         AND specialty IS NULL;
UPDATE organizations SET specialty = 'kinesiologia'       WHERE slug ILIKE '%fisiote%'        AND specialty IS NULL;
UPDATE organizations SET specialty = 'dermatologia'       WHERE slug ILIKE '%dermato%'        AND specialty IS NULL;
UPDATE organizations SET specialty = 'cardiologia'        WHERE slug ILIKE '%cardio%'         AND specialty IS NULL;
UPDATE organizations SET specialty = 'odontologia'        WHERE slug ILIKE '%odonto%'         AND specialty IS NULL;
UPDATE organizations SET specialty = 'odontologia'        WHERE slug ILIKE '%dental%'         AND specialty IS NULL;
UPDATE organizations SET specialty = 'nutricion'          WHERE slug ILIKE '%nutrici%'        AND specialty IS NULL;
UPDATE organizations SET specialty = 'psicologia'         WHERE slug ILIKE '%psico%'          AND specialty IS NULL;
UPDATE organizations SET specialty = 'psicologia'         WHERE slug ILIKE '%psiqui%'         AND specialty IS NULL;
UPDATE organizations SET specialty = 'traumatologia'      WHERE slug ILIKE '%traumato%'       AND specialty IS NULL;
UPDATE organizations SET specialty = 'traumatologia'      WHERE slug ILIKE '%ortop%'          AND specialty IS NULL;
UPDATE organizations SET specialty = 'ginecologia'        WHERE slug ILIKE '%gineco%'         AND specialty IS NULL;
UPDATE organizations SET specialty = 'ginecologia'        WHERE slug ILIKE '%obstetr%'        AND specialty IS NULL;
UPDATE organizations SET specialty = 'neurologia'         WHERE slug ILIKE '%neurolog%'       AND specialty IS NULL;
UPDATE organizations SET specialty = 'gastroenterologia'  WHERE slug ILIKE '%gastro%'         AND specialty IS NULL;
UPDATE organizations SET specialty = 'endocrinologia'     WHERE slug ILIKE '%endocrin%'       AND specialty IS NULL;
UPDATE organizations SET specialty = 'clinicamedica'      WHERE slug ILIKE '%clinica%'        AND specialty IS NULL;

COMMENT ON COLUMN organizations.specialty IS 'Medical specialty slug for landing page visual identity (e.g. oftalmologia, pediatria, cardiologia)';
