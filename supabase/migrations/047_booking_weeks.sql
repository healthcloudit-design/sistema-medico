-- Migración 047: semanas visibles en el calendario de reservas (por tenant)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS booking_weeks SMALLINT DEFAULT 1
    CHECK (booking_weeks IN (1, 2));

-- Acqua quiere ver 2 semanas
UPDATE organizations SET booking_weeks = 2 WHERE slug = 'acqua';
